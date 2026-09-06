import { recommended } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "vite-plus";

import { formatOptions } from "./tools/codegen/format-options.ts";
import { header } from "./tools/codegen/notice.ts";

const ignored = [
  ".docs/**",
  ".repos/**",
  ".cache/**",
  "node_modules/**",
  "dist/**",
  "dist-tools/**",
  "playground/dist/**",
  "coverage/**",
];

export default defineConfig({
  pack: [
    {
      name: "library",
      entry: [
        "src/index.ts",
        "src/generated/forms.ts",
        "src/generated/schemas.ts",
        "src/generated/{countries,forms,schemas,regions}/*.ts",
      ],
      root: "src",
      outDir: "dist",
      platform: "neutral",
      target: "es2023",
      format: "esm",
      unbundle: true,
      tsconfig: "tsconfig.lib.json",
      dts: { generator: "tsgo" },
      sourcemap: false,
      banner: { js: header, dts: header },
      outputOptions: { comments: { legal: false } },
      copy: { from: "src/generated/NOTICE", to: "dist" },
      deps: { neverBundle: true, onlyBundle: [] },
    },
    {
      name: "cli",
      entry: { addressfield: "tools/codegen/main.ts" },
      outDir: "dist-tools",
      platform: "node",
      target: "node26",
      format: "esm",
      dts: false,
      sourcemap: true,
      deps: { neverBundle: true, onlyBundle: [] },
    },
  ],
  lint: {
    ignorePatterns: ignored,
    extends: [recommended],
    jsPlugins: [
      {
        name: "anti-slop",
        specifier: "./tools/oxlint/index.ts",
      },
      {
        name: "anti-slop-effect",
        specifier: "./tools/oxlint/effect/index.ts",
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-explicit-return-types": "error",
      "anti-slop/no-internal-export-all": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-manual-tags": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-nested-ternaries": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-switch-statements": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-fn": "error",
    },
  },
  fmt: {
    ...formatOptions,
    ignorePatterns: [...ignored, "metadata/**"],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
