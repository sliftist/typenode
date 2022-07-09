/** Compiles .ts to javascript, via the compileCache hooks. */

// Allow .ts and .tsx extensions
require.extensions[".ts"] = require.extensions[".tsx"] = require.extensions[".js"];

const { compileTransform } = require("./compileCache");
const fs = require("fs");

compileTransform(function compileTS(contents, curPath) {

    let compileAsTypescript = curPath.endsWith(".ts") || curPath.endsWith(".tsx");

    if (!compileAsTypescript) return contents;

    // The default config, which we probably won't need to use
    let tsconfig = {
        compilerOptions: {
            target: "es2017",
            module: "commonjs",
            jsx: "react",
            esModuleInterop: true,
        }
    };

    // Check all parents for tsconfigs

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
        //let { config, error } = typescript.parseConfigFileTextToJson(configTextPath, tsconfigText);
        // TODO: I believe SWC has something that does this?
        // NOTE: Eval isn't unsafe, we are evaluating the code anyway, so anything which injects code into
        //  the tsconfig.json file could just inject code into the .ts file and save a step!
        let config = eval("(" + tsconfigText + ")");
        tsconfig = config;
        break;
    }

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};

    // Default the jsx settings based on the extension.
    if (curPath.endsWith(".ts")) {
        tsconfig.compilerOptions.jsx = undefined;
    } else if (curPath.endsWith(".tsx")) {
        if (
            tsconfig.compilerOptions.jsx === undefined
            || tsconfig.compilerOptions.jsx === 0
        ) {
            tsconfig.compilerOptions.jsx = "react";
        }
    }

    let compilerOptions = tsconfig.compilerOptions;

    // TODO: Map all config options
    //  Something like: https://github.com/TypeStrong/ts-node/blob/main/src/transpilers/swc.ts
    let swcConfig = {
        jsc: {
            target: compilerOptions.target,
            parser: {
                syntax: "typescript",
                decorators: compilerOptions.experimentalDecorators,
                tsx: compilerOptions.jsx === "react",
            }
        },
        sourceMaps: compilerOptions.inlineSourceMap ? "inline" : undefined,
        inlineSourcesContent: compilerOptions.inlineSources,
        // NOTE: In devtools, for nodejs, there are duplicate files. I'm not sure how to avoid this, HOWEVER,
        //  by removing the extension from the name the typescript file shows up first, so it avoids a lot of the issue.
        sourceFileName: curPath.split("/").slice(-1)[0].split(".").slice(0, -1).join("."),
        outputPath: curPath,
    };

    if (compilerOptions.module) {
        swcConfig.module = {
            type: compilerOptions.module.toLowerCase(),
        };
    }
    swcConfig.jsc.transform = {};
    swcConfig.jsc.transform.react = {};
    let reactConfig = swcConfig.jsc.transform.react;
    reactConfig.runtime = "classic";
    reactConfig.pragma = compilerOptions.jsxFactory;
    reactConfig.pragmaFrag = compilerOptions.jsxFragmentFactory;


    const swc = require("@swc/core");

    let result = swc.transformSync(contents, swcConfig);
    outputText = result.code;

    // // Strip the existing sourceMappingURL
    // {
    //     const prefix = `//# ` + `sourceMappingURL=`;
    //     let index = outputText.indexOf(prefix);
    //     if (index >= 0 && (outputText[index - 1] === "\r" || outputText[index - 1] === "\n")) {
    //         let endIndex = outputText.indexOf("\n", index);
    //         if (endIndex < 0) {
    //             endIndex = outputText.length;
    //         }
    //         outputText = outputText.slice(0, index) + outputText.slice(endIndex);
    //     }
    // }

    // let sourceMapObj = JSON.parse(sourceMapText);
    // sourceMapObj.file = path.basename(curPath);
    // sourceMapObj.sources = [sourceMapObj.file];
    // sourceMapObj.sourcesContent = [contents];

    // if (inlineSourceMaps) {
    //     let sourceMapBase64 = Buffer.from(JSON.stringify(sourceMapObj)).toString("base64");
    //     outputText += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${sourceMapBase64}\n`;
    // } else {
    //     let mapPath = cachePath + ".map";
    //     atomicWrite(mapPath, JSON.stringify(sourceMapObj));
    //     outputText += `\n//# sourceMappingURL=${mapPath}`;
    // }
    // outputText += `\n// transpileTime = ${transpileTime}ms`;

    return outputText;
});