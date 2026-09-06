import * as Effect from "effect/Effect";

import type { AddressField } from "../../src/address.ts";
import { fieldTokens } from "../../src/fields.ts";
import { MetadataError } from "./metadata.ts";
import type { loadSnapshot } from "./snapshot.ts";

type Snapshot = Effect.Success<ReturnType<typeof loadSnapshot>>;
type CountrySource = Snapshot["aggregates"][number];

const fieldForToken = (token: string) => fieldTokens.find(([key]) => key === token)?.[1];

const readFields = Effect.fn(function* (tokens: string, source: string) {
  const fields = new Set<AddressField>();
  for (const token of tokens) {
    const field = fieldForToken(token);
    if (field === undefined) {
      return yield* new MetadataError({ message: `Unsupported field ${token} in ${source}.` });
    }
    fields.add(field);
  }
  return [...fields];
});

const checkPatterns = Effect.fn(function* (source: CountrySource) {
  for (const [id, record] of Object.entries(source.records)) {
    if (record.require !== undefined) yield* readFields(record.require, id);
    const patterns = [record.zip, ...(record.sub_zips?.split("~") ?? [])];
    for (const pattern of patterns) {
      if (pattern === undefined || pattern === "") continue;
      yield* Effect.try({
        try: () => new RegExp(`^(?:${pattern})$`, "iu"),
        catch: (cause) =>
          new MetadataError({ message: `Unsupported postal pattern in ${id}: ${pattern}.`, cause }),
      });
    }
  }
});

export const normalizeCountry = Effect.fn(function* (
  source: CountrySource,
  defaults: Snapshot["defaults"],
) {
  const record = source.records[`data/${source.country}`];
  if (record === undefined) {
    return yield* new MetadataError({ message: `Missing country record: ${source.country}.` });
  }
  const format = record.fmt ?? defaults.fmt;
  const latinFormat = record.lfmt ?? defaults.lfmt;
  const requiredFields = [
    ...new Set<AddressField>([
      "countryCode",
      ...(yield* readFields(record.require ?? defaults.require, record.id)),
    ]),
  ];
  const uppercaseFields = yield* readFields(record.upper ?? defaults.upper ?? "", record.id);
  const fields = new Set<AddressField>(["countryCode"]);
  const warnings = new Set<string>();
  for (const layout of [format, latinFormat]) {
    if (layout === undefined) continue;
    for (const [, token] of layout.matchAll(/%([\s\S])/gu)) {
      if (token === undefined || token === "n") continue;
      const field = fieldForToken(token);
      if (field === undefined) {
        warnings.add(`${source.country}: unknown format token %${token}; layout preserved.`);
      } else {
        fields.add(field);
      }
    }
    if (layout.endsWith("%"))
      warnings.add(`${source.country}: incomplete format token; layout preserved.`);
  }
  for (const field of requiredFields) fields.add(field);
  const postalCodePattern = (record.zip ?? defaults.zip) || undefined;
  // inherited postal patterns need validation too
  yield* checkPatterns({
    ...source,
    records: { ...source.records, [record.id]: { ...record, zip: postalCodePattern ?? "" } },
  });
  return {
    metadata: {
      countryCode: source.country,
      format,
      latinFormat,
      fields: [...fields],
      requiredFields,
      uppercaseFields,
      postalCodePattern,
      language: record.lang ?? defaults.lang,
      languages: (record.languages ?? defaults.languages)?.split("~"),
      labels: {
        administrativeArea: record.state_name_type ?? defaults.state_name_type,
        postalCode: record.zip_name_type ?? defaults.zip_name_type,
        locality: record.locality_name_type ?? defaults.locality_name_type,
        dependentLocality: record.sublocality_name_type ?? defaults.sublocality_name_type,
      },
    },
    warnings: [...warnings].sort(),
  };
});
