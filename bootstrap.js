#!/usr/bin/env node

const THREADPOOL_SIZE = "64";

require("child_process").execFileSync(
    "node",
    [
        "--max-old-space-size=128000",
        "--expose-gc",
        "--enable-source-maps",
        "-r",
        __dirname + "/index.js",
        ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: { UV_THREADPOOL_SIZE: THREADPOOL_SIZE, ...process.env } }
);
