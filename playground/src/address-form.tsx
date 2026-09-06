import { use, useState } from "react";
import type { FormEvent } from "react";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import type { AddressFormField as FieldName, AddressFormValues } from "addressfield-ts";
import { AddressIssueSchema } from "addressfield-ts/schemas";
import type { AddressIssue } from "addressfield-ts/schemas";
import { AddressField } from "./address-field";
import { AddressLines } from "./address-lines";
import type { CountryData } from "./country";
import { Button } from "@/components/ui/button";

const serialize = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown, { space: 2 }));

const addressMessage = (issue: AddressIssue) => {
  if (Predicate.isTagged(issue, "InvalidPostalCode")) {
    const example = issue.examples[0];
    return example === undefined
      ? "Enter a valid postal code."
      : `Enter a valid postal code, for example ${example}.`;
  }
  if (Predicate.isTagged(issue, "UnknownRegion")) return "Choose a listed region.";
  return "Postal code does not match the selected region.";
};

const issueFormatter = SchemaIssue.makeFormatterStandardSchemaV1({
  checkHook: (issue) => {
    if (!Predicate.isTagged(issue.issue, "InvalidValue")) return undefined;
    const annotation = issue.issue.annotations?.["addressIssue"];
    return Schema.is(AddressIssueSchema)(annotation) ? addressMessage(annotation) : undefined;
  },
  leafHook: (issue) => {
    if (Predicate.isTagged(issue, "InvalidValue")) {
      const annotation = issue.annotations?.["addressIssue"];
      if (Schema.is(AddressIssueSchema)(annotation)) return addressMessage(annotation);
    }
    if (Predicate.isTagged(issue, "MissingKey")) return "This field is required.";
    return SchemaIssue.defaultLeafHook(issue);
  },
});

export function AddressForm({ data }: { data: Promise<CountryData> }) {
  const { code, getAddressForm, decode } = use(data);
  const [address, setAddress] = useState<AddressFormValues>({});
  const [result, setResult] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const form = getAddressForm(address);

  function clearResult() {
    setResult("");
    setSubmitError("");
    setFieldErrors({});
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

    const parsed = decode({ countryCode: code, ...address });
    if (Result.isSuccess(parsed)) {
      setResult(serialize(parsed.success));
      return;
    }

    const nextErrors: Partial<Record<FieldName, string>> = {};
    const formErrors: string[] = [];
    for (const issue of issueFormatter(parsed.failure.issue).issues) {
      const field = form.fields.find(({ name }) => name === issue.path?.[0])?.name;
      if (field === undefined) formErrors.push(issue.message);
      else nextErrors[field] ??= issue.message;
    }
    setFieldErrors(nextErrors);
    setSubmitError(formErrors.join("\n"));
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
          error={fieldErrors.addressLines}
          onChange={updateAddressLines}
        />
      );
    }

    return (
      <AddressField
        key={name}
        field={field}
        value={address[name] ?? ""}
        error={fieldErrors[name]}
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
