/**
 *      Adds module.requires, which indicates the result of every require per module.
 */

// NOTE: Not using import, as the types complain about what we are doing too much.
const Module = eval("require")("module");

// We need at least 1 export, to force this to be treated like a module
export const forceModule = true;

const caseFixer = new Map<string, string>();
declare global {
    var NO_CASE_FIXING: boolean;
}
function doCaseFixing() {
    if (process.argv.includes("--nofixcase") || globalThis.NO_CASE_FIXING) {
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


    if (doCaseFixing()) {
        let resolved = this.requires[request];
        let lower = resolved.toLowerCase();
        let matched = caseFixer.get(lower);
        if (matched === undefined) {
            matched = resolved;
            caseFixer.set(lower, matched);
        } else {
            resolved = matched;
            this.requires[request] = resolved;
        }
        return base.call(this, resolved);
    } else {
        return base.apply(this, arguments);
    }
};