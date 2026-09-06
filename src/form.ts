import type {
  Address,
  AddressFormField,
  AddressFormValues,
  CountryMetadata,
  RegionData,
} from "./address.ts";
import { resolveRegions, selectAddressLanguage } from "./regions.ts";

export interface FormField {
  readonly name: AddressFormField;
  readonly labelType: string | undefined;
  readonly required: boolean;
  readonly control: "text" | "lines" | "select";
  readonly autocomplete: string;
  readonly dependsOn: AddressFormField | undefined;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly value: string | ReadonlyArray<string> | undefined;
}

export interface AddressFormOptions {
  readonly addressLanguage?: string;
}

const autocomplete = {
  recipient: "name",
  organization: "organization",
  addressLines: "street-address",
  dependentLocality: "address-level3",
  locality: "address-level2",
  administrativeArea: "address-level1",
  postalCode: "postal-code",
  sortingCode: "off",
} satisfies Record<AddressFormField, string>;

const dependencies = {
  recipient: undefined,
  organization: undefined,
  addressLines: undefined,
  dependentLocality: "locality",
  locality: "administrativeArea",
  administrativeArea: undefined,
  postalCode: undefined,
  sortingCode: undefined,
} satisfies Record<AddressFormField, AddressFormField | undefined>;

const labelKind = (field: AddressFormField, country: CountryMetadata) => {
  if (
    field === "postalCode" ||
    field === "administrativeArea" ||
    field === "locality" ||
    field === "dependentLocality"
  ) {
    return country.labels[field];
  }
  return undefined;
};

export const getAddressFormForCountry = (
  country: CountryMetadata,
  records: RegionData,
  values: AddressFormValues = {},
  options: AddressFormOptions = {},
) => {
  const address = { countryCode: country.countryCode, ...values } satisfies Address;
  const language = selectAddressLanguage(country, options.addressLanguage);
  const regions = resolveRegions(address, country, records, options.addressLanguage);
  const rows = language.latin ? (country.latinRows ?? country.rows) : country.rows;
  const ordered = rows.flat();
  const fields = ordered.map((field) => {
    const level = regions.find((region) => region.field === field);
    let control: FormField["control"] = "text";
    if (field === "addressLines") control = "lines";
    if (level !== undefined && level.choices.length > 0) control = "select";
    return {
      name: field,
      labelType: labelKind(field, country),
      required: country.requiredFields.includes(field),
      control,
      autocomplete: autocomplete[field],
      dependsOn: dependencies[field],
      options: level?.choices.map(({ value, label }) => ({ value, label })) ?? [],
      value: values[field],
    } satisfies FormField;
  });
  return {
    countryCode: country.countryCode,
    addressLanguage: language.tag,
    supportedAddressLanguages: country.languages,
    fields,
    rows,
  };
};
