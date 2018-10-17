module.exports = function(config) {
    config.set({

        frameworks: ["jasmine", "karma-typescript"],

        files: [
            { pattern: "src/misc/emptyfile/*.ts" }
        ],

        preprocessors: {
            "src/misc/emptyfile/*.ts": ["karma-typescript"]
        },

        karmaTypescriptConfig: {
            include: ["src/misc/emptyfile/*.ts"],
            bundlerOptions: {
                nodeGlobals: false
            },
            compilerOptions: {
                lib: ["DOM", "ES2015"]
            }
        },

        reporters: ["dots", "karma-typescript"],

        browsers: ["ChromeHeadless"],

        singleRun: true
    });
};
