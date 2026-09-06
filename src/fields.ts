import type { AddressField } from "./address.ts";

/** Google format tokens, shared by code generation and form layout. */
export const fieldTokens = [
  ["R", "countryCode"],
  ["N", "recipient"],
  ["O", "organization"],
  ["A", "addressLines"],
  ["D", "dependentLocality"],
  ["C", "locality"],
  ["S", "administrativeArea"],
  ["Z", "postalCode"],
  ["X", "sortingCode"],
] as const satisfies ReadonlyArray<readonly [string, AddressField]>;
