import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

import type { Address, CountryMetadata, RegionData } from "./address.ts";
import { resolveRegions } from "./regions.ts";

const RegionFieldSchema = Schema.Literals(["administrativeArea", "locality", "dependentLocality"]);

class InvalidPostalCode extends Schema.TaggedError<InvalidPostalCode>()("InvalidPostalCode", {
  field: Schema.Literal("postalCode"),
  countryCode: Schema.String,
  examples: Schema.Array(Schema.String),
}) {}

class UnknownRegion extends Schema.TaggedError<UnknownRegion>()("UnknownRegion", {
  field: RegionFieldSchema,
  parent: Schema.Union([Schema.String, Schema.Undefined]),
}) {}

class PostalCodeRegionMismatch extends Schema.TaggedError<PostalCodeRegionMismatch>()(
  "PostalCodeRegionMismatch",
  {
    field: Schema.Literal("postalCode"),
    regionField: RegionFieldSchema,
    region: Schema.String,
  },
) {}

export const AddressIssueSchema = Schema.Union([
  InvalidPostalCode,
  UnknownRegion,
  PostalCodeRegionMismatch,
]);
export type AddressIssue = typeof AddressIssueSchema.Type;

export const AddressText = Schema.String.check(Schema.isPattern(/\S/u));
export const AddressLines = Schema.NonEmptyArray(AddressText);

export const postalCode = (country: CountryMetadata) => {
  const pattern = new RegExp(`^(?:${country.postalCodePattern ?? "[\\s\\S]*"})$`, "iu");
  return AddressText.check(
    Schema.makeFilter((value) => {
      // A final newline can satisfy `$`, so also compare the complete match.
      return pattern.exec(value)?.[0] === value
        ? undefined
        : new SchemaIssue.InvalidValue({
            addressIssue: new InvalidPostalCode({
              field: "postalCode",
              countryCode: country.countryCode,
              examples: country.postalCodeExamples,
            }),
          });
    }),
  );
};

export const addressChecks = (country: CountryMetadata, records: RegionData) =>
  Schema.makeFilter<Address>((address) => {
    const issues: Array<Schema.FilterIssue> = [];
    const levels = resolveRegions(address, country, records);
    let parent: string | undefined;
    let postalRegion:
      | {
          readonly field: (typeof levels)[number]["field"];
          readonly value: string;
          readonly pattern: string;
        }
      | undefined;

    for (const level of levels) {
      const value = address[level.field];
      if (value === undefined || value.trim() === "") break;
      if (level.choices.length > 0 && level.selected === undefined) {
        issues.push({
          path: [level.field],
          issue: new SchemaIssue.InvalidValue({
            addressIssue: new UnknownRegion({ field: level.field, parent }),
          }),
        });
        break;
      }
      if (level.selected !== undefined) {
        parent = level.selected.value;
        if (level.selected.pattern !== undefined && level.selected.pattern.length > 0) {
          postalRegion = {
            field: level.field,
            value: level.selected.value,
            pattern: level.selected.pattern,
          };
        }
      }
    }

    if (
      address.postalCode !== undefined &&
      postalRegion !== undefined &&
      !new RegExp(`^(?:${postalRegion.pattern})`, "iu").test(address.postalCode)
    ) {
      issues.push({
        path: ["postalCode"],
        issue: new SchemaIssue.InvalidValue({
          addressIssue: new PostalCodeRegionMismatch({
            field: "postalCode",
            regionField: postalRegion.field,
            region: postalRegion.value,
          }),
        }),
      });
    }

    return issues;
  });
