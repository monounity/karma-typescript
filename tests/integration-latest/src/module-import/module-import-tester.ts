import add from 'karma-typescript-test-module/add';
import * as nonExtensibleObject from "karma-typescript-test-module/non-extensible";

export class ModuleImportTester {

    public testImportModule(): number {

        return add(1, 2)
    }

    public testNonExtensibleObject(): MapConstructor {

        return nonExtensibleObject;
    }

    public testModuleExportsKeys(): string[] {

        return Object.keys(module.exports);
    }

    public testUndefinedModuleExports(): any {

        return require("./empty-export.js");
    }
}
