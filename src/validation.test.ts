import { describe, expect, it } from "@effect/vitest";
import { Match, Predicate, Result, Schema, SchemaIssue } from "effect";

import { DEAddressSchema } from "./generated/schemas/DE.ts";
import { USAddressSchema } from "./generated/schemas/US.ts";
import { AddressIssueSchema } from "./validation.ts";
import type { AddressIssue } from "./validation.ts";

// Behavior cases adapted from Google libaddressinput (Apache-2.0):
// https://github.com/google/libaddressinput/blob/81eb9628382b07d371d8ea0b11badf7de3857fd5/cpp/test/address_validator_test.cc
// https://github.com/google/libaddressinput/blob/81eb9628382b07d371d8ea0b11badf7de3857fd5/common/src/test/java/com/google/i18n/addressinput/common/StandardAddressVerifierTest.java
// Tests use this library's Effect schema contract, not upstream's problem map
const addressIssueName = Match.type<AddressIssue>().pipe(
  Match.tagsExhaustive({
    InvalidPostalCode: () => "InvalidPostalCode",
    UnknownRegion: () => "UnknownRegion",
    PostalCodeRegionMismatch: () => "PostalCodeRegionMismatch",
  }),
);

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1({
  checkHook: (issue) => {
    if (!Predicate.isTagged(issue.issue, "InvalidValue")) return undefined;
    const annotation = issue.issue.annotations?.["addressIssue"];
    return Schema.is(AddressIssueSchema)(annotation) ? addressIssueName(annotation) : undefined;
  },
  leafHook: (issue) => {
    if (Predicate.isTagged(issue, "InvalidValue")) {
      const annotation = issue.annotations?.["addressIssue"];
      if (Schema.is(AddressIssueSchema)(annotation)) return addressIssueName(annotation);
    }
    if (Predicate.isTagged(issue, "MissingKey")) return "MissingKey";
    if (Predicate.isTagged(issue, "InvalidType")) return "InvalidType";
    return SchemaIssue.defaultLeafHook(issue);
  },
});

const americanAddress = {
  countryCode: "US",
  addressLines: ["1600 Amphitheatre Parkway"],
  locality: "Mountain View",
  administrativeArea: "CA",
  postalCode: "94043",
} as const;

const decodeUS = Schema.decodeUnknownResult(USAddressSchema, { errors: "all" });

const rejectedIssues = (result: ReturnType<typeof decodeUS>) => {
  if (Result.isSuccess(result)) throw new Error("Expected address validation to fail.");
  return formatIssues(result.failure.issue).issues;
};

describe("address validation", () => {
  it.each(["addressLines", "locality", "administrativeArea", "postalCode", "countryCode"])(
    "rejects a missing required field: %s",
    (field) => {
      const input = Object.fromEntries(
        Object.entries(americanAddress).filter(([key]) => key !== field),
      );
      expect(rejectedIssues(decodeUS(input))).toEqual([{ path: [field], message: "MissingKey" }]);
    },
  );

  it.each(["DE", "QZ"])("rejects country code %s in a US schema", (countryCode) => {
    expect(rejectedIssues(decodeUS({ ...americanAddress, countryCode }))).toEqual([
      { path: ["countryCode"], message: "InvalidType" },
    ]);
  });

  it("reports all missing required fields", () => {
    const issues = rejectedIssues(decodeUS({ countryCode: "US" }));
    expect(issues).toHaveLength(4);
    expect(issues).toEqual(
      expect.arrayContaining([
        { path: ["addressLines"], message: "MissingKey" },
        { path: ["locality"], message: "MissingKey" },
        { path: ["administrativeArea"], message: "MissingKey" },
        { path: ["postalCode"], message: "MissingKey" },
      ]),
    );
  });

  it("rejects an unknown region at that field", () => {
    expect(
      rejectedIssues(decodeUS({ ...americanAddress, administrativeArea: "not-a-state" })),
    ).toEqual([{ path: ["administrativeArea"], message: "UnknownRegion" }]);
  });

  it("distinguishes a malformed postal code from a regional mismatch", () => {
    expect(rejectedIssues(decodeUS({ ...americanAddress, postalCode: "123" }))).toEqual([
      { path: ["postalCode"], message: "InvalidPostalCode" },
    ]);
    expect(rejectedIssues(decodeUS({ ...americanAddress, postalCode: "10001" }))).toEqual([
      { path: ["postalCode"], message: "PostalCodeRegionMismatch" },
    ]);
  });

  it.each(["invalid", "10115\n", "10115extra", " 10115"])(
    "rejects a postal code that does not match the complete country pattern: %j",
    (postalCode) => {
      const result = Schema.decodeResult(DEAddressSchema)({
        countryCode: "DE",
        addressLines: ["Invalidenstraße 116"],
        locality: "Berlin",
        postalCode,
      });
      if (Result.isSuccess(result)) throw new Error("Expected an invalid postal code.");
      expect(formatIssues(result.failure.issue).issues).toEqual([
        { path: ["postalCode"], message: "InvalidPostalCode" },
      ]);
    },
  );

  it.each([{ addressLines: [] }, { addressLines: [""] }, { addressLines: ["   "] }])(
    "rejects empty address lines: $addressLines",
    ({ addressLines }) => {
      const issues = rejectedIssues(decodeUS({ ...americanAddress, addressLines }));
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((issue) => issue.path?.[0] === "addressLines")).toBe(true);
    },
  );
});
