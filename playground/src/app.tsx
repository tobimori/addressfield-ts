import { Suspense, useId, useState } from "react";
import { countryCodes } from "addressfield-ts/forms";
import type { CountryCode } from "addressfield-ts/forms";
import { AddressForm } from "./address-form";
import { getCountry } from "./country";
import { CountryErrorBoundary } from "./country-error-boundary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = countryCodes
  .map((value) => ({ value, label: countryNames.of(value) ?? value }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function App() {
  const countryId = useId();
  const [countryCode, setCountryCode] = useState<CountryCode>("DE");

  function changeCountry(value: string | null) {
    const code = countryCodes.find((country) => country === value);
    if (code) setCountryCode(code);
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Address form playground</h1>
        <p className="text-sm text-muted-foreground">
          Fields, labels, and region choices come from Google metadata for {countryCodes.length}{" "}
          countries and territories.
        </p>
      </header>

      <div className="space-y-2">
        <label htmlFor={countryId} className="text-sm font-medium">
          Country or territory
        </label>
        <Select value={countryCode} items={countries} onValueChange={changeCountry}>
          <SelectTrigger id={countryId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-80">
            {countries.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CountryErrorBoundary key={countryCode}>
        <Suspense fallback={<p role="status">Loading country metadata…</p>}>
          <AddressForm data={getCountry(countryCode)} />
        </Suspense>
      </CountryErrorBoundary>

      <footer className="space-y-2 border-t pt-5 text-xs text-muted-foreground">
        <p>
          Validation checks required fields, postal codes, and available region rules. It does not
          verify address existence or delivery.
        </p>
        <p>
          Google libaddressinput metadata ·{" "}
          <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">
            CC BY 4.0
          </a>
        </p>
      </footer>
    </main>
  );
}
