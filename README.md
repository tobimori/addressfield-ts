# addressfield-ts

Country-specific address forms and Effect schemas for 252 countries and territories, generated from Google libaddressinput data.

- Combine backend validation with `Schema.Union`
- Load each frontend country form separately
- Keep country selection outside the address form
- Use Google address-language variants for regional names
- Customize field labels and validation messages

[Try the playground](https://addressfield-playground.tobimori.workers.dev)

## Install

```sh
pnpm add addressfield-ts
```

Backend schema users must also install the supported Effect release:

```sh
pnpm add effect@4.0.0-rc.112
```

Form entries do not import Effect.

## Validate addresses

Import the countries that the backend accepts and combine them directly:

```ts
import * as Schema from "effect/Schema";
import { DEAddressSchema } from "addressfield-ts/schemas/DE";
import { USAddressSchema } from "addressfield-ts/schemas/US";

const AddressSchema = Schema.Union([DEAddressSchema, USAddressSchema]);

const decodeAddress = Schema.decodeUnknownEffect(AddressSchema, {
  errors: "all",
  onExcessProperty: "error",
});
```

Each country schema checks its literal `countryCode`, required fields, postal-code format, known regional values, and regional postal-code prefixes.

Country schemas are normal Effect schemas. Nest them in an application schema to add application fields:

```ts
const DeliveryRequest = Schema.Struct({
  address: AddressSchema,
  deliveryInstructions: Schema.optionalKey(Schema.String),
});
```

## Customize validation messages

Country modules export one immutable schema. They do not create locale-specific schema instances.

Validation failures retain Effect's `SchemaIssue` tree. Address checks attach an `addressIssue` annotation with a `Schema.TaggedError` value, such as `InvalidPostalCode` or `UnknownRegion`. Applications can map these annotations with `SchemaIssue.makeFormatterStandardSchemaV1` hooks.

The library does not supply user-facing error text.

## Build a country form

The application owns the country selector. Load the selected country's form separately:

```ts
import { getAddressForm } from "addressfield-ts/forms/DE";

const form = getAddressForm({
  locality: "Berlin",
  postalCode: "10115",
});
```

`form.fields` contains:

- `name`, semantic `labelType`, and `required`
- `control`: `text`, `lines`, or `select`
- `autocomplete`
- regional `options`
- the current `value`
- `dependsOn` for regional parent fields

`form.rows` contains the country-specific field order. It never contains `countryCode`.

Add the selected country when the form is submitted:

```ts
const input = {
  countryCode: selectedCountry,
  ...formValues,
};
```

## Load forms on demand

The form catalog uses explicit dynamic imports:

```ts
import { countryCodes, loadAddressForm } from "addressfield-ts/forms";

const { getAddressForm } = await loadAddressForm("CA");
const form = getAddressForm(values);
```

This loads one country form module. It does not eagerly load all country forms.

A dynamic schema catalog is also available for applications that select backend rules at runtime:

```ts
import { loadAddressSchema } from "addressfield-ts/schemas";

const addressSchema = await loadAddressSchema("CA");
```

For a fixed backend country set, use direct schema imports and `Schema.Union` instead.

Applications can also define a smaller explicit form loader table:

```ts
const formLoaders = {
  DE: () => import("addressfield-ts/forms/DE"),
  US: () => import("addressfield-ts/forms/US"),
} as const;
```

## Address language

Address language controls Google regional names and native or Latin field order. It does not control application UI text.

```ts
import { getAddressForm } from "addressfield-ts/forms/CA";

const form = getAddressForm(values, {
  addressLanguage: "fr-CA",
});
```

For Canada, this produces labels such as `Québec`. Region option values remain stable keys such as `QC`.

## Field labels

The library returns semantic label data, not user-facing UI text:

```ts
const form = getAddressForm(values);
const postalField = form.fields.find((field) => field.name === "postalCode");

postalField?.name; // "postalCode"
postalField?.labelType; // "postal"
```

The application maps `name` and `labelType` to its own copy. It can use i18next, Lingui, FormatJS, or another localization system. This keeps all UI language and product wording outside the library.

## Address lines

`addressLines` is an array. Google metadata does not define one fixed number of street-address controls. A UI can use a multiline control or several inputs.

## Limits

- Validation does not confirm address existence or mail delivery.
- Regional checks cover only regions present in Google metadata.
- Address values are not trimmed, uppercased, or translated after validation.
- Google's uppercase metadata is formatting guidance, not a validation rule.
- Country names and the country selector belong to the application.

## Development

```sh
pnpm install
pnpm run codegen generate
pnpm run check
pnpm run test
pnpm run build
```

Raw Google responses live in `metadata/google/`. Generated modules live in `src/generated/`. Both are committed.

Check generated output without changing files:

```sh
pnpm run codegen generate --check
```

### Playground deployment

CI deploys the playground with Wrangler after package checks pass on each push to `main`. Pull requests do not deploy. Wrangler builds the library and playground before upload.

Set these GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Workers Scripts edit permission for the target account.
- `CLOUDFLARE_ACCOUNT_ID`: the target Cloudflare account ID.

The Worker name and asset settings are in `playground/wrangler.jsonc`.

## License

addressfield-ts is available under the [MIT License](LICENSE).

Google libaddressinput metadata is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution and modification notices are included in generated files and the packaged `NOTICE`.
