import * as Schema from "effect/Schema";

import { compilePostalCode } from "./postal.ts";

export const text = Schema.String.check(
  Schema.makeFilter((value) => {
    return value.trim().length > 0 || "Enter non-whitespace text.";
  }),
);

export const addressLines = Schema.NonEmptyArray(text);

export const postalCode = (pattern: string) => {
  const matches = compilePostalCode(pattern);

  return text.check(
    Schema.makeFilter((value) => {
      return matches(value) || "Enter a valid postal code.";
    }),
  );
};
