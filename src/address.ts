/** Shared address input. Generated country schemas enforce submission requirements. */
export interface Address {
  readonly countryCode: string;
  readonly recipient?: string;
  readonly organization?: string;
  readonly addressLines?: ReadonlyArray<string>;
  readonly dependentLocality?: string;
  readonly locality?: string;
  readonly administrativeArea?: string;
  readonly postalCode?: string;
  readonly sortingCode?: string;
}

export type AddressField = keyof Address;

export const addressFields = [
  "countryCode",
  "recipient",
  "organization",
  "addressLines",
  "dependentLocality",
  "locality",
  "administrativeArea",
  "postalCode",
  "sortingCode",
] as const satisfies ReadonlyArray<AddressField>;

export interface AddressIssue {
  readonly field: AddressField;
  readonly code: "required" | "country" | "postalCode" | "region" | "regionData";
  readonly message: string;
}

export interface RegionRecord {
  readonly id: string;
  readonly key?: string;
  readonly name?: string;
  readonly lang?: string;
  readonly zip?: string;
  readonly sub_keys?: string;
  readonly sub_names?: string;
  readonly sub_lnames?: string;
  readonly sub_zips?: string;
}

export interface RegionData {
  readonly [id: string]: RegionRecord | undefined;
}

export interface AddressOptions {
  readonly regions?: RegionData;
  readonly language?: string;
}

/** Postal rules and form metadata, independent of a validation framework. */
export interface CountryMetadata {
  readonly countryCode: string;
  readonly format: string;
  readonly latinFormat?: string;
  readonly fields: ReadonlyArray<AddressField>;
  readonly requiredFields: ReadonlyArray<AddressField>;
  readonly uppercaseFields: ReadonlyArray<AddressField>;
  readonly postalCodePattern?: string;
  readonly language?: string;
  readonly languages?: ReadonlyArray<string>;
  readonly labels: {
    readonly administrativeArea?: string;
    readonly postalCode?: string;
    readonly locality?: string;
    readonly dependentLocality?: string;
  };
}
