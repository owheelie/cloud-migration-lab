import { build } from "esbuild";

await build({
  entryPoints: ["src/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
  minify: true,
  sourcemap: true,
  // Bundled AWS SDK code calls require() for Node built-ins.
  // ES modules have no require(), so provide one at the top of the bundle.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

// Fail the build if the bundle cannot be loaded the way Lambda loads it.
await import(new URL("./dist/index.mjs", import.meta.url));
console.log("bundle loads OK");
