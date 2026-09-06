import * as Schema from "effect/Schema";
import { loadCountry, loadRegions, loadSchema } from "addressfield-ts/countries";
import type { CountryCode } from "addressfield-ts/countries";
import { withRegions } from "addressfield-ts/schemas";

async function loadCountryData(code: CountryCode) {
  const [country, regions, addressSchema] = await Promise.all([
    loadCountry(code),
    loadRegions(code),
    loadSchema(code),
  ]);

  return {
    country,
    regions,
    decode: Schema.decodeUnknownSync(withRegions(addressSchema, { regions }), {
      errors: "all",
      onExcessProperty: "error",
    }),
  };
}

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
