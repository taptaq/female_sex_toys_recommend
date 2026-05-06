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

function normalizeValue(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function collectSignalText(input: LibraryTypeClassifierInput) {
  return [input.name, input.rawDescription, ...(input.tags ?? [])]
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
  /魔杖/u,
  /\bvibe\b/u,
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
  /自慰杯/u,
  /手冲杯/u,
  /名器/u,
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
  /环体/u,
  /环类/u,
  /cock\s*ring/u,
  /penis\s*ring/u,
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

const CONTAMINANT_NAME_PATTERNS = [
  /\bsex\s*machine\b/u,
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
    descriptionLeadText: normalizeValue(input.rawDescription).slice(0, 320),
    tagText: (input.tags ?? []).join("\n").toLowerCase(),
    signalText: collectSignalText(input),
  };
}

function isAccessoryOrMachineLike(corpus: SignalCorpus) {
  if (hasAnySignal(corpus.nameText, CONTAMINANT_NAME_PATTERNS)) {
    return true;
  }

  return (
    hasAnySignal(corpus.tagText, CONTAMINANT_NAME_PATTERNS) ||
    (hasAnySignal(corpus.tagText, CONTAMINANT_SUPPORT_PATTERNS) &&
      hasAnySignal(corpus.nameText, CONTAMINANT_SUPPORT_PATTERNS))
  );
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
    scoreSignalMatches(corpus.descriptionText, patterns, weights.description ?? 0) +
    scoreSignalMatches(corpus.tagText, patterns, weights.tags ?? 0)
  );
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
    if (hasCouplesSignals) {
      return "dual_wearable_remote";
    }

    if (insertableStrongScore > 0) {
      return "insertable_remote";
    }

    if (hasPantyWearableSignals || (hasRemoteSignals && hasWearableSignals)) {
      return hasPantyWearableSignals ? "panty_wearable" : null;
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
  const gender = normalizeValue(input.gender);
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

  if (gender === "female") {
    if (isAccessoryOrMachineLike(corpus)) {
      return "unknown";
    }

    const insertableStrongScore = scoreBySource(
      corpus,
      INSERTABLE_STRONG_PATTERNS,
      { name: 5, description: 4, tags: 4 },
    );
    const insertableWeakScore = scoreBySource(
      corpus,
      INSERTABLE_WEAK_PATTERNS,
      { name: 1, description: 1, tags: 1 },
    );
    const clitoralScore = scoreBySource(
      corpus,
      CLITORAL_PATTERNS,
      { name: 2, description: 2, tags: 2 },
    );
    const hasSemanticEvidence =
      hasSuction ||
      hasExternalVibe ||
      hasDualStimulation ||
      hasInsertable ||
      hasCuratedDualTag ||
      hasCuratedGSpotTag ||
      hasCuratedClitoralTag ||
      insertableStrongScore > 0 ||
      insertableWeakScore > 0 ||
      clitoralScore > 0;

    const scores: Record<LibraryTypeCode, number> = {
      suction: scoreBySource(corpus, SUCTION_PATTERNS, {
        name: 7,
        description: 6,
        tags: 5,
      }),
      external_vibe: scoreBySource(corpus, EXTERNAL_VIBE_PATTERNS, {
        name: 5,
        description: 4,
        tags: 4,
      }),
      insertable: insertableStrongScore + insertableWeakScore,
      dual_stimulation: scoreBySource(corpus, DUAL_STIMULATION_PATTERNS, {
        name: 6,
        description: 5,
        tags: 5,
      }),
      masturbator: 0,
      prostate: 0,
      cock_ring: 0,
      couples: 0,
      wearable_remote: 0,
      unknown: 0,
    };

    if (physicalForm === "composite" && hasSemanticEvidence) {
      scores.dual_stimulation += 6;
    }

    if (
      physicalForm === "internal" &&
      (hasInsertable || insertableStrongScore > 0 || insertableWeakScore > 0)
    ) {
      scores.insertable += 4;
    }

    if (physicalForm === "external") {
      if (hasExternalVibe || clitoralScore > 0) {
        scores.external_vibe += 3;
      }

      if (hasSuction) {
        scores.suction += 2;
      }
    }

    if (hasCuratedDualTag) {
      scores.dual_stimulation += 5;
    }

    if (hasPairedTargetZones && hasSuction) {
      scores.dual_stimulation += 7;
    }

    if (hasRabbitSimultaneousSignals && (hasSuction || insertableStrongScore > 0)) {
      scores.dual_stimulation += 7;
    }

    if (insertableStrongScore > 0 && (clitoralScore > 0 || hasExternalVibe || hasSuction)) {
      scores.dual_stimulation += 4;
    } else if (
      insertableWeakScore > 0 &&
      clitoralScore > 0 &&
      (hasExternalVibe || hasSuction)
    ) {
      scores.dual_stimulation += 3;
    }

    if (clitoralScore > 0) {
      scores.external_vibe += Math.min(clitoralScore, 2);
    }

    return selectTopScoredType(
      scores,
      ["dual_stimulation", "suction", "external_vibe", "insertable"],
      3,
    );
  }

  if (gender === "male") {
    if (hasProstate) {
      return "prostate";
    }

    if (hasCockRing) {
      return "cock_ring";
    }

    if (hasMasturbator) {
      return "masturbator";
    }

    return "unknown";
  }

  if (gender === "unisex") {
    if (isAccessoryOrMachineLike(corpus)) {
      return "unknown";
    }

    if (hasRemote && hasWearable) {
      return "wearable_remote";
    }

    if (hasCouples) {
      return "couples";
    }

    return "unknown";
  }

  return "unknown";
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
