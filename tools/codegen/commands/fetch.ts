import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { CliError, Command, Flag } from "effect/unstable/cli";

import { fetchSnapshot } from "../fetch.ts";

export const fetchCommand = Command.make(
  "fetch",
  {
    countries: Flag.string("countries").pipe(
      Flag.withDescription("Country codes separated by commas, or all"),
      Flag.withDefault("all"),
    ),
    out: Flag.string("out").pipe(
      Flag.withAlias("o"),
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
