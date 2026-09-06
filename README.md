# addressfield-ts

Address validation, Effect schemas, and form metadata for 252 countries and territories, generated from Google libaddressinput data.

- Import only the countries you need, or load them on demand
- Use the core library without Effect or a UI framework
- Add Effect schemas and regional validation when needed
- Build forms from country-specific field order, labels, required fields, and region choices

[Try the playground](https://addressfield-playground.tobimori.workers.dev)

## Install addressfield-ts

```sh
vp add addressfield-ts
```

For schema support, also install the supported Effect release:

```sh
vp add effect@4.0.0-rc.112
```

## Validate your first address

```ts
import { createValidator } from "addressfield-ts";
import { DE } from "addressfield-ts/countries/DE";

const validate = createValidator(DE);

const result = validate({
  countryCode: "DE",
  addressLines: ["Invalidenstraße 116"],
  postalCode: "10115",
  locality: "Berlin",
});

console.log(result.valid);
console.log(result.issues);
```

Each issue has a `field`, `code`, and `message`. Use `field` to connect the issue to an input. Use `code` to provide your own messages.

`createValidator` accepts a typed `Address`. For unknown input, such as a request body, use an Effect schema.

## Common tasks

### Validate a request with Effect

```ts
import * as Schema from "effect/Schema";
import { USAddressSchema } from "addressfield-ts/schemas/US";
import { records } from "addressfield-ts/regions/US";
import { withRegions } from "addressfield-ts/schemas";

const RequestSchema = Schema.Struct({
  address: withRegions(USAddressSchema, { regions: records }),
  deliveryInstructions: Schema.optionalKey(Schema.String),
});

const decodeRequest = Schema.decodeUnknownSync(RequestSchema, {
  errors: "all",
  onExcessProperty: "error",
});
```

Pass the parsed request body to `decodeRequest`. It returns the decoded value or throws a schema error.

Generated schemas check country-level requirements and postal-code patterns. `withRegions` adds the available regional checks. Keep custom application fields outside the address schema, as above, to preserve its checks.

For core validation with region data, pass the same `regions` option to `createValidator`.

### Build a form

```ts
import { getAddressForm } from "addressfield-ts";
import { US } from "addressfield-ts/countries/US";
import { records } from "addressfield-ts/regions/US";

const form = getAddressForm(US, {
  regions: records,
  values: {
    countryCode: "US",
    administrativeArea: "CA",
  },
  labels: {
    recipient: "Recipient name",
  },
});
```

`form.fields` contains:

- `name`, `label`, and `required`
- `control`: `hidden`, `text`, `lines`, or `select`
- `autocomplete`: the HTML autocomplete token
- `options`: region choices with `value` and `label`
- `value`: the current field value

`form.rows` groups field names according to the country's address format. Layout details, such as input widths, remain your choice. `lines` represents an array of address lines, not a fixed number of inputs.

Call `getAddressForm` with the updated values when a parent region changes. You can also use `getRegionOptions` to read choices for one region field.

The library does not render controls. Connect labels to inputs, mark required fields, associate errors with `aria-describedby`, and focus the first invalid field on submission.

See [`playground/src`](./playground/src) for a React example using shadcn Base UI components.

### Load countries on demand

```ts
import { countryCodes, loadCountry, loadRegions, loadSchema } from "addressfield-ts/countries";

const country = await loadCountry("DE");
```

`countryCodes` lists all supported codes. `loadCountry`, `loadRegions`, and `loadSchema` use separate dynamic imports. They load packaged modules, not data from Google.

Direct country imports avoid including the complete country loader catalog in your application.

## Limits

- Validation does not confirm address existence or mail delivery
- Regional checks depend on the data available for that country
- Country layouts are postal formats, not a complete list of administrative divisions
- Default field labels are English; use `labels` to override them
- Address values are not automatically trimmed, uppercased, or otherwise changed
- Effect schema support uses an Effect v4 release candidate

## Development

```sh
vp install
vp run build
vp run dev
```

The root package contains the library and codegen CLI. `playground/` is a private workspace package that imports the library.

Raw Google responses live in `metadata/google/`. Generated modules live in `src/generated/`. Both are committed; build output is not.

Regenerate from the committed data:

```sh
vp run codegen generate
```

Download a fresh copy without overwriting the committed data:

```sh
vp run codegen fetch --out .cache/google
vp run codegen generate --input .cache/google
```

Use `vp run changeset` to describe a release change. CI creates a release PR and publishes through npm trusted publishing after that PR is merged.

## License

addressfield-ts is available under the [MIT License](LICENSE).

Google libaddressinput metadata is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution and modification notices are included in the generated files and the packaged `NOTICE`.
