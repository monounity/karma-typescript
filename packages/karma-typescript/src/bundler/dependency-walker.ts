import * as async from "async";
import * as diff from "diff";
import * as fs from "fs";
import * as glob from "glob";
import * as lodash from "lodash";
import * as os from "os";
import * as path from "path";
import * as ts from "typescript";

import { Logger } from "log4js";

import pad = require("pad");

import { EmitOutput } from "../compiler/emit-output";
import { BundleItem } from "./bundle-item";
import { Queued } from "./queued";

export class DependencyWalker {

    private requireRegexp = /\brequire\b/;
    private walk = require("acorn-walk");

    constructor(private log: Logger) {}

    public hasRequire(s: string): boolean {
        return this.requireRegexp.test(s);
    }

    public collectTypescriptDependencies(queue: Queued[]): number {

        let dependencyCount = 0;
        const ambientModuleNames = this.collectAmbientModules(queue);
        // check resolved modules map for TS >= 4.5.1
        const isTS45Map = function (map: any) {
            return typeof map.get === "function" &&
                typeof map.set === "function" &&
                typeof map.delete === "function" &&
                typeof map.has === "function" &&
                typeof map.forEach === "function" &&
                typeof map.size === "function";
        }

        queue.forEach((queued) => {

            queued.item.dependencies = this.findUnresolvedTsRequires(queued.emitOutput);

            const resolvedModules = (queued.emitOutput.sourceFile as any).resolvedModules;

            if (resolvedModules && !queued.emitOutput.isDeclarationFile) {

                if (isTS45Map(resolvedModules) || lodash.isMap(resolvedModules)) { // Typescript 2.2+
                    resolvedModules.forEach((resolvedModule: any, moduleName: string) => {
                        this.addBundleItem(queued, resolvedModule, moduleName, ambientModuleNames);
                    });
                }
                else { // Typescript 1.6.2 - 2.1.6
                    Object.keys(resolvedModules).forEach((moduleName: string) => {
                        const resolvedModule = resolvedModules[moduleName];
                        this.addBundleItem(queued, resolvedModule, moduleName, ambientModuleNames);
                    });
                }
            }

            dependencyCount += queued.item.dependencies.length;
        });

        this.validateCase(queue);

        return dependencyCount;
    }

    public collectJavascriptDependencies(bundleItem: BundleItem,
                                         onDependenciesCollected: (moduleNames: string[]) => void): void {

        const moduleNames: string[] = [];
        const expressions: any[] = [];

        const isRequire = (node: any) => {
            return node.type === "CallExpression" &&
                   node.callee.type === "Identifier" &&
                   node.callee.name === "require";
        };

        const visitNode = (node: any, state: any, c: any)  => {
            if (!this.hasRequire(bundleItem.source.slice(node.start, node.end))) {
                return;
            }
            this.walk.base[node.type](node, state, c);
            if (isRequire(node) && node.arguments.length > 0) {
                if (node.arguments[0].type === "Literal") {
                    if (!lodash.isString(node.arguments[0].value)) {
                        this.log.error("Unexpected literal value: %s%sRequired by: %s",
                            node.arguments[0].value, os.EOL, bundleItem.filename);
                    }
                    moduleNames.push(node.arguments[0].value);
                }
                else {
                    expressions.push(node.arguments[0]);
                }
            }
        };

        if (bundleItem.ast) {
            this.walk.recursive(bundleItem.ast, null, {
                Expression: visitNode,
                Statement: visitNode
            });
        }

        this.addDynamicDependencies(expressions, bundleItem, (dynamicDependencies) => {
            onDependenciesCollected(moduleNames.concat(dynamicDependencies));
        });
    }

    private collectAmbientModules(queue: Queued[]): string[] {

        const ambientModuleNames: string[] = [];

        queue.forEach((queued) => {
            if (queued.emitOutput.ambientModuleNames) {
                ambientModuleNames.push(...queued.emitOutput.ambientModuleNames);
            }
        });

        return ambientModuleNames;
    }

    private addBundleItem(queued: Queued, resolvedModule: any, moduleName: string, ambientModuleNames: string[]) {
        if (ambientModuleNames.indexOf(moduleName) === -1) {
            queued.item.dependencies.push(
                new BundleItem(moduleName, resolvedModule && resolvedModule.resolvedFileName)
            );
        }
    }

