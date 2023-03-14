if (typeof window === "undefined") {

    const fs = require("fs");

    // NOTE: Not using import, as the types complain about what we are doing too much.
    const Module = require("module");

    let forceTransformed = new Set();
    forceTransformed.add("preact");
    forceTransformed.add("preact-event-hook-fork");
    module.exports.forceTransformPackage = function forceTransformPackage(name) {
        forceTransformed.add(name);
    };
    function getPackageName(id) {
        return (id || "").replace(/\\/g, "/").split("/node_modules/")[1]?.split("/")[0] || id;
    }
    function isTransformedPackage(id) {
        const packageName = getPackageName(id);
        return forceTransformed.has(packageName);
    }
    module.exports.isTransformedPackage = isTransformedPackage;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const base = Module.prototype.load;
    Module.prototype.load = function () {
        if (isTransformedPackage(this.id)) {
            let packageName = getPackageName(this.id);
            let packageJsonGuess = (this.id || "").replace(/\\/g, "/").split("/node_modules/")[0] + "/node_modules/" + packageName + "/package.json";
            if (fs.existsSync(packageJsonGuess)) {
                try {
                    let packageJSON = JSON.parse(fs.readFileSync(packageJsonGuess, "utf8"));
                    if (packageJSON.type === "module") {
                        delete packageJSON.type;
                        fs.writeFileSync(packageJsonGuess, JSON.stringify(packageJSON, undefined, 4));
                    }
                } catch { }
            }
        }
        return base.apply(this, arguments);
    };
} else {
    module.exports.forceTransformPackage = function forceTransformPackage(name) {

    };
}