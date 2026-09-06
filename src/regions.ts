import type { Address, CountryMetadata, RegionData, RegionRecord } from "./address.ts";

const regionFields = ["administrativeArea", "locality", "dependentLocality"] as const;

export type RegionField = (typeof regionFields)[number];

const canonicalLanguage = (language: string) => {
  try {
    return new Intl.Locale(language).baseName;
  } catch {
    return language;
  }
};

const baseLanguage = (language: string) => language.toLowerCase().split("-")[0] ?? language;

const usesLatinScript = (language: string) => {
  try {
    return new Intl.Locale(language).maximize().script === "Latn";
  } catch {
    return false;
  }
};

export const selectAddressLanguage = (
  country: CountryMetadata,
  requestedLanguage: string | undefined,
) => {
  const fallback = country.language ?? country.languages[0];
  if (requestedLanguage === undefined || requestedLanguage.length === 0) {
    return { tag: fallback, metadataLanguage: fallback, latin: false };
  }

  const requested = canonicalLanguage(requestedLanguage);
  const requestedBase = baseLanguage(requested);
  const requestsLatin = requested.split("-").some((part) => part.toLowerCase() === "latn");

  if (requestsLatin && country.latinRows !== undefined) {
    return {
      tag: fallback === undefined ? requested : `${baseLanguage(fallback)}-Latn`,
      metadataLanguage: fallback,
      latin: true,
    };
  }

  const supported = country.languages.find((language) => baseLanguage(language) === requestedBase);
  if (supported !== undefined) {
    return {
      tag: supported,
      metadataLanguage: supported,
      latin: country.latinRows !== undefined && usesLatinScript(supported),
    };
  }

  if (country.latinRows !== undefined) {
    return {
      tag: fallback === undefined ? requested : `${baseLanguage(fallback)}-Latn`,
      metadataLanguage: fallback,
      latin: true,
    };
  }

  return { tag: fallback, metadataLanguage: fallback, latin: false };
};

type AddressLanguageSelection = ReturnType<typeof selectAddressLanguage>;

const keyFor = (value: string) => value.trim().normalize("NFC").toLowerCase();

const localizedRecord = (id: string, language: AddressLanguageSelection, records: RegionData) => {
  const selected = language.metadataLanguage;
  if (selected === undefined) return records[id];
  return (
    records[`${id}--${selected}`] ?? records[`${id}--${baseLanguage(selected)}`] ?? records[id]
  );
};

const recordBase = (record: RegionRecord) => {
  const separator = record.id.lastIndexOf("--");
  return separator < 0 ? record.id : record.id.slice(0, separator);
};

const list = (
  parent: RegionRecord | undefined,
  languageParent: RegionRecord | undefined,
  language: AddressLanguageSelection,
  records: RegionData,
) => {
  if (!parent?.sub_keys) return [];
  const values = parent.sub_keys.split("~");
  const identifiers = parent.sub_isoids?.split("~") ?? [];
  const patterns = parent.sub_zips?.split("~") ?? [];
  const languageKeys = languageParent?.sub_keys?.split("~") ?? values;
  const languageIdentifiers = languageParent?.sub_isoids?.split("~") ?? [];
  const names = languageParent?.sub_names?.split("~") ?? [];
  const latinNames = languageParent?.sub_lnames?.split("~") ?? [];
  const base = recordBase(parent);
  const languageBase = languageParent === undefined ? base : recordBase(languageParent);

  return values
    .map((value, index) => {
      const identifier = identifiers[index];
      const matchingIndex =
        identifier === undefined
          ? languageKeys.indexOf(value)
          : languageIdentifiers.indexOf(identifier);
      const languageIndex = matchingIndex < 0 ? index : matchingIndex;
      const languageKey = languageKeys[languageIndex] ?? value;
      const record = records[`${base}/${value}`];
      const languageRecord =
        localizedRecord(`${languageBase}/${languageKey}`, language, records) ??
        localizedRecord(`${base}/${value}`, language, records);
      const nativeLabel = names[languageIndex] || languageRecord?.name || languageKey;
      const latinLabel = latinNames[languageIndex] || languageRecord?.lname;
      return {
        value,
        label: language.latin ? (latinLabel ?? nativeLabel) : nativeLabel,
        aliases: [
          value,
          languageKey,
          nativeLabel,
          latinLabel ?? "",
          record?.name ?? "",
          record?.lname ?? "",
          languageRecord?.name ?? "",
          languageRecord?.lname ?? "",
        ]
          .filter(Boolean)
          .map(keyFor),
        pattern: record?.zip || patterns[index],
        record,
        languageRecord,
      };
    })
    .filter((choice) => choice.value.length > 0);
};

export const resolveRegions = (
  address: Address,
  country: CountryMetadata,
  records: RegionData,
  requestedLanguage?: string,
) => {
  const language = selectAddressLanguage(country, requestedLanguage);
  const root = `data/${country.countryCode}`;
  let parent = records[root];
  let languageParent = localizedRecord(root, language, records);

  return regionFields.map((field) => {
    const choices = list(parent, languageParent, language, records);
    const value = address[field];
    const selected =
      value === undefined
        ? undefined
        : choices.find((choice) => choice.aliases.includes(keyFor(value)));
    parent = selected?.record;
    languageParent = selected?.languageRecord;
    return { field, choices, selected };
  });
};
