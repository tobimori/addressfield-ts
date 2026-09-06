import { Command } from "effect/unstable/cli";

export const command = Command.make("addressfield").pipe(
  Command.withDescription(
    "Generate address metadata and Effect schemas from a local Google metadata snapshot.",
  ),
);
