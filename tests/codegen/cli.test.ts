import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { TestConsole } from "effect/testing";
import { CliOutput, Command } from "effect/unstable/cli";
import { describe, expect, it } from "vite-plus/test";

import packageJson from "../../package.json" with { type: "json" };
import { command } from "../../tools/codegen/cli.ts";

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
);

const runCommand = Command.runWith(command, { version: packageJson.version });

const captureOutput = Effect.fn(function* (args: ReadonlyArray<string>) {
  yield* runCommand(args);
  return (yield* TestConsole.logLines).join("\n");
});

const execute = (args: ReadonlyArray<string>) =>
  Effect.runPromise(captureOutput(args).pipe(Effect.provide(testLayer)));

describe("code generator CLI", () => {
  it("provides Effect CLI help", () =>
    execute(["--help"]).then((output) => {
      expect(output).toContain("addressfield-codegen");
      expect(output).toContain("--help");
      expect(output).toContain("--version");
    }));

  it("uses the package version", () =>
    execute(["--version"]).then((output) => {
      expect(output).toContain(packageJson.version);
    }));

  it("rejects unknown flags", () => expect(execute(["--invalid-flag"])).rejects.toThrow());
});
