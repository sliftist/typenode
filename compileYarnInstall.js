/**
 *      For any dependencies that are found in a package.json, we verify that a compatible
 *          version is installed, and if not, we run yarn install.
 */

const fs = require("fs");
const path = require("path");

const child_process = require("child_process");

function getVersionParts(version) {
    if (version === "") return [];
    return version
        .split(".")
        .slice(0, 3)
        .map((x) => x);
}
function versionMatch(version, request) {
    for (let i = 0; i < Math.max(version.length, request.length); i++) {
        // If the parse fails, just default to a match
        // if (!Number.isFinite(request[i])) continue;
        if (version[i] !== request[i]) return false;
    }
    return true;
}
function doesVersionMatch(version, requestVersion, allowNotExists) {
    if (version.startsWith("file:")) return true;
    if (requestVersion.startsWith("file:")) return true;
    if (requestVersion.slice(1, 3) === ":/") return true;
    if (requestVersion.slice(1, 3) === ":\\") return true;

    if (requestVersion.startsWith("?")) {
        return doesVersionMatch(version, requestVersion.slice(1), true);
    }

    if (!version && allowNotExists) return true;

    if (requestVersion === "*") return true;

    if (requestVersion.startsWith("http")) return true;
    if (requestVersion.startsWith("git+")) return true;

    // TODO: Range matches
    // if (requestVersion.includes("-")) return true;
    // if (requestVersion.startsWith(">=")) return true;
    // if (requestVersion.startsWith(">")) return true;
    // if (requestVersion.startsWith("<")) return true;
    // if (requestVersion.startsWith("<=")) return true;

    // Direct path references
    // TODO: Check to make sure the path is installed?
    if (requestVersion.startsWith(".")) return true;

    if (requestVersion.startsWith("~")) {
        return versionMatch(getVersionParts(version).slice(0, 2), getVersionParts(requestVersion.slice(1)).slice(0, 2));
    }
    if (requestVersion.startsWith("^")) {
        return versionMatch(getVersionParts(version).slice(0, 1), getVersionParts(requestVersion.slice(1)).slice(0, 1));
    }

    return versionMatch(getVersionParts(version).slice(0, 3), getVersionParts(requestVersion).slice(0, 3));
}

const Module = eval("require")("module");
const base = Module._resolveFilename;
Module._resolveFilename = resolveFilename;

let installedOnce = false;

function resolveFilename() {
    let request = arguments[0];
    let parentModule = arguments[1];
    request = request.replace(/\\/g, "/");

    if (!installedOnce && parentModule && !request.startsWith(".") && !process.argv.includes("--noinstall")) {
        // Probably a module request

        // NOTE: The correct way to do this is to concatenate the request with every search path
        //  (mostly node_modules paths), and then see if any subpaths of those match any dependendcies
        //  in the package.jsons for those node_modules paths. However... that is too much code, and likely
        //  too slow, so... we use this hack.
        if (request.includes("@")) {
            request = request.split("/").slice(0, 2).join("/");
        } else if (request.includes("/")) {
            request = request.split("/").slice(0, 1).join("/");
        }

        let version;
        let folder;
        for (let searchPath of parentModule.paths || []) {
            if (!searchPath.endsWith("node_modules")) continue;
            folder = path.dirname(searchPath);
            let packageJsonTestPath = folder + "/package.json";
            let packageObj = undefined;
            try {
                // Check for exists, so we have less caught exceptions (as they make "pause on caught exceptions"
                //  significantly less useful).
                if (fs.existsSync(packageJsonTestPath)) {
                    packageObj = JSON.parse(fs.readFileSync(packageJsonTestPath).toString());
                }
            } catch { }
            if (!packageObj) continue;
            for (let dependencyObj of [
                packageObj.dependencies,
                //packageObj.devDependencies,
            ]) {
                if (!dependencyObj) continue;
                version = dependencyObj[request];
                if (version) break;
            }
            if (version) break;
            for (let dependencyObj of [packageObj.optionalDependencies]) {
                if (!dependencyObj) continue;
                version = dependencyObj[request];
                if (version) {
                    version = "?" + version;
                    break;
                }
            }
            if (version) break;
        }

        if (version && !folder.includes("node_modules")) {
            function getCurrentVersion() {
                // SO... it might be the case we depend on it from a parent package. It depends on how yarn install
                //  decided to install it. So... search for the actual path
                for (let searchPath of parentModule.paths || []) {
                    let packageJsonTestPath = searchPath + "/" + request + "/package.json";
                    if (!fs.existsSync(packageJsonTestPath)) continue;
                    try {
                        return JSON.parse(fs.readFileSync(packageJsonTestPath).toString()).version;
                    } catch { }
                }

                // NOTE: Technically an empty string for a version is valid, but... we'll just ignore that
                //  and make it invalid. Who just puts an empty string?
                return "";
            }

            let installedVersion = getCurrentVersion();

            if (!doesVersionMatch(installedVersion, version)) {
                console.log();
                console.log();
                console.log("--------------------------------------------------");
                console.log("--------------------------------------------------");

                const from = parentModule?.filename || "main";

                console.log(
                    `Mismatched dependency version for ${request}. Have ${installedVersion}, want ${version}. Required from ${from}`
                );
                console.log(`yarn install at ${folder}`);

                console.log("--------------------------------------------------");
                console.log("--------------------------------------------------");
                console.log();
                console.log();

                child_process.execSync("yarn install", { cwd: folder, stdio: "inherit" });
                installedOnce = true;

                console.log();
                console.log();
                console.log("--------------------------------------------------");
                console.log("--------------------------------------------------");
                console.log("--------------------------------------------------");
                console.log("--------------------------------------------------");
                console.log();
                console.log();

                installedVersion = getCurrentVersion();

                if (!doesVersionMatch(installedVersion, version)) {
                    console.warn(
                        `Tried to yarn install, but dependency version still out of date for ${JSON.stringify(
                            request
                        )}. Want ${version}, but have ${installedVersion}, required from ${from}`
                    );
                }
            }
        }
    }

    return base.apply(this, arguments);
}
