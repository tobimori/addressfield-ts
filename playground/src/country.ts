import * as Schema from "effect/Schema";
import { loadAddressForm } from "addressfield-ts/forms";
import type { CountryCode } from "addressfield-ts/forms";
import { loadAddressSchema } from "addressfield-ts/schemas";

const loadCountryData = (code: CountryCode) =>
  Promise.all([loadAddressForm(code), loadAddressSchema(code)]).then(([form, addressSchema]) => ({
    code,
    getAddressForm: form.getAddressForm,
    decode: Schema.decodeUnknownResult(addressSchema, {
      errors: "all",
      onExcessProperty: "error",
    }),
  }));

export type CountryData = Awaited<ReturnType<typeof loadCountryData>>;

const countries = new Map<CountryCode, Promise<CountryData>>();

export function getCountry(code: CountryCode) {
  let promise = countries.get(code);

  if (!promise) {
    promise = loadCountryData(code);
    countries.set(code, promise);
  }

  return promise;
}
