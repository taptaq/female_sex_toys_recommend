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
  | "care_accessory"
  | "unknown";

export type LibrarySelectableTypeCode = LibraryTypeCode;

export type LibraryTypeSelection = LibrarySelectableTypeCode | "all";

export type LibrarySubtypeCode =
  | "suction_pure"
  | "suction_dual"
  | "rabbit_dual"
  | "multi_head_dual"
  | "bullet_vibe"
  | "wand_massager"
  | "gspot_insertable"
  | "insertable_vibe"
  | "manual_masturbator"
  | "vibrating_masturbator"
  | "interactive_masturbator"
  | "prostate_vibe"
  | "prostate_plug"
  | "classic_cock_ring"
  | "vibrating_cock_ring"
  | "insertable_couples"
  | "external_couples"
  | "panty_wearable"
  | "insertable_remote"
  | "dual_wearable_remote"
  | "lube_care"
  | "condom"
  | "lingerie";

export type LibrarySubtypeSelection = LibrarySubtypeCode | "all";

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
  care_accessory: "护理与周边",
  unknown: "其他",
};

const SUBTYPE_LABELS: Record<LibrarySubtypeCode, string> = {
  suction_pure: "纯吮吸",
  suction_dual: "吮吸双刺激",
  rabbit_dual: "兔耳双刺激",
  multi_head_dual: "双头多点",
  bullet_vibe: "跳蛋/子弹",
  wand_massager: "魔杖按摩",
  gspot_insertable: "G点探索",
  insertable_vibe: "入体震动",
  manual_masturbator: "手动杯",
  vibrating_masturbator: "震动杯",
  interactive_masturbator: "互动杯",
  prostate_vibe: "震动前列腺",
  prostate_plug: "前列腺塞",
  classic_cock_ring: "基础环",
  vibrating_cock_ring: "震动环",
  insertable_couples: "双人入体",
  external_couples: "双人外用",
  panty_wearable: "隐形穿戴",
  insertable_remote: "入体远控",
  dual_wearable_remote: "双人远控",
  lube_care: "润滑护理",
  condom: "避孕套",
  lingerie: "内衣服饰",
};

const GENDER_TO_TYPES: Record<LibraryAudienceGender, LibrarySelectableTypeCode[]> = {
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
    "care_accessory",
    "unknown",
  ],
  female: [
    "suction",
    "external_vibe",
    "insertable",
    "dual_stimulation",
    "wearable_remote",
    "care_accessory",
    "unknown",
  ],
  male: ["masturbator", "prostate", "cock_ring", "care_accessory", "unknown"],
  unisex: ["couples", "wearable_remote", "care_accessory", "unknown"],
};

const TYPE_TO_SUBTYPES: Partial<Record<Exclude<LibrarySelectableTypeCode, "unknown">, LibrarySubtypeCode[]>> = {
  suction: ["suction_pure"],
  dual_stimulation: ["suction_dual", "rabbit_dual", "multi_head_dual"],
  external_vibe: ["bullet_vibe", "wand_massager"],
  insertable: ["gspot_insertable", "insertable_vibe"],
  masturbator: ["manual_masturbator", "vibrating_masturbator", "interactive_masturbator"],
  prostate: ["prostate_vibe", "prostate_plug"],
  cock_ring: ["classic_cock_ring", "vibrating_cock_ring"],
  couples: ["insertable_couples", "external_couples"],
  wearable_remote: ["panty_wearable", "insertable_remote", "dual_wearable_remote"],
  care_accessory: ["lube_care", "condom", "lingerie"],
};

const SUBTYPE_TO_PARENT_TYPE: Record<LibrarySubtypeCode, LibrarySelectableTypeCode> = {
  suction_pure: "suction",
  suction_dual: "dual_stimulation",
  rabbit_dual: "dual_stimulation",
  multi_head_dual: "dual_stimulation",
  bullet_vibe: "external_vibe",
  wand_massager: "external_vibe",
  gspot_insertable: "insertable",
  insertable_vibe: "insertable",
  manual_masturbator: "masturbator",
  vibrating_masturbator: "masturbator",
  interactive_masturbator: "masturbator",
  prostate_vibe: "prostate",
  prostate_plug: "prostate",
  classic_cock_ring: "cock_ring",
  vibrating_cock_ring: "cock_ring",
  insertable_couples: "couples",
  external_couples: "couples",
  panty_wearable: "wearable_remote",
  insertable_remote: "wearable_remote",
  dual_wearable_remote: "wearable_remote",
  lube_care: "care_accessory",
  condom: "care_accessory",
  lingerie: "care_accessory",
};

export function getLibraryTypeLabel(typeCode: LibraryTypeCode) {
  return TYPE_LABELS[typeCode];
}

export function getLibrarySubtypeLabel(subtypeCode: LibrarySubtypeCode) {
  return SUBTYPE_LABELS[subtypeCode];
}

export function getAllowedLibraryTypeCodes(gender: LibraryAudienceGender) {
  return [...GENDER_TO_TYPES[gender]];
}

export function getAllowedLibrarySubtypeCodes(
  gender: LibraryAudienceGender,
  type: string,
) {
  if (type === "all") {
    return [];
  }

  const sanitizedType = sanitizeLibraryTypeSelection(type, gender);
  if (sanitizedType === "all") {
    return [];
  }

  return [...(TYPE_TO_SUBTYPES[sanitizedType] ?? [])];
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

export function sanitizeLibrarySubtypeSelection(
  subtype: string,
  gender: LibraryAudienceGender,
  type: string,
): LibrarySubtypeSelection {
  if (subtype === "all") return "all";
  const allowed = getAllowedLibrarySubtypeCodes(gender, type);
  return allowed.includes(subtype as LibrarySubtypeCode)
    ? (subtype as LibrarySubtypeCode)
    : "all";
}

export function getParentLibraryTypeCodeForSubtype(
  subtypeCode: string | null | undefined,
) {
  if (!subtypeCode) {
    return null;
  }

  return SUBTYPE_TO_PARENT_TYPE[subtypeCode as LibrarySubtypeCode] ?? null;
}
