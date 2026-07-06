# typenode

Run TypeScript files directly in Node, no build step.

## Install

```sh
yarn add typenode
```

## Usage

```sh
yarn typenode ./src/main.ts
```

Or, if installed as a dependency, via the `typenode` bin:

```sh
typenode ./src/main.ts
```

Any extra arguments are passed through to your script. Node is launched with a large heap (`--max-old-space-size=128000`), `--expose-gc`, and source map support, so stack traces point at your `.ts` source.

## Caching

Compiled output is cached on disk next to the source file, in a `dist/` folder (e.g. `src/foo.ts` → `src/dist/foo.ts.cache`). The cache key is a hash of the file contents plus the transform pipeline, so edits invalidate it automatically — there's nothing to clean manually.

## --npminstall

Pass `--npminstall` to automatically run `npm install` when an imported dependency is missing or its installed version doesn't match your `package.json`. This is off by default, since running install commands on your project shouldn't happen implicitly.

```sh
yarn typenode ./src/main.ts --npminstall
```
