import * as acorn from "acorn";
import * as async from "async";
import { ErrorCallback } from "async";
import { Logger } from "log4js";
import * as os from "os";
import * as ts from "typescript";

import { Transform, TransformContext, TransformResult } from "../api";
import { Configuration } from "../shared/configuration";
import { Project } from "../shared/project";
import { BundleItem } from "./bundle-item";
import { Queued } from "./queued";

export class Transformer {

    constructor(private config: Configuration, private log: Logger, private project: Project) { }

    public applyTsTransforms(bundleQueue: Queued[], onTransformsApplied: () => void): void {

        const transforms = this.config.bundlerOptions.transforms;

        if (!transforms.length) {
            process.nextTick(() => {
                onTransformsApplied();
            });
            return;
        }

        async.eachSeries(bundleQueue, (queued: Queued, onQueueProcessed: ErrorCallback<Error>) => {

            const context: TransformContext = {
                config: this.config,
                filename: queued.file.originalPath,
                module: queued.file.originalPath,
                source: queued.emitOutput.sourceFile.getFullText(),
                ts: {
                    ast: queued.emitOutput.sourceFile,
                    transpiled: queued.emitOutput.outputText,
                    version: ts.version
                }
            };
            async.eachSeries(transforms, (transform: Transform, onTransformApplied: ErrorCallback<Error>) => {
                process.nextTick(() => {
                    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
                    transform(context, (error: Error, result: TransformResult | boolean, transpile: boolean = true) => {
                        if (typeof result !== "object" || result === null) {
                            result = {
                                dirty: !!result,
                                transpile
                            };
                        }
                        this.handleError(error, transform, context);
                        if (result.dirty) {
                            if (result.transpile) {
                                const transpiled = ts.transpileModule(context.source, {
                                    compilerOptions: this.project.getTsconfig().options,
                                    fileName: context.filename
                                });
                                queued.emitOutput.outputText = transpiled.outputText;
                                queued.emitOutput.sourceMapText = transpiled.sourceMapText;
                            }
                            else {
                                queued.emitOutput.outputText = context.ts.transpiled;
                            }
                        }
                        onTransformApplied();
                    });
                });
            }, onQueueProcessed);
        }, onTransformsApplied);
    }

    public applyTransforms(bundleItem: BundleItem, onTransformsApplied: () => void): void {

        const transforms = this.config.bundlerOptions.transforms;

        if (!transforms.length) {
            process.nextTick(() => {
                onTransformsApplied();
            });
            return;
        }

        const context: TransformContext = {
            config: this.config,
            filename: bundleItem.filename,
            js: {
                ast: bundleItem.ast || { end: 0, start: 0, type: "" }
            },
            module: bundleItem.moduleName,
            source: bundleItem.source
        };
        async.eachSeries(transforms, (transform: Transform, onTransformApplied: ErrorCallback<Error>) => {
            process.nextTick(() => {
                transform(context, (error: Error, result: TransformResult | boolean) => {
                    if (typeof result !== "object" || result === null) {
                        result = {
                            dirty: !!result
                        };
                    }
                    this.handleError(error, transform, context);
                    if (result.dirty) {
                        bundleItem.ast = context.js.ast;
                        bundleItem.source = context.source;
                        bundleItem.transformedScript = result.transformedScript;
                        if (result.transformedScript && bundleItem.ast) {
                            bundleItem.ast = acorn.parse(context.source, this.config.bundlerOptions.acornOptions);
                        }
                    }
                    onTransformApplied();
                });
            });
        }, onTransformsApplied);
    }

    private handleError(error: Error, transform: Transform, context: TransformContext): void {
        if (error) {
            const errorMessage = context.filename + ": " + error.message + os.EOL +
                "Transform function: " + os.EOL + os.EOL +
                transform + os.EOL;
            this.log.error(errorMessage);
            throw new Error(errorMessage);
        }
    }
}
