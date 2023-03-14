(module as any).allowclient = true;

let base: any = undefined;

export function forceTransformPackage(packageName: string): void {
    if (!base) return;
    base.forceTransformPackage(packageName);
}

if (typeof window === "undefined") {
    base = require("./compileFixESM");
}