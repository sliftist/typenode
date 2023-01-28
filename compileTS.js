/** Compiles .ts to javascript, via the compileCache hooks. */

// Allow .ts and .tsx extensions
require.extensions[".ts"] = require.extensions[".tsx"] = require.extensions[".js"];

const { compileTransform } = require("./compileCache");
const fs = require("fs");
const path = require("path");

compileTransform(function compileTS(contents, curPath) {

    let compileAsTypescript = curPath.endsWith(".ts") || curPath.endsWith(".tsx");

    if (!compileAsTypescript) return contents;

    // ONLY load typescript if we have to. Otherwise, we take a huge load penalty for no reason.
    const typescript = require("typescript");

    // The default config, which we probably won't need to use
    let tsconfig = {
        compilerOptions: {
            target: "es2017",
            module: "commonjs",
            jsx: "react",
            esModuleInterop: true,
        }
    };

    // Check all parent directories for tsconfigs
    let pathParts = curPath.replace(/\\/g, "/").split("/");
    for (let i = pathParts.length - 1; i >= 1; i--) {
        let parentFolder = pathParts.slice(0, i).join("/");
        let configTextPath = parentFolder + "/tsconfig.json";
        let tsconfigText = "";
        try {
            tsconfigText = fs.readFileSync(configTextPath).toString();
        } catch { continue; }
        // TODO: Support extends. Probably just by calling the correct typescript.parse function?
        if (tsconfigText.includes(`"extends":`)) {
            continue;
        }
        let { config, error } = typescript.parseConfigFileTextToJson(configTextPath, tsconfigText);
        tsconfig = config;
        break;
    }

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    const compileOptions = tsconfig.compilerOptions;
    compileOptions.sourceMap = false;
    compileOptions.inlineSourceMap = true;
    compileOptions.inlineSources = true;
    tsconfig.fileName = tsconfig.moduleName = path.basename(curPath);

    // Default the jsx settings based on the extension.
    if (curPath.endsWith(".ts")) {
        compileOptions.jsx = typescript.JsxEmit.None;
    } else if (curPath.endsWith(".tsx")) {
        if (
            compileOptions.jsx === undefined
            || compileOptions.jsx === typescript.JsxEmit.None
        ) {
            compileOptions.jsx = typescript.JsxEmit.React;
        }
    }

    let { outputText, sourceMapText } = typescript.transpileModule(contents, tsconfig);

    return outputText;
});