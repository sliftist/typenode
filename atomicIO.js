const fs = require("fs");

module.exports.atomicRead = function atomicRead(path) {
    while (true) {
        let stat0 = fs.statSync(path);
        let contents = fs.readFileSync(path);
        let stat1 = fs.statSync(path);
        if (stat0.mtimeMs === stat1.mtimeMs) {
            return contents;
        }
    }
};

let nextSeqNum = 1;

const random = Date.now() + "." + Math.random();

module.exports.atomicWrite = function atomicWrite(path, contents) {
    let tries = 0;
    while (true) {
        let tmpPath = path + "." + (random + nextSeqNum++) + ".tmp";
        fs.writeFileSync(tmpPath, contents);
        try {
            fs.renameSync(tmpPath, path);
            return;
        } catch (e) {
            fs.unlinkSync(tmpPath);
            if (tries++ > 10) {
                throw e;
            }
        }
    }
};