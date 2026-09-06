import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { format } from "vite-plus/fmt";

import type { AddressField } from "../../src/address.ts";
import { fieldTokens } from "../../src/fields.ts";
import { normalizeCountry } from "./normalize.ts";
import { formatOptions } from "./format-options.ts";
import { MetadataError } from "./metadata.ts";
import { header, notice } from "./notice.ts";
import type { loadSnapshot } from "./snapshot.ts";

type Snapshot = Effect.Success<ReturnType<typeof loadSnapshot>>;
const serialize = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const schemaField = (
  field: AddressField,
  required: ReadonlyArray<string>,
  postalPattern: string | undefined,
  country: string,
) => {
  let schema = "text";

  if (field === "addressLines") {
    schema = "addressLines";
  }

  if (field === "postalCode" && postalPattern !== undefined) {
    schema = `postalCode(${country}.postalCodePattern)`;
  }

  if (!required.includes(field)) {
    schema = `Schema.optionalKey(${schema})`;
  }

  return `${field}: ${schema}`;
};

export const formatSource = Effect.fn(function* (file: string, content: string) {
  const result = yield* Effect.tryPromise({
    try: () => format(file, content, formatOptions),
    catch: (cause) => new MetadataError({ message: `Cannot format ${file}.`, cause }),
  });
  if (result.errors.length > 0) {
    return yield* new MetadataError({ message: `Cannot format ${file}.`, cause: result.errors });
  }
  return result.code;
});

const renderCatalog = (codes: ReadonlyArray<string>) => {
  // explicit import paths let bundlers load each country separately
  const countries = codes.map(
    (code) => `
    ${code}: () => import("./countries/${code}.ts")
      .then((module) => module.${code})
  `,
  );

  const regions = codes.map(
    (code) => `
    ${code}: () => import("./regions/${code}.ts")
      .then((module) => module.records)
  `,
  );

  const schemas = codes.map(
    (code) => `
    ${code}: () => import("./schemas/${code}.ts")
      .then((module) => module.${code}AddressSchema)
  `,
  );

  return `export const countryCodes = ${serialize(codes)} as const;
export type CountryCode = typeof countryCodes[number];
const countryLoaders = { ${countries.join(",\n")} };
type RegionLoaders = {
  [Code in CountryCode]: () => Promise<import("../address.ts").RegionData>;
};
const regionLoaders: RegionLoaders = { ${regions.join(",\n")} };
const schemaLoaders = { ${schemas.join(",\n")} };
export const loadCountry = (code: CountryCode) => countryLoaders[code]();
export const loadRegions = (code: CountryCode) => regionLoaders[code]();
export const loadSchema = (code: CountryCode) => schemaLoaders[code]();`;
};

export const renderSnapshot = Effect.fn(function* (snapshot: Snapshot) {
  const files = [
    {
      path: "countries.ts",
      content: renderCatalog(snapshot.aggregates.map(({ country }) => country)),
    },
  ];
  const warnings = new Set<string>();

  for (const source of snapshot.aggregates) {
    const { metadata, warnings: countryWarnings } = yield* normalizeCountry(
      source,
      snapshot.defaults,
    );

    for (const warning of countryWarnings) {
      warnings.add(warning);
    }

    const code = source.country;

    files.push({
      path: `countries/${code}.ts`,
      content: `export const ${code} = ${serialize(metadata)} as const;`,
    });

    const ordered = Object.fromEntries(
      Object.entries(source.records).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    files.push({
      path: `regions/${code}.ts`,
      content: `export const records = ${serialize(ordered)} as const;`,
    });

    const fields = fieldTokens
      .filter(([, field]) => field !== "countryCode")
      .map(([, field]) =>
        schemaField(field, metadata.requiredFields, metadata.postalCodePattern, code),
      );
    const imports = ["text", "addressLines"];

    if (metadata.postalCodePattern !== undefined) {
      imports.push("postalCode");
    }

    files.push({
      path: `schemas/${code}.ts`,
      content: `import * as Schema from "effect/Schema";
import { ${code} } from "../countries/${code}.ts";
import { ${imports.join(", ")} } from "../../schema-fields.ts";

export const validationCoverage = "country" as const;
export const ${code}AddressSchema = Schema.Struct({
  countryCode: Schema.Literal(${code}.countryCode),
  ${fields.join(",\n")}
});`,
    });
  }

  const formatted = yield* Effect.forEach(
    files,
    Effect.fn(function* (file) {
      return {
        path: file.path,
        content: yield* formatSource(file.path, `${header}\n${file.content}\n`),
      };
    }),
    { concurrency: 4 },
  );
  formatted.push({
    path: "NOTICE",
    content: `${notice}\n`,
  });
  return {
    files: formatted.toSorted((a, b) => (a.path < b.path ? -1 : 1)),
    warnings: [...warnings].sort(),
  };
});
