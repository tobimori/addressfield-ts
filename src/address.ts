/** A validated postal address. Country schemas enforce country-specific requirements. */
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
export type AddressFormField = Exclude<AddressField, "countryCode">;
export type AddressFormValues = Omit<Address, "countryCode">;

export interface RegionRecord {
  readonly id: string;
  readonly name?: string;
  readonly lname?: string;
  readonly zip?: string;
  readonly sub_keys?: string;
  readonly sub_names?: string;
  readonly sub_lnames?: string;
  readonly sub_zips?: string;
  readonly sub_isoids?: string;
}

export interface RegionData {
  readonly [id: string]: RegionRecord | undefined;
}

/** Postal rules and form metadata generated from one country record. */
export interface CountryMetadata {
  readonly countryCode: string;
  readonly rows: ReadonlyArray<ReadonlyArray<AddressFormField>>;
  readonly latinRows?: ReadonlyArray<ReadonlyArray<AddressFormField>>;
  readonly requiredFields: ReadonlyArray<AddressField>;
  readonly postalCodePattern?: string;
  readonly postalCodeExamples: ReadonlyArray<string>;
  readonly language?: string;
  readonly languages: ReadonlyArray<string>;
  readonly labels: {
    readonly administrativeArea?: string;
    readonly postalCode?: string;
    readonly locality?: string;
    readonly dependentLocality?: string;
  };
}
