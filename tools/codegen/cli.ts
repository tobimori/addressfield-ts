import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { CliError, Command, Flag } from "effect/unstable/cli";

import { fetchSnapshot } from "./fetch.ts";
import { generate } from "./generate.ts";

const output = Flag.string("out").pipe(Flag.withAlias("o"));

const fetchCommand = Command.make(
  "fetch",
  {
    countries: Flag.string("countries").pipe(
      Flag.withDescription("Country codes separated by commas, or all"),
      Flag.withDefault("all"),
    ),
    out: output.pipe(
      Flag.withDescription("New directory for the metadata snapshot"),
      Flag.withDefault("metadata/google"),
    ),
  },
  Effect.fn(
    function* ({ countries, out }) {
      const snapshot = yield* fetchSnapshot(out, countries);
      yield* Console.log(`Saved ${snapshot.countries.length} countries to ${snapshot.directory}.`);
    },
    Effect.mapError((cause) => new CliError.UserError({ cause })),
  ),
).pipe(Command.withDescription("Download a Google address metadata snapshot"));

const generateCommand = Command.make(
  "generate",
  {
    input: Flag.string("input").pipe(
      Flag.withAlias("i"),
      Flag.withDescription("Local metadata snapshot"),
      Flag.withDefault("metadata/google"),
    ),
    out: output.pipe(
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
      yield* Effect.forEach(result.warnings, (warning) => Console.warn(warning), { discard: true });
      yield* Console.log(
        `${check ? "Checked" : "Generated"} ${result.countries} countries in ${result.directory}.`,
      );
    },
    Effect.mapError((cause) => new CliError.UserError({ cause })),
  ),
).pipe(Command.withDescription("Generate library files from a local snapshot"));

export const command = Command.make("addressfield").pipe(
  Command.withDescription("Generate forms and Effect schemas from Google address metadata."),
  Command.withSubcommands([fetchCommand, generateCommand]),
);
