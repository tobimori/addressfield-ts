import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { countryCodes, loadAddressForm } from "./generated/forms.ts";
import { getAddressForm as getKRAddressForm } from "./generated/forms/KR.ts";
import { getAddressForm as getTWAddressForm } from "./generated/forms/TW.ts";

// Behavior cases adapted from Google libaddressinput (Apache-2.0):
// https://github.com/google/libaddressinput/blob/81eb9628382b07d371d8ea0b11badf7de3857fd5/cpp/test/address_ui_test.cc
// https://github.com/google/libaddressinput/blob/81eb9628382b07d371d8ea0b11badf7de3857fd5/cpp/test/region_data_builder_test.cc
// https://github.com/google/libaddressinput/blob/81eb9628382b07d371d8ea0b11badf7de3857fd5/common/src/test/java/com/google/i18n/addressinput/common/FormatInterpreterTest.java
// Current metadata supplies the names; our API combines street lines in one field
describe("country form contracts", () => {
  it.effect.each(countryCodes)(
    "%s has unique fields and matching layout rows",
    Effect.fn(function* (countryCode: (typeof countryCodes)[number]) {
      const { getAddressForm } = yield* Effect.promise(() => loadAddressForm(countryCode));
      const native = getAddressForm();

      for (const addressLanguage of new Set([
        undefined,
        ...native.supportedAddressLanguages,
        "en",
      ])) {
        const form =
          addressLanguage === undefined ? native : getAddressForm({}, { addressLanguage });
        const names = form.fields.map((field) => field.name);
        expect(form.countryCode).toBe(countryCode);
        expect(names.length).toBeGreaterThan(0);
        expect(new Set(names).size).toBe(names.length);
        expect(names).not.toContain("countryCode");
        expect(form.rows.flat()).toEqual(names);
        expect(form.rows.every((row) => row.length > 0)).toBe(true);
        for (const field of form.fields) {
          if (field.dependsOn !== undefined) {
            expect(names).toContain(field.dependsOn);
            expect(field.dependsOn).not.toBe(field.name);
          }
        }
      }
    }),
  );
});

describe("address script", () => {
  // Korea distinguishes a stable Korean key from native and Latin display names
  it.each([
    { addressLanguage: "ko-KR", expectedLanguage: "ko", label: "강원" },
    { addressLanguage: "ko-Latn", expectedLanguage: "ko-Latn", label: "Gangwon-do" },
  ])(
    "uses $addressLanguage labels without changing region keys",
    ({ addressLanguage, expectedLanguage, label }) => {
      const form = getKRAddressForm({}, { addressLanguage });
      const regions = form.fields.find((field) => field.name === "administrativeArea");
      expect(form.addressLanguage).toBe(expectedLanguage);
      expect(regions?.options).toContainEqual({ value: "강원도", label });
    },
  );

  // Taiwan has different native and Latin layouts, not just translated labels
  it.each([
    {
      addressLanguage: "zh-Hant",
      rows: [
        ["postalCode"],
        ["administrativeArea", "locality"],
        ["addressLines"],
        ["organization"],
        ["recipient"],
      ],
    },
    {
      addressLanguage: "zh-Latn",
      rows: [
        ["recipient"],
        ["organization"],
        ["addressLines"],
        ["locality", "administrativeArea", "postalCode"],
      ],
    },
  ])("uses the complete $addressLanguage layout", ({ addressLanguage, rows }) => {
    expect(getTWAddressForm({}, { addressLanguage }).rows).toEqual(rows);
  });
});

describe("dependent region choices", () => {
  // Taiwan provides district choices below cities; Germany and the US do not
  it("replaces child choices when the parent changes and clears them when it is absent", () => {
    const taipei = getTWAddressForm({ administrativeArea: "台北市" });
    const kaohsiung = getTWAddressForm({ administrativeArea: "高雄市" });
    const unselected = getTWAddressForm();
    const taipeiDistricts = taipei.fields.find((field) => field.name === "locality");
    const kaohsiungDistricts = kaohsiung.fields.find((field) => field.name === "locality");
    const unselectedDistricts = unselected.fields.find((field) => field.name === "locality");

    expect(taipeiDistricts).toMatchObject({ control: "select", dependsOn: "administrativeArea" });
    expect(taipeiDistricts?.options).toContainEqual({ value: "大安區", label: "大安區" });
    expect(kaohsiungDistricts).toMatchObject({
      control: "select",
      dependsOn: "administrativeArea",
    });
    expect(kaohsiungDistricts?.options).toContainEqual({ value: "三民區", label: "三民區" });
    expect(kaohsiungDistricts?.options.map((option) => option.value)).not.toContain("大安區");
    expect(unselectedDistricts).toMatchObject({ control: "text", options: [] });
  });
});
