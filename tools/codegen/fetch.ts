import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { download } from "./download.ts";
import {
  MetadataError,
  readAggregate,
  readCountries,
  readDefaults,
  selectCountries,
} from "./metadata.ts";
import { notice } from "./notice.ts";

const dataUrl = "https://chromium-i18n.appspot.com/ssl-address/data";
const aggregateUrl = "https://chromium-i18n.appspot.com/ssl-aggregate-address/data";

export const fetchSnapshot = Effect.fn(function* (output: string, selection: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destination = path.resolve(output);
  if (yield* fs.exists(destination)) {
    return yield* new MetadataError({
      message: `Output already exists: ${destination}. Choose a new --out directory to keep the existing snapshot.`,
    });
  }

  const catalog = yield* download(dataUrl);
  const supported = yield* readCountries(catalog.text);
  const countries = yield* selectCountries(selection, supported);
  const defaults = yield* download(`${dataUrl}/ZZ`);
  yield* readDefaults(defaults.text);

  const parent = path.dirname(destination);
  yield* fs.makeDirectory(parent, { recursive: true });
  const temporary = yield* fs.makeTempDirectoryScoped({
    directory: parent,
    prefix: ".addressfield-",
  });
  const staging = path.join(temporary, "snapshot");
  yield* fs.makeDirectory(path.join(staging, "countries"), { recursive: true });

  yield* fs.writeFile(path.join(staging, "countries.json"), catalog.bytes);
  yield* fs.writeFile(path.join(staging, "defaults.json"), defaults.bytes);

  yield* Effect.forEach(
    countries,
    Effect.fn(function* (country) {
      const response = yield* download(`${aggregateUrl}/${encodeURIComponent(country)}`);
      yield* readAggregate(country, response.text).pipe(
        Effect.mapError(
          (cause) =>
            new MetadataError({
              message: `Invalid metadata for ${country}: ${cause.message}`,
              cause,
            }),
        ),
      );
      yield* fs.writeFile(path.join(staging, "countries", `${country}.json`), response.bytes);
    }),
    { concurrency: 4 },
  );

  yield* fs.writeFileString(path.join(staging, "NOTICE"), `${notice}\n`);

  if (yield* fs.exists(destination)) {
    return yield* new MetadataError({
      message: `Output was created during the download: ${destination}. No files were replaced.`,
    });
  }
  yield* fs.rename(staging, destination);
  return { directory: destination, countries };
}, Effect.scoped);
