#!/usr/bin/env node

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import packageJson from "../../package.json" with { type: "json" };
import { command } from "./cli.ts";

command.pipe(
  Command.run({ version: packageJson.version }),
  Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  NodeRuntime.runMain,
);
