import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { format } from "vite-plus/fmt";

import type { AddressField } from "../../src/address.ts";
import { fieldTokens, normalizeCountry } from "./normalize.ts";
import { formatOptions } from "./format-options.ts";
import { MetadataError } from "./metadata.ts";
import { header, notice } from "./notice.ts";
import type { loadSnapshot } from "./snapshot.ts";

type Snapshot = Effect.Success<ReturnType<typeof loadSnapshot>>;
const serialize = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const regionProperties = new Set<string>([
  "id",
  "name",
  "lname",
  "zip",
  "sub_keys",
  "sub_names",
  "sub_lnames",
  "sub_zips",
  "sub_isoids",
]);

const schemaField = (
  field: AddressField,
  required: ReadonlyArray<string>,
  postalPattern: string | undefined,
  country: string,
) => {
  const isRequired = required.includes(field);
  let schema = isRequired ? "AddressText" : "Schema.optionalKey(AddressText)";

  if (field === "addressLines") {
    schema = isRequired ? "AddressLines" : "Schema.optionalKey(AddressLines)";
  }

  if (field === "postalCode" && postalPattern !== undefined) {
    schema = isRequired ? `postalCode(${country})` : `Schema.optionalKey(postalCode(${country}))`;
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

const renderFormCatalog = (codes: ReadonlyArray<string>) => {
  // Explicit paths let bundlers create one deferred chunk for each country form.
  const forms = codes.map(
    (code) => `
    ${code}: () => import("./forms/${code}.ts")
  `,
  );

  return `export const countryCodes = ${serialize(codes)} as const;
export type CountryCode = typeof countryCodes[number];
const formLoaders = { ${forms.join(",\n")} };
export const loadAddressForm = (code: CountryCode) => formLoaders[code]();`;
};

const renderSchemaCatalog = (codes: ReadonlyArray<string>) => {
  const schemas = codes.map(
    (code) => `
    ${code}: () => import("./schemas/${code}.ts")
      .then((module) => module.${code}AddressSchema)
  `,
  );

  return `import type * as Schema from "effect/Schema";
import type { Address } from "../address.ts";
import type { CountryCode } from "./forms.ts";
export { AddressIssueSchema } from "../validation.ts";
export type { AddressIssue } from "../validation.ts";
const schemaLoaders = { ${schemas.join(",\n")} };
// RETURN TYPE: Keep the declaration independent of all 252 concrete schema types.
export function loadAddressSchema(code: CountryCode): Promise<Schema.Codec<Address>> {
  return schemaLoaders[code]();
}`;
};

export const renderSnapshot = Effect.fn(function* (snapshot: Snapshot) {
  const codes = snapshot.aggregates.map(({ country }) => country);
  const files = [
    {
      path: "forms.ts",
      content: renderFormCatalog(codes),
    },
    {
      path: "schemas.ts",
      content: renderSchemaCatalog(codes),
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
      Object.entries(source.records)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .flatMap(([id, record]) => {
          const projected = Object.fromEntries(
            Object.entries(record).filter(([property]) => regionProperties.has(property)),
          );
          return Object.keys(projected).length === 1 ? [] : [[id, projected]];
        }),
    );
    files.push({
      path: `regions/${code}.ts`,
      content: `export const records = ${serialize(ordered)} as const;`,
    });

    files.push({
      path: `forms/${code}.ts`,
      content: `import type { AddressFormValues } from "../../address.ts";
import { getAddressFormForCountry } from "../../form.ts";
import type { AddressFormOptions } from "../../form.ts";
import { ${code} } from "../countries/${code}.ts";
import { records } from "../regions/${code}.ts";

export const getAddressForm = (
  values: AddressFormValues = {},
  options: AddressFormOptions = {}
) => getAddressFormForCountry(${code}, records, values, options);`,
    });

    const fields = fieldTokens
      .filter(([, field]) => field !== "countryCode")
      .map(([, field]) =>
        schemaField(field, metadata.requiredFields, metadata.postalCodePattern, code),
      );
    const validationImports = [
      "AddressLines",
      "AddressText",
      "addressChecks",
      ...(metadata.postalCodePattern === undefined ? [] : ["postalCode"]),
    ].sort();

    files.push({
      path: `schemas/${code}.ts`,
      content: `import * as Schema from "effect/Schema";
import { ${validationImports.join(", ")} } from "../../validation.ts";
import { ${code} } from "../countries/${code}.ts";
import { records } from "../regions/${code}.ts";

export const ${code}AddressSchema = Schema.Struct({
  countryCode: Schema.Literal(${code}.countryCode),
  ${fields.join(",\n")}
})
  .check(addressChecks(${code}, records))
  .annotate({ identifier: "${code}Address" });`,
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
