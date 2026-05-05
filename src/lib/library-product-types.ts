export type LibraryAudienceGender = "all" | "female" | "male" | "unisex";

export type LibraryTypeCode =
  | "suction"
  | "external_vibe"
  | "insertable"
  | "dual_stimulation"
  | "masturbator"
  | "prostate"
  | "cock_ring"
  | "couples"
  | "wearable_remote"
  | "unknown";

export type LibrarySelectableTypeCode = Exclude<LibraryTypeCode, "unknown">;
export type LibraryTypeSelection = LibrarySelectableTypeCode | "all";

export const SELECTABLE_TYPE_LABELS = Object.freeze({
  suction: "吮吸类",
  external_vibe: "外部震动",
  insertable: "入体探索",
  dual_stimulation: "双刺激",
  masturbator: "飞机杯",
  prostate: "前列腺探索",
  cock_ring: "环类/穿戴",
  couples: "双人互动",
  wearable_remote: "远控穿戴",
} satisfies Record<LibrarySelectableTypeCode, string>);

export const ALL_SELECTABLE_LIBRARY_TYPE_CODES = Object.freeze(
  Object.keys(SELECTABLE_TYPE_LABELS) as LibrarySelectableTypeCode[],
);

export const TYPE_LABELS = Object.freeze({
  ...SELECTABLE_TYPE_LABELS,
  unknown: "未分类",
} satisfies Record<LibraryTypeCode, string>);

export const GENDER_TO_TYPES = Object.freeze({
  all: ALL_SELECTABLE_LIBRARY_TYPE_CODES,
  female: Object.freeze([
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
  ] as const satisfies readonly LibrarySelectableTypeCode[]),
  male: Object.freeze([
    "masturbator",
    "prostate",
    "cock_ring",
  ] as const satisfies readonly LibrarySelectableTypeCode[]),
  unisex: Object.freeze([
    "couples",
    "wearable_remote",
  ] as const satisfies readonly LibrarySelectableTypeCode[]),
} satisfies Record<
  LibraryAudienceGender,
  readonly LibrarySelectableTypeCode[]
>);

export function getLibraryTypeLabel(typeCode: LibraryTypeCode) {
  return TYPE_LABELS[typeCode];
}

export function getAllowedLibraryTypeCodes(gender: LibraryAudienceGender) {
  return [...GENDER_TO_TYPES[gender]];
}

export function sanitizeLibraryTypeSelection(
  type: string,
  gender: LibraryAudienceGender,
): LibraryTypeSelection {
  if (type === "all") return "all";

  const allowed = getAllowedLibraryTypeCodes(gender);
  return allowed.includes(type as LibrarySelectableTypeCode)
    ? (type as LibrarySelectableTypeCode)
    : "all";
}
