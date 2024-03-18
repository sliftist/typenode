/** Compiles .ts to javascript, via the compileCache hooks. */

// Allow .ts and .tsx extensions
require.extensions[".ts"] = require.extensions[".tsx"] = require.extensions[".js"];
require.extensions[".cjs"] = require.extensions[".mjs"] = require.extensions[".js"];

const { compileTransform } = require("./compileCache");
const fs = require("fs");
const path = require("path");
const { isTransformedPackage } = require("./compileFixESM");

compileTransform(function compileTS(contents, curPath) {
    let compileAsTypescript = curPath.endsWith(".ts") || curPath.endsWith(".tsx") || curPath.endsWith(".mjs");

    if (isTransformedPackage(curPath)) {
        compileAsTypescript = true;
    }

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

    let packageJsonObj = {};

    // Check all parent directories for tsconfigs
    let pathParts = curPath.replace(/\\/g, "/").split("/");
    for (let i = pathParts.length - 1; i >= 1; i--) {
        let parentFolder = pathParts.slice(0, i).join("/");
        let configTextPath = parentFolder + "/tsconfig.json";
        let tsconfigText = "";
        try {
            tsconfigText = fs.readFileSync(configTextPath).toString();
        } catch { continue; }
        let packageJsonPath = parentFolder + "/package.json";
        try {
            let packageJsonText = fs.readFileSync(packageJsonPath).toString();
            packageJsonObj = JSON.parse(packageJsonText);
        } catch { }
        // TODO: Support extends. Probably just by calling the correct typescript.parse function?
        if (tsconfigText.includes(`"extends":`)) {
            continue;
        }
        let { config, error } = typescript.parseConfigFileTextToJson(configTextPath, tsconfigText);
        tsconfig = config;
        break;
    }

    // HACK: Try to replace module syntax.
    //  TODO: Use AST parsing to do this more safely
    if (packageJsonObj.type === "module") {
        contents = contents.replaceAll("import.meta.url", JSON.stringify(curPath));
    }

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    const compileOptions = tsconfig.compilerOptions;
    compileOptions.sourceMap = false;
    compileOptions.inlineSourceMap = true;
    compileOptions.inlineSources = true;
    tsconfig.fileName = tsconfig.moduleName = path.basename(curPath);

    // ALWAYS commonjs, so we can import modulejs files correctly.
    tsconfig.compilerOptions.module = "commonjs";

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

    outputText = outputText.replaceAll("\r\n", "\n");
    // HACK: Only use the default module if it exists, not just if it is an esModule. This seems to be how the type
    //  system works, so... it is how the code should run at runtime.
    outputText = outputText.replaceAll(
        `    return (mod && mod.__esModule) ? mod : { "default": mod };\n`,
        `    return (mod && mod.__esModule && mod.default) ? mod : { "default": mod };\n`
    );

    {
        let tag = `Object.defineProperty(exports, "__esModule", { value: true });`;
        let esModuleStart = outputText.indexOf(tag);
        if (0 < esModuleStart && esModuleStart < 1000) {
            esModuleStart += tag.length;
            let nextExportIndex = outputText.indexOf("exports.", esModuleStart);
            let nextEndLine = outputText.indexOf("\n", esModuleStart + 10);
            if (nextExportIndex < nextEndLine) {
                // This line sets all exports to undefined. This causes massive issues with hotreloading, so... let's remove it.
                outputText = outputText.slice(0, nextExportIndex) + "//" + outputText.slice(nextExportIndex);
            }
        }
    }

    // Update all `Object.defineProperty(exports, ...` to set configurable: true, so hot reloading works
    {
        let tag = `Object.defineProperty(exports, "`;
        let index = outputText.length - 1;
        while (true) {
            let tagStartIndex = outputText.lastIndexOf(tag, index);
            if (tagStartIndex === -1) break;
            index = tagStartIndex - 1;
            let endIndex = outputText.indexOf(`});\n`, tagStartIndex);
            if (endIndex === -1) break;
            let line = outputText.slice(tagStartIndex, endIndex);
            if (line.includes("configurable")) continue;
            outputText = outputText.slice(0, endIndex) + ", configurable: true" + outputText.slice(endIndex);
        }
    }

    // NOTE: It looks like "inlineSourceMap" and "inlineSources" work fine, so we can just use those. If we set sourceMap = true,
    //      and those to false, the code below will inline source maps.
    // Add sourcemap
    // {
    //     // Strip the existing sourceMappingURL
    //     outputText = outputText.replaceAll(/\/\/# sourceMappingURL=.*/g, "");

    //     let sourceMapObj = JSON.parse(sourceMapText);
    //     sourceMapObj.file = curPath;
    //     sourceMapObj.sources = [sourceMapObj.file];
    //     sourceMapObj.sourcesContent = [contents];

    //     let sourceMapBase64 = Buffer.from(JSON.stringify(sourceMapObj)).toString("base64");
    //     outputText += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${sourceMapBase64}\n`;
    // }

    return outputText;
});