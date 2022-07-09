/**
 *      Looks for adjacent x.flag files, setting an x flag on the module if they exist.
 *      - Also checks parent directories
 * 
 *      - Ex, if test.js has a sibling file called allowclient.flag, then the test.js
 *          module has allowclient = true set on it.
 */

import * as path from "path";
import * as fs from "fs";

// NOTE: Not using import, as the types complain about what we are doing too much.
const Module = require("module");

// We need at least 1 export, to force this to be treated like a module
export const forceModule = true;

let flagsPerDir: { [dirname: string]: { [flag: string]: true } } = Object.create(null);
function getFlagsForDir(dir: string) {
    let flags = flagsPerDir[dir];
    if (!flags) {
        flags = Object.create(null);
        flagsPerDir[dir] = flags;
        let filesInDir: string[] | undefined;
        try {
            filesInDir = fs.readdirSync(dir);
        } catch { }
        if (filesInDir) {
            for (let flag of filesInDir.filter(x => x.endsWith(".flag"))) {
                flags[flag.slice(0, -".flag".length)] = true;
            }
        }
    }
    return flags;
}

const base = Module.prototype.load;
Module.prototype.load = function (this: NodeJS.Module) {
    let result = base.apply(this, arguments);

    if (this.filename) {
        let flags: { [flag: string]: true } = Object.create(null);

        let dirParts = this.filename.replace(/\\/g, "/").split("/").slice(0, -1);
        for (let i = 1; i <= dirParts.length; i++) {
            Object.assign(flags, getFlagsForDir(dirParts.slice(0, i).join("/")));
        }
        Object.assign(this, flags);
    }

    return result;
};