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

export type LibraryTypeSelection = LibraryTypeCode | "all";

const TYPE_LABELS: Record<LibraryTypeCode, string> = {
  suction: "吮吸类",
  external_vibe: "外部震动",
  insertable: "入体探索",
  dual_stimulation: "双刺激",
  masturbator: "飞机杯",
  prostate: "前列腺探索",
  cock_ring: "环类/穿戴",
  couples: "双人互动",
  wearable_remote: "远控穿戴",
  unknown: "未分类",
};

const GENDER_TO_TYPES: Record<LibraryAudienceGender, LibraryTypeCode[]> = {
  all: [
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
    "masturbator",
    "prostate",
    "cock_ring",
    "couples",
    "wearable_remote",
  ],
  female: ["suction", "external_vibe", "insertable", "dual_stimulation"],
  male: ["masturbator", "prostate", "cock_ring"],
  unisex: ["couples", "wearable_remote"],
};

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
  return allowed.includes(type as LibraryTypeCode)
    ? (type as LibraryTypeCode)
    : "all";
}