    private findUnresolvedTsRequires(emitOutput: EmitOutput): BundleItem[] {

        const dependencies: BundleItem[] = [];

        if (emitOutput.isDeclarationFile) {
            return dependencies;
        }

        const visitNode = (node: ts.Node) => {

            if (node.kind === ts.SyntaxKind.CallExpression) {

                const ce = (node as ts.CallExpression);

                const expression = ce.expression ?
                    (ce.expression as ts.LiteralExpression) :
                    undefined;

                const argument = ce.arguments && ce.arguments.length ?
                    (ce.arguments[0] as ts.LiteralExpression) :
                    undefined;

                if (expression && expression.text === "require" &&
                    argument && typeof argument.text === "string") {
                    dependencies.push(new BundleItem(argument.text));
                }
            }

            ts.forEachChild(node, visitNode);
        };

        visitNode(emitOutput.sourceFile);

        return dependencies;
    }

    private addDynamicDependencies(expressions: any[],
                                   bundleItem: BundleItem,
                                   onDynamicDependenciesAdded: (dynamicDependencies: string[]) => void) {

        const dynamicDependencies: string[] = [];

        if (expressions.length === 0) {
            process.nextTick(() => {
                onDynamicDependenciesAdded(dynamicDependencies);
            });
            return;
        }

        async.each(expressions, (expression, onExpressionResolved) => {

            const dynamicModuleName = this.parseDynamicRequire(expression);
            const directory = path.dirname(bundleItem.filename);
            let pattern: string;

            if (dynamicModuleName && dynamicModuleName !== "*") {
                if (new BundleItem(dynamicModuleName).isNpmModule()) {
                    dynamicDependencies.push(dynamicModuleName);
                    onExpressionResolved();
                }
                else {
                    pattern = path.join(directory, dynamicModuleName);
                    glob(pattern, (globError, matches) => {
                        if (globError) {
                            throw globError;
                        }
                        async.each(matches, (match, onMatchResolved) => {
                            fs.stat(match, (statError, stats) => {
                                if (statError) {
                                    throw statError;
                                }
                                if (stats.isFile()) {
                                    this.log.debug("Dynamic require: \nexpression: [%s]" +
                                                  "\nfilename: %s\nrequired by %s\nglob: %s",
                                                  JSON.stringify(expression, undefined, 3),
                                                  match, bundleItem.filename, pattern);
                                    dynamicDependencies.push("./" + path.relative(directory, match));
                                }
                                onMatchResolved();
                            });
                        }, onExpressionResolved);
                    });
                }
            }
            else {
                onExpressionResolved();
            }
        }, () => {
            onDynamicDependenciesAdded(dynamicDependencies);
        });
    }

    private parseDynamicRequire(expression: any): string {

        const visitNode = (node: any): string => {
            switch (node.type) {
                case "BinaryExpression":
                    if (node.operator === "+") {
                        return visitNode(node.left) + visitNode(node.right);
                    }
                    break;
                case "ExpressionStatement":
                    return visitNode(node.expression);
                case "Literal":
                    return node.value + "";
                case "Identifier":
                    return "*";
                default:
                    return "";
            }
        };

        return visitNode(expression);
    }

    private validateCase(queue: Queued[]) {

        const files = queue.map((q) => {
            return q.file.originalPath;
        });

        const fileslower = queue.map((q) => {
            return q.file.originalPath.toLowerCase();
        });

        queue.forEach((queued) => {
            if (queued.item.dependencies) {
                queued.item.dependencies.forEach((dependency) => {
                    if (dependency.filename && files.indexOf(dependency.filename) === -1) {
                        const lowerIndex = fileslower.indexOf(dependency.filename.toLowerCase());
                        if (lowerIndex !== -1) {

                            const result = diff.diffChars(files[lowerIndex], dependency.filename);
                            let arrows = "";
                            result.forEach((part) => {
                                if (part.added) {
                                    arrows += "^";
                                }
                                else if (!part.removed){
                                    arrows += pad("", part.count);
                                }
                            });

                            throw new Error("Uppercase/lowercase mismatch importing " +
                                dependency.moduleName + " from " + queued.file.originalPath +
                                ":" + os.EOL + os.EOL +
                                "filename:    " + files[lowerIndex] + os.EOL +
                                "module name: " + dependency.filename + os.EOL +
                                "             " + arrows + os.EOL);
                        }
                    }
                });
            }
        });
    }
}
