module.exports = function(config) {
    config.set({

        frameworks: ["jasmine", "karma-typescript"],

        files: [
            { pattern: "node_modules/core-js/client/shim.js" },
            { pattern: "src/react-tsx/**/*.tsx" }
        ],

        preprocessors: {
            "src/react-tsx/**/*.tsx": ["karma-typescript"]
        },

        karmaTypescriptConfig: {
            reports:
            {
                "html": "coverage",
                "text-summary": ""
            }
        },

        reporters: ["dots", "karma-typescript"],

        browsers: ["ChromeHeadless"],

        singleRun: true
    });
};
