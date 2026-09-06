import { addressFields } from "./address.ts";
import type { Address, AddressIssue, AddressOptions, CountryMetadata } from "./address.ts";
import { compilePostalCode } from "./postal.ts";
import { validateRegions } from "./regions.ts";

export const createValidator = (country: CountryMetadata, options: AddressOptions = {}) => {
  const matches = country.postalCodePattern
    ? compilePostalCode(country.postalCodePattern)
    : undefined;
  return (address: Address) => {
    const issues: AddressIssue[] = [];
    if (address.countryCode !== country.countryCode) {
      issues.push({
        field: "countryCode",
        code: "country",
        message: `Expected country ${country.countryCode}.`,
      });
    }
    for (const field of addressFields) {
      const required = field === "countryCode" || country.requiredFields.includes(field);
      if (field === "addressLines") {
        const lines = address.addressLines;
        if (
          (lines === undefined && required) ||
          (lines !== undefined && (lines.length === 0 || lines.some((line) => line.trim() === "")))
        ) {
          issues.push({
            field,
            code: "required",
            message: "Enter at least one non-empty address line.",
          });
        }
      } else {
        const value = address[field];
        if ((value === undefined && required) || (value !== undefined && value.trim() === "")) {
          issues.push({ field, code: "required", message: "Enter non-whitespace text." });
        }
      }
    }
    if (address.postalCode && matches && !matches(address.postalCode)) {
      issues.push({
        field: "postalCode",
        code: "postalCode",
        message: "Enter a valid postal code.",
      });
    }
    if (address.countryCode === country.countryCode)
      issues.push(...validateRegions(address, options));
    return {
      valid: issues.length === 0,
      issues,
      coverage: options.regions === undefined ? "country" : "country-and-regions",
    };
  };
};
