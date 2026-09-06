import * as Schema from "effect/Schema";

import type { Address, AddressOptions, RegionData } from "./address.ts";
import { validateRegions } from "./regions.ts";

/** Add the available hierarchy checks while preserving the generated schema's types and checks. */
export const withRegions = <S extends Schema.Top & { readonly Type: Address }>(
  schema: S,
  options: AddressOptions & { readonly regions: RegionData },
) =>
  schema.check(
    Schema.makeFilter<Address>((address) => {
      const issues = validateRegions(address, options);
      return (
        issues.length === 0 ||
        issues.map((issue) => ({ path: [issue.field], issue: issue.message }))
      );
    }),
  );
