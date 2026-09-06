import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Schema } from "effect";

import { getAddressForm as getBYAddressForm } from "./generated/forms/BY.ts";
import { getAddressForm as getCAAddressForm } from "./generated/forms/CA.ts";
import { getAddressForm as getDEAddressForm } from "./generated/forms/DE.ts";
import { getAddressForm as getHKAddressForm } from "./generated/forms/HK.ts";
import { BYAddressSchema } from "./generated/schemas/BY.ts";
import { DEAddressSchema } from "./generated/schemas/DE.ts";
import { USAddressSchema } from "./generated/schemas/US.ts";

const germanAddress = {
  countryCode: "DE",
  addressLines: ["Invalidenstraße 116"],
  postalCode: "10115",
  locality: "Berlin",
} as const;

const americanAddress = {
  countryCode: "US",
  addressLines: ["1600 Amphitheatre Parkway"],
  locality: "Mountain View",
  administrativeArea: "CA",
  postalCode: "94043",
} as const;

describe("country forms and schemas", () => {
  it("keeps country selection outside the German form", () => {
    const form = getDEAddressForm({ locality: "Berlin" });

    expect(form.fields.map((field) => field.name)).toEqual([
      "recipient",
      "organization",
      "addressLines",
      "postalCode",
      "locality",
    ]);
    expect(form.rows).toEqual([
      ["recipient"],
      ["organization"],
      ["addressLines"],
      ["postalCode", "locality"],
    ]);
    expect(form.fields.find((field) => field.name === "locality")?.dependsOn).toBeUndefined();
  });

  it("returns semantic label data without application copy", () => {
    const form = getDEAddressForm();

    expect(form.fields.find((field) => field.name === "postalCode")?.labelType).toBe("postal");
  });

  // Belarus uses non-Latin keys that differ from the Russian display labels
  it("preserves non-Latin region keys when labels are translated", () => {
    const native = getBYAddressForm();
    const russian = getBYAddressForm({}, { addressLanguage: "ru" });
    const nativeRegions = native.fields.find(
      (field) => field.name === "administrativeArea",
    )?.options;
    const russianRegions = russian.fields.find(
      (field) => field.name === "administrativeArea",
    )?.options;
    const brest = russianRegions?.find((region) => region.label === "Брестская область");

    expect(russianRegions?.map((region) => region.value).toSorted()).toEqual(
      nativeRegions?.map((region) => region.value).toSorted(),
    );
    expect(brest?.value).toBe("Брэсцкая вобласць");
    if (brest === undefined) throw new Error("Missing Russian Brest region.");
    expect(
      Schema.decodeSync(BYAddressSchema)({
        countryCode: "BY",
        addressLines: ["вуліца Леніна, 1"],
        locality: "Брэст",
        administrativeArea: brest.value,
      }).administrativeArea,
    ).toBe("Брэсцкая вобласць");
  });

  // Canada uses short region codes and supports regional language tags.
  it("translates labels for a regional language tag without changing region codes", () => {
    const english = getCAAddressForm();
    const french = getCAAddressForm({}, { addressLanguage: "fr-CA" });
    const englishRegions = english.fields.find(
      (field) => field.name === "administrativeArea",
    )?.options;
    const frenchRegions = french.fields.find(
      (field) => field.name === "administrativeArea",
    )?.options;

    expect(englishRegions?.find((region) => region.value === "QC")?.label).toBe("Quebec");
    expect(frenchRegions?.find((region) => region.value === "QC")?.label).toBe("Québec");
    expect(frenchRegions?.map((region) => region.value).toSorted()).toEqual(
      englishRegions?.map((region) => region.value).toSorted(),
    );
  });

  it("uses Latin field order for English Hong Kong addresses", () => {
    const native = getHKAddressForm();
    const english = getHKAddressForm({}, { addressLanguage: "en" });

    expect(native.rows.at(-1)).toEqual(["recipient"]);
    expect(english.rows[0]).toEqual(["recipient"]);
    expect(english.addressLanguage).toBe("en");
  });

  it("decodes complete German and regional US addresses", () => {
    const german = Schema.decodeSync(DEAddressSchema)(germanAddress);
    const american = Schema.decodeSync(USAddressSchema)(americanAddress);
    expectTypeOf(german.countryCode).toEqualTypeOf<"DE">();
    expectTypeOf(american.countryCode).toEqualTypeOf<"US">();

    expect(german).toEqual(germanAddress);
    expect(american).toEqual(americanAddress);
  });

  it("combines country schemas with Schema.Union", () => {
    const AddressSchema = Schema.Union([DEAddressSchema, USAddressSchema]);
    const decode = Schema.decodeSync(AddressSchema);

    expect(decode(germanAddress)).toEqual(germanAddress);
    expect(decode(americanAddress)).toEqual(americanAddress);
  });
});
