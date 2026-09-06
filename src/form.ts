import type { Address, AddressField, AddressOptions, CountryMetadata } from "./address.ts";
import { resolveRegions } from "./regions.ts";
import { fieldTokens } from "./fields.ts";

export interface FormField {
  readonly name: AddressField;
  readonly label: string;
  readonly required: boolean;
  readonly control: "hidden" | "text" | "lines" | "select";
  readonly autocomplete: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly value: string | ReadonlyArray<string> | undefined;
}

export interface FormOptions extends AddressOptions {
  readonly values?: Address;
  readonly labels?: Partial<Record<AddressField, string>>;
  readonly latin?: boolean;
}

const labels = {
  countryCode: "Country",
  recipient: "Full name",
  organization: "Company",
  addressLines: "Street address",
  dependentLocality: "Neighborhood",
  locality: "City",
  administrativeArea: "State / province",
  postalCode: "Postal code",
  sortingCode: "Sorting code",
} satisfies Record<AddressField, string>;

const autocomplete = {
  countryCode: "country",
  recipient: "name",
  organization: "organization",
  addressLines: "street-address",
  dependentLocality: "address-level3",
  locality: "address-level2",
  administrativeArea: "address-level1",
  postalCode: "postal-code",
  sortingCode: "off",
} satisfies Record<AddressField, string>;

const tokens = new Map<string, AddressField>(fieldTokens);

const labelFor = (field: AddressField, country: CountryMetadata) => {
  if (field === "postalCode")
    return country.labels.postalCode === "zip" ? "ZIP code" : "Postal code";
  if (field === "administrativeArea" || field === "locality" || field === "dependentLocality") {
    const category = country.labels[field];
    if (category)
      return category.replaceAll("_", " ").replace(/^./u, (letter) => letter.toUpperCase());
  }
  return labels[field];
};

export const getAddressForm = (country: CountryMetadata, options: FormOptions = {}) => {
  const values = options.values ?? { countryCode: country.countryCode };
  const regions = resolveRegions({ ...values, countryCode: country.countryCode }, options);
  const format = options.latin ? (country.latinFormat ?? country.format) : country.format;
  const seen = new Set<AddressField>();
  const rows = format
    .split("%n")
    .map((line) => {
      const row: AddressField[] = [];
      for (const [, token] of line.matchAll(/%([A-Z])/gu)) {
        const field = tokens.get(token ?? "");
        if (field !== undefined && field !== "countryCode" && !seen.has(field)) {
          row.push(field);
          seen.add(field);
        }
      }
      return row;
    })
    .filter((row) => row.length > 0);
  for (const field of country.requiredFields) {
    if (field !== "countryCode" && !seen.has(field)) {
      rows.push([field]);
      seen.add(field);
    }
  }
  const ordered: AddressField[] = ["countryCode", ...rows.flat()];
  const fields = ordered.map((field) => {
    const level = regions.find((region) => region.field === field);
    let control: FormField["control"] = "text";
    if (field === "countryCode") control = "hidden";
    if (field === "addressLines") control = "lines";
    if (level && level.choices.length > 0) control = "select";
    return {
      name: field,
      label: options.labels?.[field] ?? labelFor(field, country),
      required: field === "countryCode" || country.requiredFields.includes(field),
      control,
      autocomplete: autocomplete[field],
      options: level?.choices.map(({ value, label }) => ({ value, label })) ?? [],
      value: field === "countryCode" ? country.countryCode : values[field],
    } satisfies FormField;
  });
  return { countryCode: country.countryCode, fields, rows, format };
};
