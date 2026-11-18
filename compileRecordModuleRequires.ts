/**
 *      Adds module.requires, which indicates the result of every require per module.
 */

// NOTE: Not using import, as the types complain about what we are doing too much.
const Module = eval("require")("module");

// We need at least 1 export, to force this to be treated like a module
export const forceModule = true;

const caseFixer = new Map<string, string>();
declare global {
    var NO_THROW_BAD_CASING: boolean;
}
function throwOnBadCasing() {
    if (process.argv.includes("--nothrowbadcasing") || globalThis.NO_THROW_BAD_CASING) {
        return false;
    }
    return true;
}

const base = Module.prototype.require;
Module.prototype.require = function (this: NodeJS.Module, request: string) {
    this.requires = this.requires || {};
    this.asyncRequires = this.asyncRequires || {}
    if (this.evalEndTime && !this.requires[request]) {
        this.asyncRequires[request] = true;
    }
    // NOTE: Doing resolveFilename on every require breaks a lot of the caching NodeJS does
    //  to try to avoid calling resolveFilename. However... their caching is probably no longer
    //  needed anymore.
    this.requires[request] = Module._resolveFilename(request, this, false);

    if (throwOnBadCasing()) {
        let resolved = this.requires[request];
        let lower = resolved.toLowerCase();
        let matched = caseFixer.get(lower);
        if (matched === undefined) {
            caseFixer.set(lower, resolved);
        } else if (matched !== resolved) {
            throw new Error(`Case mismatch for ${request}. Resolved to ${resolved}, but ${matched} was already resolved. If you are on Windows and these are the same file, the module will be resolved twice, which will often cause problems. If these are different files and you are on Linux, your application will not be able to run on Windows. If you want to allow this pass --nothrowbadcasing or set globalThis.NO_THROW_BAD_CASING to true. If you're unsure why this is happening check your current directory. It might not have the correct casing, and if you follow a sim link, the sim link might explicitly have casing, which will result in inconsistent behavior. OR, you might just be importing it with the wrong casing.`);
        }

    }
    return base.apply(this, arguments);
};