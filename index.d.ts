export interface CompileCallback {
    (contents: string, path: string, module: NodeJS.Module): string
}

export function compileTransform2(config: {
    // Inserts as the first transform (instead of the last).
    early?: boolean;
    // If one matches, then we transform this file
    matches: RegExp[];
    transform: CompileCallback;
    // Will be hashed with JSON.stringify. This can be an object
    //  which you set later to invalidate the cache.
    additionalCacheKey?: unknown;
}): void;

/** @deprecated Call compileTransform2 instead */
export function compileTransform(transform: CompileCallback): void;
/** @deprecated Call compileTransform2 instead */
export function compileTransformBefore(transform: CompileCallback): void;

export function addAdditionalExtensions(extensions: string[]): void;

declare global {
    namespace NodeJS {
        interface Module {
            /** `crypto.createHash("sha256").update(contents).digest("hex")` */
            sourceSHA256?: string;
            moduleContents?: string;
            /** Just updates the contents, without actually re-evaluating the module.
             *      - Updating the module can be done just by calling `module.loaded = false; module.load(module.id)`
            */
            updateContents?(): void;

            /** requires is useful to eliminate the need for clientside traversing of pacakge.json files,
                allowing it to match requests with modules (as long as the same request has been made serverside).
                    request => resolved path
            */
            requires?: { [request: string]: string };
            /** Indicates if a request was made AFTER the initial synchronous module evaluation (and
             *      not made during the initial synchronous module evaluation, as a request may have occured multiple times).
             */
            asyncRequires?: { [request: string]: true };

            /** Modules DO have a .load function, this isn't new? Pretty sure they've
             *      had them forever too. If they lose them... well... a lot of our
             *      compile code will have to change anyways.
             *      - Maybe there is another function we are supposed to use?
             */
            load(filename: string): void;
            size?: number;

            /** Incremented every time we the contents are updated (which may or may not be followed by re-evaluating the contents) */
            version?: number;

            // Times are both unique (two modules evaluated at the same Date.now() will have different values).
            evalStartTime?: number;
            evalEndTime?: number;
        }
    }
}