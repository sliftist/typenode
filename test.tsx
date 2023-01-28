import debugbreak from "debugbreak";
import { test } from "./other";
/*
multiline comments break sourcemaps with swc
wtf
*/

test();

main();
function main() {
    debugbreak(1);
    debugger;
    throw new Error("source maps");
    console.log("hi");
    debugger;
}