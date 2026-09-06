# addressfield-ts

Address form metadata and [Effect](https://effect.website) validation schemas for 252 countries and territories, based on Google libaddressinput data. Use your own UI components and labels.

[Try the playground](https://addressfield-playground.tobimori.workers.dev)

## Install

```sh
pnpm add addressfield-ts
```

For validation, also install `effect@4.0.0-rc.112`. Forms do not require Effect.

## Build a form

```ts
import { getAddressForm } from "addressfield-ts/forms/CA";

const form = getAddressForm({ administrativeArea: "QC" }, { addressLanguage: "fr-CA" });
```

- `form.fields`: field names, label types, required flags, controls (`text`, `lines`, `select`), autocomplete hints, values, region options, and dependencies.
- `form.rows`: fields grouped in country-specific display order.

Provide your own field labels and country selector. Store street lines as an `addressLines` array. Pass updated values to `getAddressForm` to update dependent region options.

`addressLanguage` selects region labels and native or Latin field order. It does not translate your UI. Region values stay stable: Quebec uses `QC` with either the `Quebec` or `Québec` label.

To load a country on demand:

```ts
import { loadAddressForm } from "addressfield-ts/forms";

const { getAddressForm } = await loadAddressForm("DE");
```

The same entry exports `countryCodes` for the supported countries.

## Validate an address

```ts
import { Schema } from "effect";
import { DEAddressSchema } from "addressfield-ts/schemas/DE";
import { USAddressSchema } from "addressfield-ts/schemas/US";

const AddressSchema = Schema.Union([DEAddressSchema, USAddressSchema]);

const result = Schema.decodeUnknownResult(AddressSchema)({
  countryCode: "DE",
  addressLines: ["Invalidenstraße 116"],
  postalCode: "10115",
  locality: "Berlin",
});
```

Schemas check country codes, required fields, postal-code formats, known regions, and regional postal-code prefixes. Use `loadAddressSchema` from `addressfield-ts/schemas` to load a schema on demand.

For custom error messages, use Effect's `SchemaIssue` formatters. Address checks provide an `addressIssue` annotation with `InvalidPostalCode`, `UnknownRegion`, or `PostalCodeRegionMismatch` data.

Validation does not confirm that an address exists or that mail can be delivered. Regional checks depend on the available Google data. Input values are not trimmed, uppercased, or translated.

## License

Code: [MIT](LICENSE). Google libaddressinput metadata: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with attribution included in the package.
