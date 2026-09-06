import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class MetadataError extends Schema.TaggedError<MetadataError>()("MetadataError", {
  message: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {}

const countryList = Schema.Struct({
  id: Schema.Literal("data"),
  countries: Schema.String.check(Schema.isPattern(/^[A-Z]{2}(?:~[A-Z]{2})*$/u)),
});

const metadataRecord = Schema.Struct({
  id: Schema.String,
  key: Schema.optionalKey(Schema.String),
  name: Schema.optionalKey(Schema.String),
  fmt: Schema.optionalKey(Schema.String),
  lfmt: Schema.optionalKey(Schema.String),
  require: Schema.optionalKey(Schema.String),
  upper: Schema.optionalKey(Schema.String),
  zip: Schema.optionalKey(Schema.String),
  zipex: Schema.optionalKey(Schema.String),
  lang: Schema.optionalKey(Schema.String),
  languages: Schema.optionalKey(Schema.String),
  sub_keys: Schema.optionalKey(Schema.String),
  sub_names: Schema.optionalKey(Schema.String),
  sub_lnames: Schema.optionalKey(Schema.String),
  sub_zips: Schema.optionalKey(Schema.String),
  sub_zipexs: Schema.optionalKey(Schema.String),
  sub_isoids: Schema.optionalKey(Schema.String),
  zip_name_type: Schema.optionalKey(Schema.String),
  state_name_type: Schema.optionalKey(Schema.String),
  locality_name_type: Schema.optionalKey(Schema.String),
  sublocality_name_type: Schema.optionalKey(Schema.String),
});

const defaults = Schema.Struct({
  ...metadataRecord.fields,
  id: Schema.Literal("data/ZZ"),
  fmt: Schema.String,
  require: Schema.String,
});

const aggregate = Schema.Record(Schema.String, metadataRecord);

export const readCountries = Effect.fn(function* (text: string) {
  const record = yield* Schema.decodeEffect(Schema.fromJsonString(countryList))(text);
  const countries = record.countries.split("~");
  if (new Set(countries).size !== countries.length || countries.includes("ZZ")) {
    return yield* new MetadataError({
      message: "The country list contains duplicate or reserved codes.",
    });
  }
  return countries.toSorted();
});

export const readDefaults = Schema.decodeEffect(Schema.fromJsonString(defaults));

export const readAggregate = Effect.fn(function* (country: string, text: string) {
  const records = yield* Schema.decodeEffect(Schema.fromJsonString(aggregate))(text);
  const root = `data/${country}`;
  if (!Object.hasOwn(records, root)) {
    return yield* new MetadataError({ message: `Missing country record: ${root}.` });
  }
  for (const [key, record] of Object.entries(records)) {
    if (
      record.id !== key ||
      !(key === root || key.startsWith(`${root}/`) || key.startsWith(`${root}--`))
    ) {
      return yield* new MetadataError({
        message: `Unexpected metadata record for ${country}: ${key}.`,
      });
    }
  }
  return records;
});

export const selectCountries = Effect.fn(function* (
  selection: string,
  supported: ReadonlyArray<string>,
) {
  const input = selection.trim().toUpperCase();
  if (input === "ALL") return supported.toSorted();

  const countries = [...new Set(input.split(",").map((country) => country.trim()))].sort();
  const invalid = countries.filter((country) => !supported.includes(country));
  if (invalid.length > 0) {
    return yield* new MetadataError({
      message: `Unsupported country selection: ${invalid.join(", ") || "(empty)"}. Use all or comma-separated country codes.`,
    });
  }
  return countries;
});
