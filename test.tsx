import * as swc from "@swc/core";
import debugbreak from "debugbreak";

/*
multiline comments break sourcemaps with swc
*/

main();
function main() {
    debugbreak(1);
    debugger;
}