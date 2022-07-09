/** Overrides _compile, exposing hooks, which can be used to modify compilation,
 *      and then caches that result.
 */

// TODO: Actually check if files are our files (in our .git repo, but not in a dist
//  or node_modules folder), and only handle those files. And then... also handle .js,
//  as it should work fine, and if it is only our repo it shouldn't slow things down by much.
const handledExtensions = [".ts", ".tsx", ".less", ".css"];


const Module = eval("require")("module");
const fs = require("fs");

const path = require("path");

const crypto = require("crypto");

const { atomicWrite, atomicRead } = require("./atomicIO");

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
    let contents = fs.readFileSync(this.filename).toString();
    updateContentsWithContents(this, contents);
}
function updateContentsWithContents(module, contents) {
    let realPath = module.filename;
    let curPath = module.filename;

    module.sourceSHA256 = sha256(contents);

    let applyTransforms = handledExtensions.some(x => realPath.endsWith(x));
    /** HACK: Needed for preact, as we want to use unminified, but their unminified code uses
     *      .mjs with a .js extension, and I can't figure out how to force nodejs to
     *      treat it as .mjs, so... we just treat it like .ts
    */
    if (realPath.replace(/\\/g, "/").includes("node_modules/preact")) {
        applyTransforms = true;
    }
    if (applyTransforms) {
        let cachedContents = undefined;

        let cachePath = undefined;
        let cachingEnabled = true;
        if (module.filename.endsWith(".less")) {
            cachingEnabled = false;
        }
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

            let hash = sha256(JSON.stringify({ contents, compileTransformHash }));
            // NOTE: Add it to the .ts, so we it appears when debugging, which is more correct.
            // Is a variable, as typescript removes comments sometimes (such as if they are beside an unused import).
            if ([".tsx", ".ts"].some(x => realPath.endsWith(x))) {
                contents += `\nexport const _JS_SOURCE_HASH = "${hash}";`;
            } else {
                contents += `\n /* _JS_SOURCE_HASH = "${hash}"; */`;
            }
            cachePath = getCacheFileLocation(curPath);

            try {
                cachedContents = atomicRead(cachePath).toString("utf8");
            } catch { }

            // If the .ts file contains the hash to begin with, the hash would change,
            //  so this actually shouldn't be able to be wrong without a hash collision.
            if (cachedContents && !cachedContents.includes(hash)) {
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