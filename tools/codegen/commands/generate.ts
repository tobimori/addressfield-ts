import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { CliError, Command, Flag } from "effect/unstable/cli";

import { generate } from "../generate.ts";

export const generateCommand = Command.make(
  "generate",
  {
    input: Flag.string("input").pipe(
      Flag.withAlias("i"),
      Flag.withDescription("Local metadata snapshot"),
      Flag.withDefault("metadata/google"),
    ),
    out: Flag.string("out").pipe(
      Flag.withAlias("o"),
      Flag.withDescription("Directory for generated library files"),
      Flag.withDefault("src/generated"),
    ),
    check: Flag.boolean("check").pipe(
      Flag.withDescription("Check generated files without changing them"),
      Flag.withDefault(false),
    ),
  },
  Effect.fn(
    function* ({ input, out, check }) {
      const result = yield* generate(input, out, check);
      for (const warning of result.warnings) yield* Console.warn(warning);
      const action = check ? "Checked" : "Generated";
      yield* Console.log(`${action} ${result.countries} countries in ${result.directory}.`);
    },
    Effect.mapError((cause) => new CliError.UserError({ cause })),
  ),
).pipe(Command.withDescription("Generate library files from a local snapshot"));
