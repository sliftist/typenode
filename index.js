let existingModule = Object.values(require.cache).find(x => x.TYPENODE_INSTALL);
if (existingModule) {
    module.exports = existingModule.exports;
    return;
}
module.TYPENODE_INSTALL = true;

/**
 * Typescript transpilation
 *      - Adds a filesystem cache
 *          - Mostly useful for debugging transpilation, but also makes builds faster
 *      - Automatically yarn installs if needed (some of the time)
 *      - Adds error source-map-support
 */

// Register ourself as a require, so fork can also require us in all forked processes.
const g = new Function("return this")();

g.argv_requires = g.argv_requires || [];
g.argv_requires.push(__filename);

// Expose MessagePort, as older versions of nodejs don't
g.MessagePort = require("worker_threads").MessagePort;

const Module = require("module");

// IMPORTANT! Make all filenames consistent, or else our cache can have duplicate entries.
{
    let base = Module._resolveFilename;
    // This path updating is required by compileLess.ts, because I was hacking
    //  issues with using resolve
    Module._resolveFilename = function () {
        return base.apply(this, arguments).replace(/\\/g, "/");
    };
}

// Compile yarn install must be first, or else things such as source-map-support won't even exist!
//  However, we might also need it to be later on... as calls occur in the opposite order
//  we apply them, and we actually want this to be called first (so we also want to apply it
//  last).
require("./compileYarnInstall");

require("source-map-support").install({
    hookRequire: true,
});


require("./compileTS");

require("./compileDirFlags");
require("./compileRecordModuleRequires");

const { compileTransform, compileTransformBefore, forceTransformModule } = require("./compileCache");

module.exports = { compileTransform, compileTransformBefore, forceTransformModule };