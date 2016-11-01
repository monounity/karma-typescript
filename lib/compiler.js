function Compiler() {

    var debounce = require("lodash.debounce"),
        ts = require("typescript"),

        benchmark = require("./benchmark"),

        basePath,
        compiledFiles = {},
        emitQueue = [],
        importCounter,
        log,
        program,
        sourceFileCache = {},
        tsconfig,

        COMPILE_DELAY = 500;

    function initialize(_basePath, _tsconfig, logger) {

        basePath = _basePath;
        tsconfig = _tsconfig;
        log = logger.create("compiler.karma-typescript");

        log.info("Compiling project using Typescript %s", ts.version);

        outputDiagnostics(tsconfig.errors);
    }

    function getModuleFormat() {

        return ts.ModuleKind[tsconfig.options.module] || "unknown";
    }

    function getImportCount() {

        return importCounter;
    }

    function compile(file, callback) {

        flush(file);

        emitQueue.push({
            file: file,
            callback: callback
        });

        deferredCompile();
    }

    function flush(file) {

        var cachedItem = sourceFileCache[file.originalPath];

        if(cachedItem) {

            delete cachedItem.sourceFile;
        }
    }

    var deferredCompile = debounce(function(){

        emit();

        emitQueue.forEach(function(queued){

            var cachedItem = sourceFileCache[queued.file.originalPath];

            if(!cachedItem) {

                throw new Error("No source found for " + queued.file.originalPath + "!\n" +
                                "Is there a mismatch between the Typescript compiler options and the Karma config?");
            }

            queued.callback({
                outputText: compiledFiles[queued.file.path],
                sourceMapText: compiledFiles[queued.file.path + ".map"],
                importedModules: cachedItem.importedModules
            });
        });

        emitQueue.length = 0;

    }, COMPILE_DELAY);

    function emit() {

        var start = benchmark(),
            compilerHost = ts.createCompilerHost(tsconfig.options);

        compilerHost.getSourceFile = function(filename, languageVersion) {
            return getSourceFile(filename, languageVersion);
        };

        compilerHost.writeFile = function(filename, text) {
            compiledFiles[filename] = text;
        };

        compilerHost.getCurrentDirectory = function() {
            return basePath;
        };
        if (tsconfig.options.configFilePath === undefined || tsconfig.options.configFilePath === "") {
            emitQueue.forEach(function(item) {
                if (tsconfig.fileNames && tsconfig.fileNames.indexOf(item.file.originalPath) === -1) {
                    tsconfig.fileNames.push(item.file.originalPath);
                }
            });
        }

        program = ts.createProgram(tsconfig.fileNames, tsconfig.options, compilerHost, program);

        runDiagnostics(program, compilerHost);

        program.emit();

        countImports();

        log.info("Compiled %s files in %s ms.", tsconfig.fileNames.length, benchmark(start));
    }

    function countImports() {

        importCounter = 0;

        Object.keys(sourceFileCache).forEach(function(key) {

            importCounter += getImportedModules(sourceFileCache[key].sourceFile).length;
        });
    }

    function getSourceFile(filename, languageVersion) {

        var absolutePath = ts.getNormalizedAbsolutePath(filename, ts.sys.getCurrentDirectory()),
            cachedItem = sourceFileCache[absolutePath],
            sourceText,
            sourceFile;

        if(cachedItem && cachedItem.sourceFile) {
            log.debug("Using cached version: %s", absolutePath);
            return cachedItem.sourceFile;
        }

        log.debug("Reading: %s", absolutePath);

        sourceText = ts.sys.readFile(absolutePath);

        if(!sourceText) {
            log.error("No source found for " + absolutePath);
        }

        sourceFile = ts.createSourceFile(absolutePath, sourceText, languageVersion);

        sourceFileCache[absolutePath] = {
            sourceFile: sourceFile,
            importedModules: getImportedModules(sourceFile),
            version: cachedItem ? cachedItem.version : 0
        };

        return sourceFile;
    }

    function getImportedModules(sourceFile) {

        var importedModules = [];

        sourceFile.statements.forEach(function(statement){

            if(statement.moduleSpecifier) {

                importedModules.push({
                    path: statement.moduleSpecifier.text,
                    isDummy: !statement.importClause
                });
            }
        });

        return importedModules;
    }

    function runDiagnostics(program, host) {

        var diagnostics = ts.getPreEmitDiagnostics(program);

        outputDiagnostics(diagnostics, host);
    }

    function outputDiagnostics(diagnostics, host) {

        if(diagnostics && diagnostics.length > 0) {

            diagnostics.forEach(function(diagnostic){

                if(ts.formatDiagnostics) { // v1.8+

                    log.error(ts.formatDiagnostics([diagnostic], host));
                }
                else { // v1.6, v1.7

                    var output = "";

                    if (diagnostic.file) {
                        var loc = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                        output += diagnostic.file.fileName.replace(process.cwd(), "") + "(" + (loc.line + 1) + "," + (loc.character + 1) + "): ";
                    }

                    var category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
                    output += category + " TS" + diagnostic.code + ": " + ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine) + ts.sys.newLine;

                    log.error(output);
                }
            });

            if(tsconfig.options.noEmitOnError) {

                ts.sys.exit(ts.ExitStatus.DiagnosticsPresent_OutputsSkipped);
            }
        }
    }

    this.initialize = initialize;
    this.compile = compile;
    this.getModuleFormat = getModuleFormat;
    this.getImportCount = getImportCount;
}

module.exports = Compiler;
