import { Command } from "effect/unstable/cli";

export const command = Command.make("addressfield-codegen").pipe(
  Command.withDescription(
    "Generate address metadata and Effect schemas from a local Google metadata snapshot.",
  ),
);
