let existingModule = Object.values(require.cache).find(x => x.TYPENODE_INSTALL);
if (existingModule) {
    module.exports = existingModule.exports;
    return;
}
module.TYPENODE_INSTALL = true;

// Increase the pitiful initial limit, which isn't nearly enough to
//  debug our huge stack traces.
if (Error.stackTraceLimit < 20) {
    Error.stackTraceLimit = 20;
}

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

// NOTE: NO LONGER using source-map-support, as it doesn't seem to fix stack traces, and...
//  it will clobber the error with it's own error if it can't parse the sourcemap.
// NOTE: source-map-support says NodeJS support source-maps, and therefore it is not
//  required. But... NodeJS's support seems to be poor, and doesn't work with our sourcemaps
//  (which might be due to the .ts extension, or just how we transform our files).
//  BUT, we should use https://github.com/7rulnik/node-source-map-support, to fix
//      some issues with the underlying "source-map" library.
//      - https://github.com/onigoetz/node-source-map-support also works, both use very
//          commonly used replacements for "source-map"
// require("source-map-support").install({
//     hookRequire: true,
// });


require("./compileTS");

require("./compileDirFlags");
require("./compileRecordModuleRequires");

const { compileTransform, compileTransformBefore, forceTransformModule } = require("./compileCache");

module.exports = { compileTransform, compileTransformBefore, forceTransformModule };