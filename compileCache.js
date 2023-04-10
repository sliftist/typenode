/** Overrides _compile, exposing hooks, which can be used to modify compilation,
 *      and then caches that result.
 */

const handledExtensions = [".ts", ".tsx", ".less", ".mjs"];


const Module = eval("require")("module");
const fs = require("fs");

const path = require("path");

const crypto = require("crypto");

const { atomicWrite, atomicRead } = require("./atomicIO");
const { isTransformedPackage } = require("./compileFixESM");

function sha256(contents) {
    return crypto.createHash("sha256").update(contents).digest("hex");
}

function ensureFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        ensureFolder(path.dirname(folderPath));
        try {
            fs.mkdirSync(folderPath);
        } catch (e) {
            // A bit of a hack, but... should work
            if (!e.message.includes("EEXIST")) {
                throw e;
            }
        }
    }
}

function getCacheFileLocation(filePath) {
    let folderPath = path.dirname(filePath);
    folderPath = folderPath.replace(/\\/g, "/");
    if (!folderPath.endsWith("/")) {
        folderPath += "/";
    }
    let subPath = filePath.slice(folderPath.length);
    let fullPath = folderPath + "dist/" + subPath + ".cache";
    ensureFolder(path.dirname(fullPath));
    return fullPath;
}


let compileTransformCallbacks = [];
module.exports.compileTransform = function (callback) {
    compileTransformCallbacks.push(callback);
};
module.exports.compileTransformBefore = function (callback) {
    compileTransformCallbacks.unshift(callback);
};

function updateContents() {
    try {
        let stats = fs.statSync(this.filename);
        if (stats.isDirectory()) {
            console.warn(`Skipping reloading contents, the file appears to be a directory now ${this.filename}`);
        }
    } catch {
        console.warn(`Skipping reloading contents, the file cannot be found ${this.filename}`);
        return;
    }
    let contents = fs.readFileSync(this.filename).toString();
    updateContentsWithContents(this, contents);
}
function updateContentsWithContents(module, contents) {
    let realPath = module.filename;
    realPath = realPath.replace(/\\/g, "/");
    let curPath = module.filename;

    // "\r" messes up swc sourcemaps
    contents = contents.replaceAll("\r\n", "\n");
    module.sourceSHA256 = sha256(contents);

    let moduleFileName = "";
    if (realPath.includes("/node_modules/")) {
        moduleFileName = realPath.split("/node_modules/")[1].split("/")[0];
    }

    let applyTransforms = handledExtensions.some(x => realPath.endsWith(x));
    if (isTransformedPackage(moduleFileName)) {
        applyTransforms = true;
        // Force a .tsx extension, so it is compiled as typescript
        realPath = realPath.split(".").slice(0, -1).join(".") + ".tsx";
    }
    if (applyTransforms) {
        // Handle default imports so we can import like `import preact from "preact"`
        //  (which is valid if allowSyntheticDefaultImports is set in tsconfig.json),
        //  and the import will work fine. This syntax is a bit easier to right, and
        //  you they can always set allowSyntheticDefaultImports to find all cases that use it,
        //  and remove those.
        module.__importStar = x => x;
        module.__importDefault = x => x.default ? x : { default: x };
        // Allow any code using the default typescript "__importDefault" implementation
        //  to work correctly with our exports.
        module.exports.default = module.exports;
        let cachedContents = undefined;

        let cachePath = undefined;
        let cachingEnabled = true;
        if (module.filename.endsWith(".less")) {
            cachingEnabled = false;
        }
        let inputHash = "";
        if (cachingEnabled) {
            const compileTransformHash = (
                JSON.stringify(
                    []
                        .concat(compileTransformCallbacks.map(x => ({ codeToString: x.toString(), ...x })))
                        .concat(_compile.toString())
                        .concat(updateContentsWithContents.toString())
                        .concat(updateContents.toString())
                )
            );

            let inputHash = sha256(JSON.stringify({ contents, compileTransformHash }));
            cachePath = getCacheFileLocation(curPath);

            try {
                cachedContents = atomicRead(cachePath).toString("utf8");
            } catch { }

            // If the .ts file contains the hash to begin with, the hash would change,
            //  so this actually shouldn't be able to be wrong without a hash collision.
            if (cachedContents && !cachedContents.includes(inputHash)) {
                cachedContents = undefined;
            }
        }

        if (cachedContents !== undefined) {
            contents = cachedContents;
        } else {
            for (let transform of compileTransformCallbacks) {
                contents = transform(contents, realPath, module);
            }

            if (cachePath) {
                contents += `\n /* _JS_SOURCE_HASH = "${inputHash}"; */`;
                atomicWrite(cachePath, contents);
            }
        }
    }

    module.moduleContents = contents;
}

const g = new Function("return this");

const baseCompile = Module.prototype._compile;
const _compile = Module.prototype._compile = function (contents, curPath) {
    this.updateContents = updateContents;

    updateContentsWithContents(this, contents);

    return baseCompile.call(this, this.moduleContents, curPath);

    // Random text to force a compile cache update (due to changing side-effects
    //  that aren't track in a hash): 2
};