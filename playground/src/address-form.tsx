import { use, useState } from "react";
import type { FormEvent } from "react";
import * as Schema from "effect/Schema";
import { createValidator, getAddressForm } from "addressfield-ts";
import type { Address, AddressField as FieldName, AddressIssue } from "addressfield-ts";
import { AddressField } from "./address-field";
import { AddressLines } from "./address-lines";
import type { CountryData } from "./country";
import { Button } from "@/components/ui/button";

const serialize = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown, { space: 2 }));

export function AddressForm({ data }: { data: Promise<CountryData> }) {
  const { country, regions, decode } = use(data);
  const [address, setAddress] = useState<Address>({ countryCode: country.countryCode });
  const [issues, setIssues] = useState<ReadonlyArray<AddressIssue>>([]);
  const [result, setResult] = useState("");
  const [submitError, setSubmitError] = useState("");
  const form = getAddressForm(country, { values: address, regions });

  function clearResult() {
    setIssues([]);
    setResult("");
    setSubmitError("");
  }

  function updateAddressLines(lines: string[]) {
    setAddress((previous) => ({ ...previous, addressLines: lines }));
    clearResult();
  }

  function updateField(field: Exclude<FieldName, "countryCode" | "addressLines">, value: string) {
    setAddress((previous) => {
      const next = { ...previous };

      // optional fields must be absent rather than empty to pass schema validation
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

    const validation = createValidator(country, { regions })(address);
    setIssues(validation.issues);
    if (!validation.valid) return;

    try {
      setResult(serialize(decode(address)));
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Could not validate the address.");
    }
  }

  function renderField(name: FieldName) {
    const field = form.fields.find((item) => item.name === name);
    if (!field || name === "countryCode") return null;

    const error = issues.find((issue) => issue.field === name)?.message;

    if (name === "addressLines") {
      return (
        <AddressLines
          key={name}
          value={address.addressLines ?? []}
          required={field.required}
          error={error}
          onChange={updateAddressLines}
        />
      );
    }

    return (
      <AddressField
        key={name}
        field={field}
        value={address[name] ?? ""}
        error={error}
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
        <p role="alert" className="text-sm text-destructive">
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
