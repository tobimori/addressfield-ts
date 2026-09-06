import { Command } from "effect/unstable/cli";

import { fetchCommand } from "./commands/fetch.ts";
import { generateCommand } from "./commands/generate.ts";

export const command = Command.make("addressfield").pipe(
  Command.withDescription(
    "Generate address metadata and Effect schemas from a local Google metadata snapshot.",
  ),
  Command.withSubcommands([fetchCommand, generateCommand]),
);
