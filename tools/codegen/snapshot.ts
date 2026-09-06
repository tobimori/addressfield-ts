import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { MetadataError, readAggregate, readCountries, readDefaults } from "./metadata.ts";

const readSource = Effect.fn(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(file);

  if (info.size > 8n * 1024n * 1024n) {
    return yield* new MetadataError({ message: `Metadata file exceeds 8 MiB: ${file}` });
  }

  const bytes = yield* fs.readFile(file);

  return yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: (cause) => new MetadataError({ message: `Invalid UTF-8 in ${file}`, cause }),
  });
});

export const loadSnapshot = Effect.fn(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const catalog = yield* readSource(path.join(directory, "countries.json"));
  const supported = yield* readCountries(catalog);
  const defaults = yield* readDefaults(yield* readSource(path.join(directory, "defaults.json")));

  const countryDirectory = path.join(directory, "countries");
  const files = yield* fs.readDirectory(countryDirectory);
  const countries = files
    .filter((file) => /^[A-Z]{2}\.json$/u.test(file))
    .map((file) => file.slice(0, 2))
    .sort();

  if (countries.length === 0) {
    return yield* new MetadataError({
      message: `No country files found in ${countryDirectory}`,
    });
  }

  const aggregates = yield* Effect.forEach(
    countries,
    Effect.fn(function* (country) {
      if (!supported.includes(country)) {
        return yield* new MetadataError({
          message: `Country ${country} is missing from countries.json`,
        });
      }

      const file = path.join(countryDirectory, `${country}.json`);
      const content = yield* readSource(file);
      const records = yield* readAggregate(country, content);

      return { country, records };
    }),
    { concurrency: 4 },
  );

  return { defaults, aggregates };
});
