module.exports = function(config) {
    config.set({

        frameworks: ["jasmine", "karma-typescript"],

        files: [
            { pattern: "src/**/*.ts" }
        ],

        preprocessors: {
            "src/**/*.+(js|ts|tsx)": ["karma-typescript"]
        },

        karmaTypescriptConfig: {
            bundlerOptions: {
                constants: {
                    __STRING__: JSON.stringify("abc" + 123),
                    __BOOLEAN__: true,
                    "process.env": {
                        "VARIABLE": "value"
                    }
                },
                resolve: {
                    alias: {
                        "kttm-add-alias": "node_modules/karma-typescript-test-module/add/index.js"
                    }
                },
            },
            tsconfig: "./tsconfig.json",
        },

        reporters: ["progress", "karma-typescript"],

        browsers: ["ChromeHeadless"],

        singleRun: true
    });
};
