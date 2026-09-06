import type { Address, AddressIssue, AddressOptions, RegionData, RegionRecord } from "./address.ts";

export const regionFields = ["administrativeArea", "locality", "dependentLocality"] as const;

const keyFor = (value: string) => value.trim().normalize("NFC").toLowerCase();

const list = (parent: RegionRecord | undefined, records: RegionData) => {
  if (!parent?.sub_keys) return [];
  const names = parent.sub_names?.split("~") ?? [];
  const latinNames = parent.sub_lnames?.split("~") ?? [];
  const patterns = parent.sub_zips?.split("~") ?? [];
  const separator = parent.id.lastIndexOf("--");
  const suffix = separator < 0 ? "" : parent.id.slice(separator);
  const base = separator < 0 ? parent.id : parent.id.slice(0, separator);
  return parent.sub_keys
    .split("~")
    .map((value, index) => {
      const id = `${base}/${value}`;
      const record = records[`${id}${suffix}`] ?? records[id];
      const label = names[index] || record?.name || value;
      return {
        value,
        label,
        aliases: [value, label, latinNames[index] ?? "", record?.name ?? ""]
          .filter(Boolean)
          .map(keyFor),
        pattern: record?.zip || patterns[index],
        record,
      };
    })
    .filter((choice) => choice.value.length > 0);
};

export const resolveRegions = (address: Address, options: AddressOptions) => {
  const records = options.regions;
  if (records === undefined) return [];
  const root = `data/${address.countryCode}`;
  let parent = records[`${root}--${options.language ?? ""}`] ?? records[root];
  return regionFields.map((field) => {
    const choices = list(parent, records);
    const value = address[field];
    const selected =
      value === undefined
        ? undefined
        : choices.find((choice) => choice.aliases.includes(keyFor(value)));
    parent = selected?.record;
    return { field, choices, selected };
  });
};

export const getRegionOptions = (
  address: Address,
  field: (typeof regionFields)[number],
  options: AddressOptions,
) =>
  (resolveRegions(address, options).find((level) => level.field === field)?.choices ?? []).map(
    ({ value, label }) => ({ value, label }),
  );

export const validateRegions = (address: Address, options: AddressOptions) => {
  const issues: AddressIssue[] = [];
  if (options.regions === undefined) return issues;
  if (options.regions[`data/${address.countryCode}`] === undefined) {
    issues.push({
      field: "countryCode",
      code: "regionData",
      message: "Region data is unavailable for this country.",
    });
    return issues;
  }
  for (const level of resolveRegions(address, options)) {
    const value = address[level.field];
    if (value === undefined || value.trim() === "") break;
    if (level.choices.length > 0 && level.selected === undefined) {
      issues.push({
        field: level.field,
        code: "region",
        message: "Choose a region listed for the selected parent.",
      });
      break;
    }
    if (
      address.postalCode &&
      level.selected?.pattern &&
      !new RegExp(`^(?:${level.selected.pattern})`, "iu").test(address.postalCode)
    ) {
      issues.push({
        field: "postalCode",
        code: "postalCode",
        message: "Postal code does not match the selected region.",
      });
      break;
    }
  }
  return issues;
};
