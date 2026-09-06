import { use, useState } from "react";
import type { FormEvent } from "react";
import * as Schema from "effect/Schema";
import type { AddressFormField as FieldName, AddressFormValues } from "addressfield-ts";
import { AddressField } from "./address-field";
import { AddressLines } from "./address-lines";
import type { CountryData } from "./country";
import { Button } from "@/components/ui/button";

const serialize = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown, { space: 2 }));

export function AddressForm({ data }: { data: Promise<CountryData> }) {
  const { code, getAddressForm, decode } = use(data);
  const [address, setAddress] = useState<AddressFormValues>({});
  const [result, setResult] = useState("");
  const [submitError, setSubmitError] = useState("");
  const form = getAddressForm(address);

  function clearResult() {
    setResult("");
    setSubmitError("");
  }

  function updateAddressLines(lines: string[]) {
    setAddress((previous) => ({ ...previous, addressLines: lines }));
    clearResult();
  }

  function updateField(field: Exclude<FieldName, "addressLines">, value: string) {
    setAddress((previous) => {
      const next = { ...previous };

      if (value === "") delete next[field];
      else next[field] = value;

      if (field === "administrativeArea") {
        delete next.locality;
        delete next.dependentLocality;
      }
      if (field === "locality") delete next.dependentLocality;

      return next;
    });
    clearResult();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearResult();

    try {
      setResult(serialize(decode({ countryCode: code, ...address })));
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Could not validate the address.");
    }
  }

  function renderField(name: FieldName) {
    const field = form.fields.find((item) => item.name === name);
    if (!field) return null;

    if (name === "addressLines") {
      return (
        <AddressLines
          key={name}
          value={address.addressLines ?? []}
          required={field.required}
          error={undefined}
          onChange={updateAddressLines}
        />
      );
    }

    return (
      <AddressField
        key={name}
        field={field}
        value={address[name] ?? ""}
        error={undefined}
        onChange={(value) => updateField(name, value)}
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {form.rows.map((row) => (
        <div key={row.join("-")} className="grid gap-4 sm:grid-flow-col sm:auto-cols-fr">
          {row.map(renderField)}
        </div>
      ))}

      <Button type="submit">Validate address</Button>
      {submitError && (
        <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">
          {submitError}
        </p>
      )}
      <section aria-live="polite">
        {result && (
          <>
            <h2 className="mb-2 font-medium">Validated address</h2>
            <pre className="rounded-lg border bg-muted p-4 text-xs">{result}</pre>
          </>
        )}
      </section>
    </form>
  );
}
