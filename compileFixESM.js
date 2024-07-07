if (typeof window === "undefined") {

    const fs = require("fs");

    // NOTE: Not using import, as the types complain about what we are doing too much.
    const Module = require("module");

    let forceTransformed = new Set();
    forceTransformed.add("preact");
    forceTransformed.add("preact-event-hook-fork");
    module.exports.forceTransformPackage = function forceTransformPackage(name) {
        forceTransformed.add(name);
        forceChangePackageJson(name);
    };
    function getPackageName(idOrPath) {
        return (idOrPath || "").replace(/\\/g, "/").split("/node_modules/")[1]?.split("/")[0] || idOrPath;
    }
    function isTransformedPackage(id) {
        return forceTransformed.has(getPackageName(id));
    }
    module.exports.isTransformedPackage = isTransformedPackage;

    function forceChangePackageJson(id) {
        let packageName = getPackageName(id);
        for (let path of module.paths) {
            let packageJsonGuess = path + "/" + packageName + "/package.json";
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
    }
} else {
    module.exports.forceTransformPackage = function forceTransformPackage(name) { };
    module.exports.isTransformedPackage = function isTransformedPackage(id) { };
}