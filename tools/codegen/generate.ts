import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { MetadataError } from "./metadata.ts";
import { formatSource, renderSnapshot } from "./render.ts";
import { loadSnapshot } from "./snapshot.ts";

const ownershipFile = ".addressfield.json";
const ownership = Schema.fromJsonString(
  Schema.Struct({
    generator: Schema.Literal("addressfield"),
    formatVersion: Schema.Literal(1),
    files: Schema.Array(
      Schema.String.check(
        Schema.isPattern(
          /^(?:(?:countries|postal)\.ts|NOTICE|(?:countries|schemas|regions)\/[A-Z]{2}\.ts|schemas\/fields\.ts)$/u,
        ),
      ),
    ),
  }),
  { space: 2 },
);

const readOwnership = Schema.decodeEffect(ownership, { onExcessProperty: "error" });
const encodeOwnership = Schema.encodeEffect(ownership);

export const generate = Effect.fn(function* (input: string, output: string, check: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const source = yield* fs.realPath(input);
  const destination = path.resolve(output);
  const withinSource = path.relative(source, destination);
  const withinOutput = path.relative(destination, source);
  const isNested = (relative: string) =>
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
  if (isNested(withinSource) || isNested(withinOutput)) {
    return yield* new MetadataError({
      message: "Input and output directories must be separate, not nested.",
    });
  }

  const snapshot = yield* loadSnapshot(source);
  const rendered = yield* renderSnapshot(snapshot);
  const manifestPath = path.join(destination, ownershipFile);

  let previous: ReadonlyArray<string> = [];

  if (yield* fs.exists(manifestPath)) {
    const content = yield* fs.readFileString(manifestPath);
    const manifest = yield* readOwnership(content);
    previous = manifest.files;
  }

  const owned = new Set(previous);
  if (owned.size !== previous.length) {
    return yield* new MetadataError({
      message: "Generated file manifest contains duplicate paths.",
    });
  }

  if (yield* fs.exists(destination)) {
    const root = yield* fs.realPath(destination);
    if ((yield* fs.stat(root)).type !== "Directory") {
      return yield* new MetadataError({ message: `Output is not a directory: ${destination}.` });
    }
    for (const directory of ["countries", "regions", "schemas"]) {
      const location = path.join(destination, directory);

      if (!(yield* fs.exists(location))) {
        continue;
      }

      const resolved = yield* fs.realPath(location);
      const info = yield* fs.stat(location);
      const isLink = resolved !== path.join(root, directory);

      if (isLink || info.type !== "Directory") {
        return yield* new MetadataError({
          message: `Generated directory must not be a file or link: ${location}.`,
        });
      }
    }
  }

  const manifest = yield* formatSource(
    ownershipFile,
    yield* encodeOwnership({
      generator: "addressfield",
      formatVersion: 1,
      files: rendered.files.map((file) => file.path),
    }),
  );
  const expected = [...rendered.files, { path: ownershipFile, content: manifest }];
  const changes = [];

  for (const file of expected) {
    const target = path.join(destination, file.path);
    const exists = yield* fs.exists(target);
    if (exists && file.path !== ownershipFile && !owned.has(file.path)) {
      return yield* new MetadataError({
        message: `File is not owned by addressfield: ${target}. Choose a separate --out directory.`,
      });
    }

    if (!exists || (yield* fs.readFileString(target)) !== file.content) {
      changes.push(file);
    }
  }

  const expectedPaths = new Set(rendered.files.map((file) => file.path));
  const stale = previous.filter((file) => !expectedPaths.has(file));
  const hasChanges = changes.length > 0 || stale.length > 0;

  if (check && hasChanges) {
    return yield* new MetadataError({
      message: `Generated files are out of date. Run generate without --check.\n${[
        ...changes.map((file) => file.path),
        ...stale.map((file) => `${file} (stale)`),
      ].join("\n")}`,
    });
  }

  if (!check && hasChanges) {
    const parent = path.dirname(destination);
    yield* fs.makeDirectory(parent, { recursive: true });
    const staging = yield* fs.makeTempDirectoryScoped({
      directory: parent,
      prefix: ".addressfield-",
    });
    for (const file of changes) {
      const target = path.join(staging, file.path);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, file.content);
    }

    for (const file of changes) {
      if (file.path === ownershipFile) {
        continue;
      }

      const target = path.join(destination, file.path);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.rename(path.join(staging, file.path), target);
    }

    for (const file of stale) {
      yield* fs.remove(path.join(destination, file), { force: true });
    }
    // publish ownership last so an interrupted update can be completed on the next run
    if (changes.some((file) => file.path === ownershipFile)) {
      yield* fs.rename(path.join(staging, ownershipFile), manifestPath);
    }
  }
  return {
    directory: destination,
    countries: snapshot.aggregates.length,
    files: rendered.files.length,
    warnings: rendered.warnings,
  };
}, Effect.scoped);
