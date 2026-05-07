import {
  getParentLibraryTypeCodeForSubtype,
  type LibrarySubtypeCode,
  type LibraryTypeCode,
} from "./library-product-types.ts";

export type LibraryTypeClassifierInput = {
  gender?: string | null;
  physicalForm?: string | null;
  name?: string | null;
  rawDescription?: string | null;
  tags?: string[] | null;
  typeCode?: string | null;
};

export type ResolvedLibraryAudienceGender = "female" | "male" | "unisex";

function normalizeValue(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

const DESCRIPTION_LEAD_SIGNAL_LIMIT = 420;

function buildDescriptionLeadText(rawDescription?: string | null) {
  const normalized = normalizeValue(rawDescription);
  const [localLeadText] = normalized.split(/\[英文正文摘录\]|\[英文详情\]/u, 1);

  return localLeadText.slice(0, DESCRIPTION_LEAD_SIGNAL_LIMIT);
}

function collectSignalText(input: LibraryTypeClassifierInput) {
  const descriptionLeadText = buildDescriptionLeadText(input.rawDescription);

  return [input.name, descriptionLeadText, ...(input.tags ?? [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .toLowerCase();
}

function hasAnySignal(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function scoreSignalMatches(
  text: string,
  patterns: RegExp[],
  points: number,
) {
  if (!text) {
    return 0;
  }

  return hasAnySignal(text, patterns) ? points : 0;
}

const SUCTION_PATTERNS = [
  /吮吸/u,
  /吸吮/u,
  /气脉冲/u,
  /脉冲吸/u,
  /吸感/u,
  /压力波/u,
  /空气脉冲/u,
  /\bsuction\b/u,
  /air\s*pulse/u,
  /clitoral\s*suction/u,
  /\bwomanizer\b/u,
];

const EXTERNAL_VIBE_PATTERNS = [
  /外部/u,
  /跳蛋/u,
  /震动蛋/u,
  /子弹/u,
  /口红/u,
  /按摩棒/u,
  /震动棒/u,
  /振动棒/u,
  /魔杖/u,
  /\bvibe\b/u,
  /\bvibrator\b/u,
  /\bwand\b/u,
];

const DUAL_STIMULATION_PATTERNS = [
  /双刺激/u,
  /双重刺激/u,
  /双头/u,
  /兔耳/u,
  /兔嘴/u,
  /兔嘴兔耳/u,
  /内外同/u,
  /内外刺激/u,
  /同时刺激/u,
  /g点.{0,8}阴蒂/u,
  /阴蒂.{0,8}g点/u,
  /g-spot.{0,12}(clit|clitoral)/u,
  /(clit|clitoral).{0,12}g-spot/u,
  /dual[-\s]*ended/u,
  /\brabbit\b/u,
];

const INSERTABLE_PATTERNS = [
  /入体/u,
  /内部/u,
  /插入/u,
  /插入式/u,
  /深入/u,
  /包裹/u,
  /g点棒/u,
  /g点/u,
  /g-spot/u,
  /阴道/u,
];

const VIBRATION_PATTERNS = [
  /震动/u,
  /振动/u,
  /强震/u,
  /旋转/u,
  /高频/u,
];

const INSERTABLE_STRONG_PATTERNS = [
  /入体/u,
  /内部/u,
  /插入/u,
  /插入式/u,
  /深入/u,
  /包裹/u,
  /g点棒/u,
  /阴道/u,
  /假阳具/u,
  /\bdildo\b/u,
  /\binternal\b/u,
];

const INSERTABLE_WEAK_PATTERNS = [
  /g点/u,
  /g-spot/u,
];

const CLITORAL_PATTERNS = [
  /阴蒂/u,
  /\bclit\b/u,
  /\bclitoral\b/u,
];

const MASTURBATOR_PATTERNS = [
  /飞机杯/u,
  /飞机/u,
  /自慰杯/u,
  /男性自慰器/u,
  /男用自慰器/u,
  /自慰蛋/u,
  /手冲杯/u,
  /男用杯/u,
  /胶杯/u,
  /软胶杯/u,
  /名器/u,
  /伸缩杯/u,
  /\bfleshlight\b/u,
  /\begg\s*(set)?\b/u,
  /\bspinner\b/u,
  /\bmasturbator\b/u,
  /\bstroker\b/u,
  /\bcup\b/u,
];

const INTERACTIVE_PATTERNS = [
  /互动/u,
  /联动/u,
  /同步/u,
  /交互/u,
  /\binteractive\b/u,
  /\bsync\b/u,
];

const POWERED_MASTURBATOR_PATTERNS = [
  /电动/u,
  /马达/u,
  /加热/u,
  /自动/u,
  /震动/u,
  /振动/u,
  /\bvibrat/i,
  /\bpowered\b/u,
];

const MANUAL_MASTURBATOR_PATTERNS = [
  /手动/u,
  /手冲/u,
  /手持/u,
  /免电/u,
  /非震动/u,
  /\bmanual\b/u,
];

const PROSTATE_PATTERNS = [
  /前列腺/u,
  /p-spot/u,
  /p spot/u,
  /pspot/u,
];

const PROSTATE_PLUG_PATTERNS = [
  /塞/u,
  /肛塞/u,
  /plug/u,
];

const COCK_RING_PATTERNS = [
  /锁精环/u,
  /延时环/u,
  /震动环/u,
  /阴茎环/u,
  /阴茎按摩器/u,
  /阴茎振动器/u,
  /环体/u,
  /环类/u,
  /cock\s*ring/u,
  /penis\s*ring/u,
  /penis\s*(massager|vibrator)/u,
];

const RING_POWER_PATTERNS = [
  /震动环/u,
  /振动环/u,
  /震动锁精环/u,
  /vibrating\s+(cock|penis)\s*ring/u,
];

const COUPLES_PATTERNS = [
  /情侣/u,
  /双人/u,
  /共玩/u,
  /互动/u,
  /共享/u,
  /for\s+two/u,
  /for\s+couples/u,
  /for\s+couple/u,
  /orgasms?\s+for\s+two/u,
  /\bcouple/u,
];

const REMOTE_PATTERNS = [
  /远控/u,
  /遥控/u,
  /远程控制/u,
  /app控制/u,
  /\bremote\b/u,
  /\bapp\b/u,
];

const WEARABLE_PATTERNS = [
  /穿戴/u,
  /可穿戴/u,
  /佩戴/u,
  /贴身/u,
  /内裤/u,
  /隐形佩戴/u,
  /\bwearable\b/u,
];

const PANTY_WEARABLE_PATTERNS = [
  /内裤/u,
  /底裤/u,
  /panty/u,
  /panties/u,
  /隐形佩戴/u,
];

const NEGATED_WEARABLE_PATTERNS = [
  /不是穿戴/u,
  /非穿戴/u,
  /不属于穿戴/u,
  /not\s+wearable/u,
];

const LUBE_STRONG_PATTERNS = [
  /润滑液/u,
  /润滑剂/u,
  /人体润滑/u,
  /润滑啫喱/u,
  /润滑凝胶/u,
  /水基/u,
  /玻尿酸/u,
  /\blube\b/iu,
  /\blubricant\b/iu,
  /water[-\s]*based/iu,
];

const CONDOM_STRONG_PATTERNS = [
  /避孕套/u,
  /安全套/u,
  /套套/u,
  /\bcondom(s)?\b/iu,
];

const LINGERIE_STRONG_PATTERNS = [
  /情趣内衣/u,
  /内衣/u,
  /蕾丝/u,
  /连体衣/u,
  /睡衣/u,
  /\blingerie\b/iu,
  /\bbodysuit\b/iu,
  /\bsleepwear\b/iu,
  /\blace\b/iu,
];

const DEVICE_BLOCKER_PATTERNS = [
  ...SUCTION_PATTERNS,
  ...EXTERNAL_VIBE_PATTERNS,
  ...DUAL_STIMULATION_PATTERNS,
  ...INSERTABLE_PATTERNS,
  ...MASTURBATOR_PATTERNS,
  ...PROSTATE_PATTERNS,
  ...COCK_RING_PATTERNS,
  ...COUPLES_PATTERNS,
  ...REMOTE_PATTERNS,
  /肛塞/u,
  /后庭/u,
  /\banal\b/u,
  /\bbutt\s*plug\b/u,
  /\bplug\b/u,
  /假阳具/u,
  /\bdildo\b/u,
];

const CONTAMINANT_STRONG_NAME_PATTERNS = [
  /sex\s*machine/u,
  /\badapter\b/u,
  /\bconnector\b/u,
  /\breplacement\b/u,
  /\bwebcam\b/u,
  /适配器/u,
  /连接器/u,
  /配件/u,
  /替换(头|件|装|配件)/u,
  /转接器/u,
  /机座/u,
  /摄像头/u,
];

const CONTAMINANT_TAG_NAME_PATTERNS = [
  /\badapter\b/u,
  /\bwebcam\b/u,
  /适配器/u,
  /转接器/u,
  /机座/u,
  /摄像头/u,
];

const CONTAMINANT_SUPPORT_PATTERNS = [
  /平台/u,
  /配件/u,
  /兼容/u,
  /连接/u,
  /蓝牙/u,
  /connector/u,
  /replacement/u,
];

const CONTAMINANT_DESCRIPTION_PATTERNS = [
  /性爱机器/u,
  /假阳具机器/u,
  /口交机器/u,
  /抽插.{0,8}机器/u,
];

const FEMALE_AUDIENCE_PATTERNS = [
  /女性/u,
  /女用/u,
  /她/u,
  /\bfemale\b/u,
  /阴蒂/u,
  /g点/u,
  /g-spot/u,
  /c点/u,
  /跳蛋/u,
  /震动棒/u,
  /按摩棒/u,
  /吮吸/u,
  /兔耳/u,
  /兔嘴/u,
  /兔子/u,
  /口红/u,
  /lipstick/u,
  /bullet/u,
  /panty/u,
];

const MALE_AUDIENCE_PATTERNS = [
  /男性/u,
  /男用/u,
  /男士/u,
  /\bmale\b/u,
  /for\s+men/u,
  /飞机杯/u,
  /自慰杯/u,
  /自慰蛋/u,
  /自慰器/u,
  /阴茎/u,
  /龟头/u,
  /前列腺/u,
  /阴茎环/u,
  /\bpenis\b/u,
  /\bcock\s*ring\b/u,
  /\bfleshlight\b/u,
  /\bstroker\b/u,
];

const UNISEX_AUDIENCE_PATTERNS = [
  /通用/u,
  /男女/u,
  /双方/u,
  /for\s+two/u,
  /for\s+couples/u,
  /\bunisex\b/u,
];

type SignalCorpus = {
  nameText: string;
  descriptionText: string;
  descriptionLeadText: string;
  tagText: string;
  signalText: string;
};

function buildSignalCorpus(input: LibraryTypeClassifierInput): SignalCorpus {
  return {
    nameText: normalizeValue(input.name),
    descriptionText: normalizeValue(input.rawDescription),
    descriptionLeadText: buildDescriptionLeadText(input.rawDescription),
    tagText: (input.tags ?? []).join("\n").toLowerCase(),
    signalText: collectSignalText(input),
  };
}

function isAccessoryOrMachineLike(corpus: SignalCorpus) {
  if (hasAnySignal(corpus.nameText, CONTAMINANT_STRONG_NAME_PATTERNS)) {
    return true;
  }

  if (hasAnySignal(corpus.descriptionLeadText, CONTAMINANT_DESCRIPTION_PATTERNS)) {
    return true;
  }

  return (
    hasAnySignal(corpus.tagText, CONTAMINANT_TAG_NAME_PATTERNS) ||
    (hasAnySignal(corpus.tagText, CONTAMINANT_SUPPORT_PATTERNS) &&
      hasAnySignal(corpus.nameText, CONTAMINANT_SUPPORT_PATTERNS))
  );
}

function selectCareSubtypeFromText(text: string) {
  if (!text) {
    return null;
  }

  if (hasAnySignal(text, LINGERIE_STRONG_PATTERNS)) {
    return "lingerie" as const;
  }

  if (hasAnySignal(text, CONDOM_STRONG_PATTERNS)) {
    return "condom" as const;
  }

  if (hasAnySignal(text, LUBE_STRONG_PATTERNS)) {
    return "lube_care" as const;
  }

  return null;
}

function selectCareAccessorySubtype(corpus: SignalCorpus) {
  const nameSubtype = selectCareSubtypeFromText(corpus.nameText);
  if (nameSubtype) {
    return nameSubtype;
  }

  const trustedDeviceText = [
    corpus.nameText,
    corpus.tagText,
    corpus.descriptionLeadText,
  ]
    .filter(Boolean)
    .join("\n");

  if (hasAnySignal(trustedDeviceText, DEVICE_BLOCKER_PATTERNS)) {
    return null;
  }

  const tagSubtype = selectCareSubtypeFromText(corpus.tagText);
  if (tagSubtype) {
    return tagSubtype;
  }

  return null;
}

function normalizeAudienceGender(
  gender?: string | null,
): ResolvedLibraryAudienceGender | null {
  const normalizedGender = normalizeValue(gender);
  if (
    normalizedGender === "female" ||
    normalizedGender === "male" ||
    normalizedGender === "unisex"
  ) {
    return normalizedGender;
  }

  return null;
}

function inferExplicitAudienceGender(corpus: SignalCorpus) {
  const trustedAudienceText = [
    corpus.nameText,
    corpus.tagText,
    corpus.descriptionLeadText,
  ]
    .filter(Boolean)
    .join("\n");

  const hasUnisexAudienceSignals = hasAnySignal(
    trustedAudienceText,
    UNISEX_AUDIENCE_PATTERNS,
  );
  const hasFemaleAudienceSignals = hasAnySignal(
    trustedAudienceText,
    FEMALE_AUDIENCE_PATTERNS,
  );
  const hasMaleAudienceSignals = hasAnySignal(
    trustedAudienceText,
    MALE_AUDIENCE_PATTERNS,
  );

  if (hasUnisexAudienceSignals) {
    return "unisex" as const;
  }

  if (hasFemaleAudienceSignals && !hasMaleAudienceSignals) {
    return "female" as const;
  }

  if (hasMaleAudienceSignals && !hasFemaleAudienceSignals) {
    return "male" as const;
  }

  return null;
}

export function isLibraryContaminantInput(input: LibraryTypeClassifierInput) {
  return isAccessoryOrMachineLike(buildSignalCorpus(input));
}

function scoreBySource(
  corpus: SignalCorpus,
  patterns: RegExp[],
  weights: {
    name?: number;
    description?: number;
    tags?: number;
  },
) {
  return (
    scoreSignalMatches(corpus.nameText, patterns, weights.name ?? 0) +
    scoreSignalMatches(corpus.descriptionLeadText, patterns, weights.description ?? 0) +
    scoreSignalMatches(corpus.tagText, patterns, weights.tags ?? 0)
  );
}

type LibraryTypeClassificationContext = {
  storedGender: ResolvedLibraryAudienceGender | null;
  physicalForm: string;
  corpus: SignalCorpus;
  signalText: string;
  tagText: string;
  hasSuction: boolean;
  hasExternalVibe: boolean;
  hasDualStimulation: boolean;
  hasInsertable: boolean;
  hasMasturbator: boolean;
  hasProstate: boolean;
  hasCockRing: boolean;
  hasCouples: boolean;
  hasRemote: boolean;
  hasWearable: boolean;
  hasPantyWearableSignals: boolean;
  hasCuratedGSpotTag: boolean;
  hasCuratedClitoralTag: boolean;
  hasCuratedDualTag: boolean;
  hasPairedTargetZones: boolean;
  hasRabbitSimultaneousSignals: boolean;
  careAccessorySubtype: "lingerie" | "condom" | "lube_care" | null;
};

function buildClassificationContext(
  input: LibraryTypeClassifierInput,
): LibraryTypeClassificationContext {
  const physicalForm = normalizeValue(input.physicalForm);
  const corpus = buildSignalCorpus(input);
  const signalText = corpus.signalText;
  const tagText = corpus.tagText;
  const hasSuction = hasAnySignal(signalText, SUCTION_PATTERNS);
  const hasExternalVibe = hasAnySignal(signalText, EXTERNAL_VIBE_PATTERNS);
  const hasDualStimulation = hasAnySignal(signalText, DUAL_STIMULATION_PATTERNS);
  const hasInsertable = hasAnySignal(signalText, INSERTABLE_PATTERNS);
  const hasMasturbator = hasAnySignal(signalText, MASTURBATOR_PATTERNS);
  const hasProstate = hasAnySignal(signalText, PROSTATE_PATTERNS);
  const hasCockRing = hasAnySignal(signalText, COCK_RING_PATTERNS);
  const hasCouples = hasAnySignal(signalText, COUPLES_PATTERNS);
  const hasRemote = hasAnySignal(signalText, REMOTE_PATTERNS);
  const hasWearable =
    hasAnySignal(signalText, WEARABLE_PATTERNS) &&
    !hasAnySignal(signalText, NEGATED_WEARABLE_PATTERNS);
  const hasPantyWearableSignals = hasAnySignal(signalText, PANTY_WEARABLE_PATTERNS);
  const hasCuratedGSpotTag = /g点刺激/u.test(tagText);
  const hasCuratedClitoralTag = /阴蒂刺激/u.test(tagText);
  const hasCuratedDualTag =
    /双刺激|兔耳双刺激|内外刺激|双头/u.test(tagText) ||
    (hasCuratedGSpotTag && hasCuratedClitoralTag);
  const hasPairedTargetZones =
    hasCuratedDualTag ||
    /g点.{0,8}(阴蒂|clit|clitoral)/u.test(signalText) ||
    /(阴蒂|clit|clitoral).{0,8}g点/u.test(signalText);
  const hasRabbitSimultaneousSignals =
    /兔嘴兔耳|兔耳.{0,6}同时刺激|同时刺激/u.test(signalText);

  return {
    storedGender: normalizeAudienceGender(input.gender),
    physicalForm,
    corpus,
    signalText,
    tagText,
    hasSuction,
    hasExternalVibe,
    hasDualStimulation,
    hasInsertable,
    hasMasturbator,
    hasProstate,
    hasCockRing,
    hasCouples,
    hasRemote,
    hasWearable,
    hasPantyWearableSignals,
    hasCuratedGSpotTag,
    hasCuratedClitoralTag,
    hasCuratedDualTag,
    hasPairedTargetZones,
    hasRabbitSimultaneousSignals,
    careAccessorySubtype: selectCareAccessorySubtype(corpus),
  };
}

function selectTopScoredType(
  scores: Record<LibraryTypeCode, number>,
  typeOrder: LibraryTypeCode[],
  minimumScore: number,
): LibraryTypeCode {
  let bestType: LibraryTypeCode = "unknown";
  let bestScore = minimumScore - 1;

  for (const typeCode of typeOrder) {
    const score = scores[typeCode] ?? 0;

    if (score > bestScore) {
      bestScore = score;
      bestType = typeCode;
    }
  }

  return bestScore >= minimumScore ? bestType : "unknown";
}

function classifyFemaleTypeFromContext(
  context: LibraryTypeClassificationContext,
): LibraryTypeCode {
  const insertableStrongScore = scoreBySource(
    context.corpus,
    INSERTABLE_STRONG_PATTERNS,
    { name: 5, description: 4, tags: 4 },
  );
  const insertableWeakScore = scoreBySource(
    context.corpus,
    INSERTABLE_WEAK_PATTERNS,
    { name: 1, description: 1, tags: 1 },
  );
  const clitoralScore = scoreBySource(
    context.corpus,
    CLITORAL_PATTERNS,
    { name: 2, description: 2, tags: 2 },
  );
  const hasSemanticEvidence =
    context.hasSuction ||
    context.hasExternalVibe ||
    context.hasDualStimulation ||
    context.hasInsertable ||
    context.hasCuratedDualTag ||
    context.hasCuratedGSpotTag ||
    context.hasCuratedClitoralTag ||
    insertableStrongScore > 0 ||
    insertableWeakScore > 0 ||
    clitoralScore > 0;

  const scores: Record<LibraryTypeCode, number> = {
    suction: scoreBySource(context.corpus, SUCTION_PATTERNS, {
      name: 7,
      description: 6,
      tags: 5,
    }),
    external_vibe: scoreBySource(context.corpus, EXTERNAL_VIBE_PATTERNS, {
      name: 5,
      description: 4,
      tags: 4,
    }),
    insertable: insertableStrongScore + insertableWeakScore,
    dual_stimulation: scoreBySource(context.corpus, DUAL_STIMULATION_PATTERNS, {
      name: 6,
      description: 5,
      tags: 5,
    }),
    masturbator: 0,
    prostate: 0,
    cock_ring: 0,
    couples: 0,
    wearable_remote: 0,
    care_accessory: 0,
    unknown: 0,
  };

  if (context.physicalForm === "composite" && hasSemanticEvidence) {
    scores.dual_stimulation += 6;
  }

  if (
    context.physicalForm === "internal" &&
    (context.hasInsertable || insertableStrongScore > 0 || insertableWeakScore > 0)
  ) {
    scores.insertable += 4;
  }

  if (context.physicalForm === "external") {
    if (context.hasExternalVibe || clitoralScore > 0) {
      scores.external_vibe += 3;
    }

    if (context.hasSuction) {
      scores.suction += 2;
    }
  }

  if (context.hasRemote && context.hasWearable) {
    scores.wearable_remote += context.hasPantyWearableSignals ? 10 : 8;
  }

  if (context.hasCuratedDualTag) {
    scores.dual_stimulation += 5;
  }

  if (context.hasPairedTargetZones && context.hasSuction) {
    scores.dual_stimulation += 7;
  }

  if (
    context.hasRabbitSimultaneousSignals &&
    (context.hasSuction || insertableStrongScore > 0)
  ) {
    scores.dual_stimulation += 7;
  }

  if (
    insertableStrongScore > 0 &&
    (clitoralScore > 0 || context.hasExternalVibe || context.hasSuction)
  ) {
    scores.dual_stimulation += 4;
  } else if (
    insertableWeakScore > 0 &&
    clitoralScore > 0 &&
    (context.hasExternalVibe || context.hasSuction)
  ) {
    scores.dual_stimulation += 3;
  }

  if (clitoralScore > 0) {
    scores.external_vibe += Math.min(clitoralScore, 2);
  }

  return selectTopScoredType(
    scores,
    ["wearable_remote", "dual_stimulation", "suction", "external_vibe", "insertable"],
    3,
  );
}

function classifyMaleTypeFromContext(
  context: LibraryTypeClassificationContext,
): LibraryTypeCode {
  if (context.hasProstate) {
    return "prostate";
  }

  if (context.hasCockRing) {
    return "cock_ring";
  }

  if (context.hasMasturbator) {
    return "masturbator";
  }

  return "unknown";
}

function classifyUnisexTypeFromContext(
  context: LibraryTypeClassificationContext,
  femaleTypeCode: LibraryTypeCode,
  maleTypeCode: LibraryTypeCode,
): LibraryTypeCode {
  if (context.hasRemote && context.hasWearable) {
    return "wearable_remote";
  }

  if (context.hasCouples) {
    return "couples";
  }

  if (femaleTypeCode !== "unknown" && maleTypeCode !== "unknown") {
    return "couples";
  }

  return "unknown";
}

function selectCareAudienceGender(
  context: LibraryTypeClassificationContext,
  explicitAudienceGender: ResolvedLibraryAudienceGender | null,
): ResolvedLibraryAudienceGender {
  if (explicitAudienceGender) {
    return explicitAudienceGender;
  }

  if (context.careAccessorySubtype === "lingerie") {
    return context.storedGender === "male" ? "male" : "female";
  }

  return context.storedGender ?? "unisex";
}

function resolveAudienceGenderFromContext(
  context: LibraryTypeClassificationContext,
  femaleTypeCode: LibraryTypeCode,
  maleTypeCode: LibraryTypeCode,
  unisexTypeCode: LibraryTypeCode,
): ResolvedLibraryAudienceGender {
  const explicitAudienceGender = inferExplicitAudienceGender(context.corpus);

  if (context.careAccessorySubtype) {
    return selectCareAudienceGender(context, explicitAudienceGender);
  }

  if (explicitAudienceGender === "unisex") {
    return "unisex";
  }

  if (explicitAudienceGender === "female" && femaleTypeCode !== "unknown") {
    return "female";
  }

  if (explicitAudienceGender === "male" && maleTypeCode !== "unknown") {
    return "male";
  }

  if (context.storedGender === "female" && femaleTypeCode !== "unknown") {
    return "female";
  }

  if (context.storedGender === "male" && maleTypeCode !== "unknown") {
    return "male";
  }

  if (context.storedGender === "unisex" && unisexTypeCode !== "unknown") {
    return "unisex";
  }

  if (femaleTypeCode !== "unknown" && maleTypeCode === "unknown") {
    return "female";
  }

  if (maleTypeCode !== "unknown" && femaleTypeCode === "unknown") {
    return "male";
  }

  if (
    femaleTypeCode !== "unknown" &&
    maleTypeCode !== "unknown" &&
    unisexTypeCode !== "unknown"
  ) {
    return "unisex";
  }

  return context.storedGender ?? "unisex";
}

function selectSubtypeFromSignals(
  resolvedTypeCode: LibraryTypeCode,
  corpus: SignalCorpus,
  hasSuction: boolean,
  hasCuratedDualTag: boolean,
  hasPairedTargetZones: boolean,
  hasRabbitSimultaneousSignals: boolean,
  insertableStrongScore: number,
) {
  const trustedSubtypeText = [
    corpus.nameText,
    corpus.tagText,
    corpus.descriptionLeadText,
  ]
    .filter(Boolean)
    .join("\n");
  const hasDualHeadSignals = /双头|dual[-\s]*ended/u.test(trustedSubtypeText);
  const hasRabbitNameOrTagSignals = /兔耳|兔嘴|兔嘴兔耳|兔子|\brabbit\b/u.test(
    [corpus.nameText, corpus.tagText].filter(Boolean).join("\n"),
  );
  const hasRabbitDescriptionSignals = /兔耳|兔嘴|兔嘴兔耳|兔子|\brabbit\b/u.test(
    corpus.descriptionLeadText,
  );
  const hasRabbitSignals =
    hasRabbitNameOrTagSignals ||
    (hasRabbitDescriptionSignals && !hasDualHeadSignals);
  const hasWandSignals = /魔杖|按摩棒|震动棒|\bwand\b/u.test(trustedSubtypeText);
  const hasBulletSignals = /跳蛋|子弹|震动蛋|口红|\bbullet\b/u.test(trustedSubtypeText);
  const hasInternalVibeSignals =
    insertableStrongScore > 0 &&
    hasAnySignal(corpus.signalText, VIBRATION_PATTERNS);
  const hasSuctionDualSignals =
    hasSuction &&
    (
      hasPairedTargetZones ||
      hasCuratedDualTag ||
      hasRabbitSimultaneousSignals ||
      insertableStrongScore > 0
    );
  const hasRemoteSignals = hasAnySignal(corpus.signalText, REMOTE_PATTERNS);
  const hasWearableSignals =
    hasAnySignal(corpus.signalText, WEARABLE_PATTERNS) &&
    !hasAnySignal(corpus.signalText, NEGATED_WEARABLE_PATTERNS);
  const hasInteractiveSignals =
    hasAnySignal(trustedSubtypeText, INTERACTIVE_PATTERNS) ||
    (hasRemoteSignals && /\bapp\b/u.test(trustedSubtypeText));
  const hasPoweredMasturbatorSignals =
    hasAnySignal(trustedSubtypeText, POWERED_MASTURBATOR_PATTERNS) ||
    hasAnySignal(trustedSubtypeText, VIBRATION_PATTERNS);
  const hasManualMasturbatorSignals = hasAnySignal(
    trustedSubtypeText,
    MANUAL_MASTURBATOR_PATTERNS,
  );
  const hasProstateVibeSignals = hasAnySignal(corpus.signalText, VIBRATION_PATTERNS);
  const hasProstatePlugSignals =
    hasAnySignal(trustedSubtypeText, PROSTATE_PLUG_PATTERNS) || insertableStrongScore > 0;
  const hasRingPowerSignals =
    hasAnySignal(trustedSubtypeText, RING_POWER_PATTERNS) ||
    hasAnySignal(trustedSubtypeText, VIBRATION_PATTERNS);
  const hasCouplesSignals = hasAnySignal(corpus.signalText, COUPLES_PATTERNS);
  const hasPantyWearableSignals = hasAnySignal(
    trustedSubtypeText,
    PANTY_WEARABLE_PATTERNS,
  );

  if (resolvedTypeCode === "masturbator") {
    if (hasInteractiveSignals) {
      return "interactive_masturbator";
    }

    if (hasPoweredMasturbatorSignals) {
      return "vibrating_masturbator";
    }

    if (hasManualMasturbatorSignals) {
      return "manual_masturbator";
    }

    return null;
  }

  if (resolvedTypeCode === "prostate") {
    if (hasProstateVibeSignals) {
      return "prostate_vibe";
    }

    if (hasProstatePlugSignals) {
      return "prostate_plug";
    }

    return null;
  }

  if (resolvedTypeCode === "cock_ring") {
    return hasRingPowerSignals ? "vibrating_cock_ring" : "classic_cock_ring";
  }

  if (resolvedTypeCode === "couples") {
    return insertableStrongScore > 0 ? "insertable_couples" : "external_couples";
  }

  if (resolvedTypeCode === "wearable_remote") {
    if (hasPantyWearableSignals) {
      return "panty_wearable";
    }

    if (hasCouplesSignals) {
      return "dual_wearable_remote";
    }

    if (insertableStrongScore > 0) {
      return "insertable_remote";
    }

    if (hasRemoteSignals && hasWearableSignals) {
      return null;
    }

    return null;
  }

  if (resolvedTypeCode === "suction") {
    return hasSuctionDualSignals ? "suction_dual" : "suction_pure";
  }

  if (resolvedTypeCode === "dual_stimulation") {
    if (hasRabbitSignals) {
      return "rabbit_dual";
    }

    if (hasSuctionDualSignals) {
      return "suction_dual";
    }

    if (hasDualHeadSignals || hasPairedTargetZones || hasCuratedDualTag) {
      return "multi_head_dual";
    }

    return null;
  }

  if (resolvedTypeCode === "external_vibe") {
    return hasWandSignals ? "wand_massager" : hasBulletSignals ? "bullet_vibe" : "bullet_vibe";
  }

  if (resolvedTypeCode === "insertable") {
    return hasInternalVibeSignals ? "insertable_vibe" : "gspot_insertable";
  }

  return null;
}

export function classifyLibraryTypeCode(
  input: LibraryTypeClassifierInput,
): LibraryTypeCode {
  const context = buildClassificationContext(input);

  if (isAccessoryOrMachineLike(context.corpus)) {
    return "unknown";
  }

  if (context.careAccessorySubtype) {
    return "care_accessory";
  }

  const femaleTypeCode = classifyFemaleTypeFromContext(context);
  const maleTypeCode = classifyMaleTypeFromContext(context);
  const unisexTypeCode = classifyUnisexTypeFromContext(
    context,
    femaleTypeCode,
    maleTypeCode,
  );
  const resolvedAudienceGender = resolveAudienceGenderFromContext(
    context,
    femaleTypeCode,
    maleTypeCode,
    unisexTypeCode,
  );

  if (resolvedAudienceGender === "female") {
    return femaleTypeCode;
  }

  if (resolvedAudienceGender === "male") {
    return maleTypeCode;
  }

  return unisexTypeCode;
}

export function resolveLibraryAudienceGender(
  input: LibraryTypeClassifierInput,
): ResolvedLibraryAudienceGender {
  const context = buildClassificationContext(input);
  const explicitAudienceGender = inferExplicitAudienceGender(context.corpus);

  if (context.careAccessorySubtype) {
    return selectCareAudienceGender(context, explicitAudienceGender);
  }

  const femaleTypeCode = classifyFemaleTypeFromContext(context);
  const maleTypeCode = classifyMaleTypeFromContext(context);
  const unisexTypeCode = classifyUnisexTypeFromContext(
    context,
    femaleTypeCode,
    maleTypeCode,
  );

  return resolveAudienceGenderFromContext(
    context,
    femaleTypeCode,
    maleTypeCode,
    unisexTypeCode,
  );
}

export function classifyLibrarySubtypeCode(
  input: LibraryTypeClassifierInput,
): LibrarySubtypeCode | null {
  const resolvedTypeCode =
    normalizeValue(input.typeCode) || classifyLibraryTypeCode(input);
  const corpus = buildSignalCorpus(input);
  const signalText = corpus.signalText;
  const tagText = corpus.tagText;
  const hasSuction = hasAnySignal(signalText, SUCTION_PATTERNS);
  const hasCuratedGSpotTag = /g点刺激/u.test(tagText);
  const hasCuratedClitoralTag = /阴蒂刺激/u.test(tagText);
  const hasCuratedDualTag =
    /双刺激|兔耳双刺激|内外刺激|双头/u.test(tagText) ||
    (hasCuratedGSpotTag && hasCuratedClitoralTag);
  const hasPairedTargetZones =
    hasCuratedDualTag ||
    /g点.{0,8}(阴蒂|clit|clitoral)/u.test(signalText) ||
    /(阴蒂|clit|clitoral).{0,8}g点/u.test(signalText);
  const hasRabbitSimultaneousSignals =
    /兔嘴兔耳|兔耳.{0,6}同时刺激|同时刺激/u.test(signalText);
  const insertableStrongScore = scoreBySource(
    corpus,
    INSERTABLE_STRONG_PATTERNS,
    { name: 5, description: 4, tags: 4 },
  );

  if (resolvedTypeCode === "care_accessory") {
    return selectCareAccessorySubtype(corpus);
  }

  return selectSubtypeFromSignals(
    resolvedTypeCode as LibraryTypeCode,
    corpus,
    hasSuction,
    hasCuratedDualTag,
    hasPairedTargetZones,
    hasRabbitSimultaneousSignals,
    insertableStrongScore,
  );
}

export function resolveLibraryTypeCode(
  storedTypeCode: string | null | undefined,
  input: LibraryTypeClassifierInput,
): LibraryTypeCode {
  const normalizedStoredTypeCode = normalizeValue(storedTypeCode);

  if (normalizedStoredTypeCode) {
    return normalizedStoredTypeCode as LibraryTypeCode;
  }

  return classifyLibraryTypeCode(input);
}

export function resolveLibrarySubtypeCode(
  storedSubtypeCode: string | null | undefined,
  input: LibraryTypeClassifierInput,
): LibrarySubtypeCode | null {
  const normalizedStoredSubtypeCode = normalizeValue(storedSubtypeCode);
  const resolvedTypeCode = resolveLibraryTypeCode(input.typeCode, input);

  if (normalizedStoredSubtypeCode) {
    const parentTypeCode = getParentLibraryTypeCodeForSubtype(normalizedStoredSubtypeCode);
    if (parentTypeCode === resolvedTypeCode) {
      return normalizedStoredSubtypeCode as LibrarySubtypeCode;
    }
  }

  return classifyLibrarySubtypeCode({
    ...input,
    typeCode: resolvedTypeCode,
  });
}
