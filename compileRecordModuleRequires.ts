/**
 *      Adds module.requires, which indicates the result of every require per module.
 */

// NOTE: Not using import, as the types complain about what we are doing too much.
const Module = eval("require")("module");

// We need at least 1 export, to force this to be treated like a module
export const forceModule = true;

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


    return base.apply(this, arguments);
};