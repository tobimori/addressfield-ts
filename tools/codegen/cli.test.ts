import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { fileURLToPath } from "node:url";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { ChildProcess } from "effect/unstable/process";

import packageJson from "../../package.json" with { type: "json" };

const entryPoint = fileURLToPath(new URL("./main.ts", import.meta.url));

const runCli = Effect.fn(function* (flag: string) {
  const child = yield* ChildProcess.make(process.execPath, [entryPoint, flag]);
  const output = yield* Stream.mkString(Stream.decodeText(child.all));
  const exitCode = yield* child.exitCode;
  return { output, exitCode };
}, Effect.provide(NodeServices.layer));

describe("code generator CLI", () => {
  it.live(
    "shows the command name and purpose",
    Effect.fn(function* () {
      const { output, exitCode } = yield* runCli("--help");
      expect(exitCode).toBe(0);
      expect(output).toContain("addressfield");
      expect(output).toContain("Generate address metadata and Effect schemas");
    }),
  );

  it.live(
    "reports the package version",
    Effect.fn(function* () {
      const { output, exitCode } = yield* runCli("--version");
      expect(exitCode).toBe(0);
      expect(output.trim()).toBe(`addressfield v${packageJson.version}`);
    }),
  );
});
