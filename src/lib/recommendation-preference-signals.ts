import type { AnswerState, Product, Question, QuestionOption } from "../data/mock.js";
import { buildProductDisguiseSignalsSummary } from "./product-disguise-signals.js";

export type PreferenceSignalImpact = "score" | "explanation";

export type RecommendationPreferenceSignal = {
  id: string;
  label: string;
  source: string;
  weight: number;
  impacts: PreferenceSignalImpact[];
};

export type PreferenceSignalAdjustment = {
  score: number;
  summary: string[];
};

type SignalTemplate = Omit<RecommendationPreferenceSignal, "source">;

const TAG_SIGNAL_TEMPLATES: Record<string, SignalTemplate[]> = {
  女性向: [{ id: "audience.female", label: "女性向", weight: 5, impacts: ["score", "explanation"] }],
  男性向: [{ id: "audience.male", label: "男性向", weight: 5, impacts: ["score", "explanation"] }],
  情侣共玩: [{ id: "audience.couple", label: "情侣共玩", weight: 5, impacts: ["score", "explanation"] }],

  "外部震动/吮吸": [{ id: "stimulation.external", label: "外部反馈", weight: 7, impacts: ["score", "explanation"] }],
  纯入体: [{ id: "stimulation.internal", label: "入体探索", weight: 7, impacts: ["score", "explanation"] }],
  复合机型: [{ id: "stimulation.composite", label: "复合刺激", weight: 7, impacts: ["score", "explanation"] }],
  路线待判断: [{ id: "uncertain.route", label: "路线待判断", weight: 4, impacts: ["score", "explanation"] }],

  温柔慢热: [{ id: "intensity.gentle", label: "温柔慢热", weight: 6, impacts: ["score", "explanation"] }],
  平衡进阶: [{ id: "intensity.balanced", label: "平衡进阶", weight: 5, impacts: ["score", "explanation"] }],
  强刺激偏好: [{ id: "intensity.strong", label: "强刺激", weight: 6, impacts: ["score", "explanation"] }],
  敏感度待判断: [{ id: "uncertain.intensity", label: "敏感度待判断", weight: 4, impacts: ["score", "explanation"] }],

  阴蒂刺激: [{ id: "pleasure.clitoral", label: "阴蒂/外部刺激", weight: 9, impacts: ["score", "explanation"] }],
  G点刺激: [{ id: "pleasure.gspot", label: "G 点刺激", weight: 9, impacts: ["score", "explanation"] }],
  内外双刺激: [{ id: "pleasure.dual", label: "内外双刺激", weight: 9, impacts: ["score", "explanation"] }],
  乳头刺激: [{ id: "pleasure.nipple", label: "乳头/身体表面刺激", weight: 8, impacts: ["score", "explanation"] }],
  肛门刺激: [{ id: "pleasure.anal", label: "肛门/后庭刺激", weight: 8, impacts: ["score", "explanation"] }],
  部位待判断: [{ id: "uncertain.pleasure_focus", label: "部位待判断", weight: 4, impacts: ["score", "explanation"] }],

  想要温热: [{ id: "temperature.want", label: "想要温热", weight: 4, impacts: ["score", "explanation"] }],
  不要加热: [{ id: "temperature.avoid", label: "不要加热", weight: 3, impacts: ["score", "explanation"] }],
  温热不限定: [{ id: "temperature.neutral", label: "温热不限定", weight: 2, impacts: ["score", "explanation"] }],

  需要APP支持: [{ id: "app.required", label: "需要 APP/远控", weight: 6, impacts: ["score", "explanation"] }],
  不需要APP: [{ id: "app.avoid", label: "不需要 APP", weight: 5, impacts: ["score", "explanation"] }],
  APP不限定: [{ id: "app.neutral", label: "APP 不限定", weight: 2, impacts: ["score", "explanation"] }],

  "< 40dB": [{ id: "noise.strict", label: "极致静音", weight: 6, impacts: ["score", "explanation"] }],
  "< 50dB": [{ id: "noise.moderate", label: "一般静音", weight: 4, impacts: ["score", "explanation"] }],
  无限制分贝: [{ id: "noise.open", label: "不限制声音", weight: 2, impacts: ["score", "explanation"] }],
  静音待判断: [{ id: "uncertain.noise", label: "静音待判断", weight: 3, impacts: ["score", "explanation"] }],

  "≥ IPX7 防水": [{ id: "maintenance.easy", label: "省心清洁", weight: 5, impacts: ["score", "explanation"] }],
  基础防水: [{ id: "maintenance.standard", label: "基础维护", weight: 3, impacts: ["score", "explanation"] }],
  易清洁优先: [{ id: "maintenance.easy", label: "省心清洁", weight: 5, impacts: ["score", "explanation"] }],
  常规维护: [{ id: "maintenance.standard", label: "常规维护", weight: 3, impacts: ["score", "explanation"] }],
  快速清洁: [{ id: "maintenance.easy", label: "快速清洁", weight: 5, impacts: ["score", "explanation"] }],
  常规清洁: [{ id: "maintenance.standard", label: "常规清洁", weight: 3, impacts: ["score", "explanation"] }],
  清洁待判断: [{ id: "uncertain.cleanup", label: "清洁待判断", weight: 3, impacts: ["score", "explanation"] }],

  入门级: [{ id: "budget.entry", label: "入门预算", weight: 4, impacts: ["score", "explanation"] }],
  进阶级: [{ id: "budget.mid", label: "标准预算", weight: 4, impacts: ["score", "explanation"] }],
  旗舰级: [{ id: "budget.premium", label: "探索预算", weight: 4, impacts: ["score", "explanation"] }],
  预算待判断: [{ id: "uncertain.budget", label: "预算待判断", weight: 3, impacts: ["score", "explanation"] }],

  高伪装: [{ id: "privacy.high", label: "高伪装", weight: 5, impacts: ["score", "explanation"] }],
  无伪装限制: [{ id: "privacy.open", label: "无伪装限制", weight: 2, impacts: ["score", "explanation"] }],
  低存在感收纳: [{ id: "privacy.high", label: "低存在感收纳", weight: 5, impacts: ["score", "explanation"] }],
  体验优先: [{ id: "privacy.open", label: "体验优先", weight: 2, impacts: ["score", "explanation"] }],
  低压力收纳: [{ id: "privacy.high", label: "低压力收纳", weight: 5, impacts: ["score", "explanation"] }],
  互动体验优先: [{ id: "privacy.open", label: "互动体验优先", weight: 2, impacts: ["score", "explanation"] }],
  收纳待判断: [{ id: "uncertain.privacy", label: "收纳待判断", weight: 3, impacts: ["score", "explanation"] }],

  手动型: [{ id: "male.drive.manual", label: "手动主导", weight: 6, impacts: ["score", "explanation"] }],
  自动型: [{ id: "male.drive.automatic", label: "自动驱动", weight: 6, impacts: ["score", "explanation"] }],
  复合型: [{ id: "male.drive.hybrid", label: "复合附件", weight: 5, impacts: ["score", "explanation"] }],
  驱动待判断: [{ id: "uncertain.drive", label: "驱动待判断", weight: 3, impacts: ["score", "explanation"] }],

  慢玩柔软: [{ id: "male.channel.soft", label: "柔软包裹", weight: 5, impacts: ["score", "explanation"] }],
  平衡真实: [{ id: "male.channel.balanced", label: "平衡真实", weight: 5, impacts: ["score", "explanation"] }],
  紧致刺激: [{ id: "male.channel.tight", label: "紧致刺激", weight: 5, impacts: ["score", "explanation"] }],
  刺激风格待判断: [{ id: "uncertain.channel", label: "刺激风格待判断", weight: 3, impacts: ["score", "explanation"] }],

  慢玩持久: [{ id: "male.goal.slow", label: "慢玩持久", weight: 5, impacts: ["score", "explanation"] }],
  日常释放: [{ id: "male.goal.daily", label: "日常释放", weight: 5, impacts: ["score", "explanation"] }],
  快速高刺激: [{ id: "male.goal.explosive", label: "快速高刺激", weight: 5, impacts: ["score", "explanation"] }],
  使用节奏待判断: [{ id: "uncertain.session_goal", label: "使用节奏待判断", weight: 3, impacts: ["score", "explanation"] }],

  同步共振: [{ id: "couple.interaction.sync", label: "同步共振", weight: 6, impacts: ["score", "explanation"] }],
  主导互动: [{ id: "couple.interaction.guided", label: "主导互动", weight: 6, impacts: ["score", "explanation"] }],
  远控氛围: [{ id: "couple.interaction.remote", label: "远控氛围", weight: 6, impacts: ["score", "explanation"] }],
  互动方式待判断: [{ id: "uncertain.interaction", label: "互动方式待判断", weight: 3, impacts: ["score", "explanation"] }],

  异性搭配: [{ id: "couple.partner.mixed", label: "异性搭配", weight: 7, impacts: ["score", "explanation"] }],
  男男搭配: [{ id: "couple.partner.male_male", label: "男男搭配", weight: 7, impacts: ["score", "explanation"] }],
  女女搭配: [{ id: "couple.partner.female_female", label: "女女搭配", weight: 7, impacts: ["score", "explanation"] }],
  对象不限定: [{ id: "couple.partner.open", label: "对象不限定", weight: 4, impacts: ["score", "explanation"] }],

  稳定贴合: [{ id: "couple.fit.wearable", label: "稳定贴合", weight: 5, impacts: ["score", "explanation"] }],
  手持灵活: [{ id: "couple.fit.handheld", label: "手持灵活", weight: 5, impacts: ["score", "explanation"] }],
  使用姿态待判断: [{ id: "uncertain.fit", label: "使用姿态待判断", weight: 3, impacts: ["score", "explanation"] }],

  安静私密: [{ id: "couple.scene.quiet", label: "安静私密", weight: 5, impacts: ["score", "explanation"] }],
  卧室常用: [{ id: "couple.scene.bedroom", label: "卧室常用", weight: 5, impacts: ["score", "explanation"] }],
  氛围尝鲜: [{ id: "couple.scene.playful", label: "氛围尝鲜", weight: 5, impacts: ["score", "explanation"] }],
  共玩场景待判断: [{ id: "uncertain.couple_scene", label: "共玩场景待判断", weight: 3, impacts: ["score", "explanation"] }],

  温和舒适: [{ id: "couple.intensity.gentle", label: "温和舒适", weight: 5, impacts: ["score", "explanation"] }],
  平衡层次: [{ id: "couple.intensity.balanced", label: "平衡层次", weight: 5, impacts: ["score", "explanation"] }],
  强反馈: [{ id: "couple.intensity.strong", label: "强反馈", weight: 5, impacts: ["score", "explanation"] }],
  双方偏好待判断: [{ id: "uncertain.shared_intensity", label: "双方偏好待判断", weight: 3, impacts: ["score", "explanation"] }],
};

function normalizeText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildProductText(product: Product) {
  return [
    product.name,
    product.canonicalName,
    product.displayName,
    product.safeDisplayName,
    product.brand,
    ...(product.tags ?? []),
    product.rawDescription ?? "",
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join("\n");
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function createSignals(source: string, templates: SignalTemplate[] = []) {
  return templates.map((template) => ({ ...template, source }));
}

function dedupeSignals(signals: RecommendationPreferenceSignal[]) {
  const map = new Map<string, RecommendationPreferenceSignal>();
  for (const signal of signals) {
    const existing = map.get(signal.id);
    if (!existing || signal.weight > existing.weight) {
      map.set(signal.id, signal);
    }
  }
  return [...map.values()];
}

export function getQuestionOptionPreferenceSignals(
  question: Question,
  option: QuestionOption,
) {
  const tagSignals = createSignals(
    `${question.id}:${option.tag}`,
    TAG_SIGNAL_TEMPLATES[option.tag],
  );

  return dedupeSignals(tagSignals);
}

export function buildRecommendationPreferenceSignals(answers: AnswerState) {
  const signals: RecommendationPreferenceSignal[] = [];

  for (const tag of answers.tags ?? []) {
    signals.push(...createSignals(`tag:${tag}`, TAG_SIGNAL_TEMPLATES[tag]));
  }

  if (answers.gender === "female") signals.push(...createSignals("field:gender", TAG_SIGNAL_TEMPLATES["女性向"]));
  if (answers.gender === "male") signals.push(...createSignals("field:gender", TAG_SIGNAL_TEMPLATES["男性向"]));
  if (answers.gender === "unisex") signals.push(...createSignals("field:gender", TAG_SIGNAL_TEMPLATES["情侣共玩"]));
  if (answers.physicalForm === "external") signals.push(...createSignals("field:physicalForm", TAG_SIGNAL_TEMPLATES["外部震动/吮吸"]));
  if (answers.physicalForm === "internal") signals.push(...createSignals("field:physicalForm", TAG_SIGNAL_TEMPLATES["纯入体"]));
  if (answers.physicalForm === "composite") signals.push(...createSignals("field:physicalForm", TAG_SIGNAL_TEMPLATES["复合机型"]));
  if (answers.motorType === "gentle") signals.push(...createSignals("field:motorType", TAG_SIGNAL_TEMPLATES["温柔慢热"]));
  if (answers.motorType === "strong") signals.push(...createSignals("field:motorType", TAG_SIGNAL_TEMPLATES["强刺激偏好"]));
  if (answers.pleasureFocus === "clitoral") signals.push(...createSignals("field:pleasureFocus", TAG_SIGNAL_TEMPLATES["阴蒂刺激"]));
  if (answers.pleasureFocus === "gspot") signals.push(...createSignals("field:pleasureFocus", TAG_SIGNAL_TEMPLATES["G点刺激"]));
  if (answers.pleasureFocus === "dual") signals.push(...createSignals("field:pleasureFocus", TAG_SIGNAL_TEMPLATES["内外双刺激"]));
  if (answers.pleasureFocus === "nipple") signals.push(...createSignals("field:pleasureFocus", TAG_SIGNAL_TEMPLATES["乳头刺激"]));
  if (answers.pleasureFocus === "anal") signals.push(...createSignals("field:pleasureFocus", TAG_SIGNAL_TEMPLATES["肛门刺激"]));
  if (answers.pleasureFocus === "unsure") signals.push(...createSignals("field:pleasureFocus", TAG_SIGNAL_TEMPLATES["部位待判断"]));
  if (answers.temperaturePreference === "want") signals.push(...createSignals("field:temperaturePreference", TAG_SIGNAL_TEMPLATES["想要温热"]));
  if (answers.temperaturePreference === "avoid") signals.push(...createSignals("field:temperaturePreference", TAG_SIGNAL_TEMPLATES["不要加热"]));
  if (answers.temperaturePreference === "neutral") signals.push(...createSignals("field:temperaturePreference", TAG_SIGNAL_TEMPLATES["温热不限定"]));
  if (answers.appSupportPreference === "required") signals.push(...createSignals("field:appSupportPreference", TAG_SIGNAL_TEMPLATES.需要APP支持));
  if (answers.appSupportPreference === "avoid_app") signals.push(...createSignals("field:appSupportPreference", TAG_SIGNAL_TEMPLATES.不需要APP));
  if (answers.appSupportPreference === "neutral_app") signals.push(...createSignals("field:appSupportPreference", TAG_SIGNAL_TEMPLATES.APP不限定));
  if (answers.appearance === "high_disguise") signals.push(...createSignals("field:appearance", TAG_SIGNAL_TEMPLATES["高伪装"]));
  if (answers.appearance === "normal") signals.push(...createSignals("field:appearance", TAG_SIGNAL_TEMPLATES["无伪装限制"]));
  if (answers.driveMode === "manual") signals.push(...createSignals("field:driveMode", TAG_SIGNAL_TEMPLATES["手动型"]));
  if (answers.driveMode === "automatic") signals.push(...createSignals("field:driveMode", TAG_SIGNAL_TEMPLATES["自动型"]));
  if (answers.driveMode === "hybrid") signals.push(...createSignals("field:driveMode", TAG_SIGNAL_TEMPLATES["复合型"]));
  if (answers.channelFeel === "soft") signals.push(...createSignals("field:channelFeel", TAG_SIGNAL_TEMPLATES["慢玩柔软"]));
  if (answers.channelFeel === "balanced") signals.push(...createSignals("field:channelFeel", TAG_SIGNAL_TEMPLATES["平衡真实"]));
  if (answers.channelFeel === "tight") signals.push(...createSignals("field:channelFeel", TAG_SIGNAL_TEMPLATES["紧致刺激"]));
  if (answers.sessionGoal === "slow") signals.push(...createSignals("field:sessionGoal", TAG_SIGNAL_TEMPLATES["慢玩持久"]));
  if (answers.sessionGoal === "daily") signals.push(...createSignals("field:sessionGoal", TAG_SIGNAL_TEMPLATES["日常释放"]));
  if (answers.sessionGoal === "explosive") signals.push(...createSignals("field:sessionGoal", TAG_SIGNAL_TEMPLATES["快速高刺激"]));
  if (answers.interactionMode === "sync") signals.push(...createSignals("field:interactionMode", TAG_SIGNAL_TEMPLATES["同步共振"]));
  if (answers.interactionMode === "guided") signals.push(...createSignals("field:interactionMode", TAG_SIGNAL_TEMPLATES["主导互动"]));
  if (answers.interactionMode === "remote") signals.push(...createSignals("field:interactionMode", TAG_SIGNAL_TEMPLATES["远控氛围"]));
  if (answers.partnerComposition === "mixed") signals.push(...createSignals("field:partnerComposition", TAG_SIGNAL_TEMPLATES["异性搭配"]));
  if (answers.partnerComposition === "male_male") signals.push(...createSignals("field:partnerComposition", TAG_SIGNAL_TEMPLATES["男男搭配"]));
  if (answers.partnerComposition === "female_female") signals.push(...createSignals("field:partnerComposition", TAG_SIGNAL_TEMPLATES["女女搭配"]));
  if (answers.partnerComposition === "open") signals.push(...createSignals("field:partnerComposition", TAG_SIGNAL_TEMPLATES.对象不限定));
  if (answers.fitPreference === "wearable") signals.push(...createSignals("field:fitPreference", TAG_SIGNAL_TEMPLATES["稳定贴合"]));
  if (answers.fitPreference === "handheld") signals.push(...createSignals("field:fitPreference", TAG_SIGNAL_TEMPLATES["手持灵活"]));
  if (answers.coupleScene === "quiet") signals.push(...createSignals("field:coupleScene", TAG_SIGNAL_TEMPLATES["安静私密"]));
  if (answers.coupleScene === "bedroom") signals.push(...createSignals("field:coupleScene", TAG_SIGNAL_TEMPLATES["卧室常用"]));
  if (answers.coupleScene === "playful") signals.push(...createSignals("field:coupleScene", TAG_SIGNAL_TEMPLATES["氛围尝鲜"]));
  if (answers.sharedIntensity === "gentle") signals.push(...createSignals("field:sharedIntensity", TAG_SIGNAL_TEMPLATES["温和舒适"]));
  if (answers.sharedIntensity === "balanced") signals.push(...createSignals("field:sharedIntensity", TAG_SIGNAL_TEMPLATES["平衡层次"]));
  if (answers.sharedIntensity === "strong") signals.push(...createSignals("field:sharedIntensity", TAG_SIGNAL_TEMPLATES["强反馈"]));

  if (answers.maxDb != null) {
    if (answers.maxDb <= 40) signals.push(...createSignals("field:maxDb", TAG_SIGNAL_TEMPLATES["< 40dB"]));
    else if (answers.maxDb <= 50) signals.push(...createSignals("field:maxDb", TAG_SIGNAL_TEMPLATES["< 50dB"]));
    else signals.push(...createSignals("field:maxDb", TAG_SIGNAL_TEMPLATES.无限制分贝));
  }

  if (answers.waterproof != null) {
    signals.push(
      ...createSignals(
        "field:waterproof",
        answers.waterproof >= 7
          ? TAG_SIGNAL_TEMPLATES["≥ IPX7 防水"]
          : TAG_SIGNAL_TEMPLATES.基础防水,
      ),
    );
  }

  if (answers.budget != null) {
    const [, max] = answers.budget;
    if (max <= 100) signals.push(...createSignals("field:budget", TAG_SIGNAL_TEMPLATES.入门级));
    else if (max <= 300) signals.push(...createSignals("field:budget", TAG_SIGNAL_TEMPLATES.进阶级));
    else signals.push(...createSignals("field:budget", TAG_SIGNAL_TEMPLATES.旗舰级));
  }

  return dedupeSignals(signals);
}

function add(
  scoreRef: { value: number },
  summary: string[],
  condition: boolean,
  weight: number,
  reason: string,
) {
  if (!condition) return;
  scoreRef.value += weight;
  summary.push(reason);
}

function subtract(
  scoreRef: { value: number },
  summary: string[],
  condition: boolean,
  weight: number,
  reason: string,
) {
  if (!condition) return;
  scoreRef.value -= weight;
  summary.push(reason);
}

export function getPreferenceSignalAdjustment(
  product: Product,
  answers: AnswerState,
): PreferenceSignalAdjustment {
  const text = buildProductText(product);
  const signals = buildRecommendationPreferenceSignals(answers);
  const score = { value: 0 };
  const summary: string[] = [];
  const disguiseSummary = buildProductDisguiseSignalsSummary(product);
  const isMidBudget = product.price >= 100 && product.price <= 320;
  const isEasyCare = (product.waterproof ?? 0) >= 6 || hasAny(text, [/易清洗/i, /好打理/i, /省心/i, /水洗/i]);
  const isQuiet = product.maxDb != null && product.maxDb <= 50;
  const isStable = isMidBudget && isEasyCare && (product.maxDb == null || product.maxDb <= 55);
  const hasNoRemote = hasAny(text, [/不需要\s*app/i, /不要\s*app/i, /无\s*app/i, /非\s*app/i, /不带\s*app/i, /without\s*app/i, /not\s*app/i, /不需要远控/i, /不要远控/i, /无远控/i]);
  const hasRemote =
    !hasNoRemote &&
    (product.typeCode === "wearable_remote" || hasAny(text, [/远控/i, /远程/i, /\bapp\b/i, /蓝牙/i, /remote/i]));
  const hasWearable = hasAny(text, [/穿戴/i, /贴合/i, /免手持/i, /wearable/i]) || product.subtypeCode === "panty_wearable";
  const hasHandheld = hasAny(text, [/手持/i, /握持/i, /按摩棒/i, /handheld/i, /wand/i]);
  const hasSync = hasAny(text, [/同步/i, /共振/i, /同时/i, /双人/i, /sync/i]);
  const hasGuided = hasAny(text, [/主导/i, /引导/i, /前戏/i, /配合/i, /guided/i]);
  const hasPlayful = hasAny(text, [/趣味/i, /氛围/i, /尝鲜/i, /新鲜/i, /玩法/i, /playful/i]);
  const hasAutomatic = hasAny(text, [/自动/i, /活塞/i, /抽送/i, /auto/i, /piston/i]);
  const hasTight = hasAny(text, [/紧致/i, /包裹感强/i, /夹吸/i, /tight/i]);
  const hasSoft = hasAny(text, [/柔软/i, /慢玩/i, /温和/i, /soft/i, /gentle/i]);
  const hasStrong = hasAny(text, [/强刺激/i, /强震/i, /爆发/i, /快速/i, /strong/i, /intense/i]) || product.motorType === "strong";
  const hasHeating = hasAny(text, [/加热/i, /发热/i, /恒温/i, /温热/i, /热感/i, /warming/i, /heating/i, /heated/i]);
  const typeCode = product.typeCode ?? "";
  const subtypeCode = product.subtypeCode ?? "";
  const hasClitoral =
    typeCode === "suction" ||
    typeCode === "external_vibe" ||
    subtypeCode.includes("clitoral") ||
    hasAny(text, [/阴蒂/i, /外阴/i, /豆豆/i, /clit/i, /clitoral/i, /suction/i, /吸吮/i, /吮吸/i, /小海豚/i, /跳蛋/i]);
  const hasGspot =
    subtypeCode.includes("gspot") ||
    hasAny(text, [/g\s*点/i, /g-spot/i, /g spot/i, /阴道/i, /vaginal/i, /egg vibrator/i, /lush/i]);
  const hasInternal =
    product.physicalForm === "internal" ||
    product.physicalForm === "composite" ||
    typeCode === "insertable" ||
    hasAny(text, [/入体/i, /插入/i, /阴道/i, /vaginal/i, /insert/i, /dildo/i]);
  const hasDual =
    product.physicalForm === "composite" ||
    typeCode === "dual_stimulation" ||
    subtypeCode.includes("dual") ||
    hasAny(text, [/双刺激/i, /内外/i, /兔/i, /rabbit/i, /dual/i, /g\s*点.*阴蒂/i, /clit.*g-spot/i]);
  const hasNipple =
    subtypeCode === "multi_head_dual" ||
    hasAny(text, [/乳头/i, /乳夹/i, /nipple/i, /clamp/i, /gemini/i]);
  const hasAnal =
    typeCode === "prostate" ||
    subtypeCode.includes("anal") ||
    hasAny(text, [/肛/i, /后庭/i, /anal/i, /butt/i, /plug/i, /hush/i, /lush anal/i]);
  const isCoupleType =
    typeCode === "couples" ||
    typeCode === "wearable_remote" ||
    ["external_couples", "dual_wearable_remote", "vibrating_cock_ring"].includes(subtypeCode);
  const isCockRing = typeCode === "cock_ring" || /cock_ring|ring/i.test(subtypeCode) || hasAny(text, [/延时环/i, /震动环/i, /锁精环/i]);
  const isProstate = typeCode === "prostate" || /prostate/i.test(subtypeCode) || hasAny(text, [/前列腺/i]);
  const isMaleSolo = product.gender === "male" && (typeCode === "masturbator" || hasAny(text, [/飞机杯/i, /通道刺激/i]));
  const isFemaleSolo =
    product.gender === "female" &&
    (["suction", "external_vibe", "dual_stimulation"].includes(typeCode) ||
      hasAny(text, [/吮吸/i, /小海豚/i, /跳蛋/i, /震动棒/i, /女性单人/i]));
  const isFemaleCompatible =
    product.gender === "female" ||
    product.gender === "unisex" ||
    ["external_vibe", "suction", "dual_stimulation", "wearable_remote", "couples"].includes(typeCode);
  const isMaleCompatible =
    product.gender === "male" ||
    product.gender === "unisex" ||
    ["prostate", "cock_ring", "wearable_remote", "couples"].includes(typeCode);

  for (const signal of signals) {
    const weight = signal.weight;
    switch (signal.id) {
      case "audience.female":
        add(score, summary, product.gender === "female", weight, "适配女性向探索方向");
        add(score, summary, product.gender === "unisex", Math.floor(weight / 2), "通用设备可覆盖当前方向");
        break;
      case "audience.male":
        add(score, summary, product.gender === "male", weight, "适配男性向探索方向");
        add(score, summary, product.gender === "unisex", Math.floor(weight / 2), "通用设备可覆盖当前方向");
        break;
      case "audience.couple":
        add(score, summary, product.gender === "unisex", weight, "更适合双人共玩方向");
        break;
      case "stimulation.external":
        add(score, summary, product.physicalForm === "external", weight, "外部反馈路线更贴近当前选择");
        break;
      case "stimulation.internal":
        add(score, summary, product.physicalForm === "internal", weight, "入体探索路线更贴近当前选择");
        break;
      case "stimulation.composite":
        add(score, summary, product.physicalForm === "composite", weight, "复合刺激路线更贴近当前选择");
        break;
      case "intensity.gentle":
      case "couple.intensity.gentle":
        add(score, summary, product.motorType === "gentle" || hasSoft, weight, "更贴近温和舒适的节奏");
        break;
      case "intensity.balanced":
      case "male.channel.balanced":
      case "couple.intensity.balanced":
        add(score, summary, isStable || hasAny(text, [/平衡/i, /稳定/i, /耐玩/i]), weight, "更贴近平衡、稳定、耐玩的中间路线");
        break;
      case "intensity.strong":
      case "couple.intensity.strong":
        add(score, summary, hasStrong, weight, "更贴近明确强反馈期待");
        break;
      case "pleasure.clitoral":
        add(score, summary, hasClitoral, weight, "刺激部位更贴近阴蒂/外部反馈");
        subtract(score, summary, hasInternal && !hasClitoral, Math.floor(weight / 2), "主刺激点偏入体，和外部偏好有距离");
        break;
      case "pleasure.gspot":
        add(score, summary, hasGspot || (hasInternal && !hasAnal), weight, "刺激部位更贴近 G 点/阴道内探索");
        subtract(score, summary, product.physicalForm === "external" && !hasGspot, Math.floor(weight / 2), "主刺激点偏外部，和 G 点偏好有距离");
        break;
      case "pleasure.dual":
        add(score, summary, hasDual || (hasClitoral && hasInternal), weight, "更贴近内外双刺激偏好");
        break;
      case "pleasure.nipple":
        add(score, summary, hasNipple, weight, "刺激部位更贴近乳头/身体表面");
        break;
      case "pleasure.anal":
        add(score, summary, hasAnal, weight, "刺激部位更贴近肛门/后庭探索");
        subtract(score, summary, hasInternal && !hasAnal && !hasAny(text, [/anal/i, /肛/i]), Math.floor(weight / 3), "入体方向存在，但不是后庭重点");
        break;
      case "temperature.want":
        add(score, summary, hasHeating, weight, "温热功能更贴近放松期待");
        break;
      case "temperature.avoid":
        add(score, summary, !hasHeating, weight, "常温体验更贴近当前选择");
        break;
      case "temperature.neutral":
        add(score, summary, true, weight, "温热不是主要约束，保留更多合适选择");
        break;
      case "app.required":
        add(score, summary, hasRemote, weight, "APP、蓝牙或远控功能更贴近当前选择");
        break;
      case "app.avoid":
        add(score, summary, !hasRemote, weight, "不依赖 APP，操作更简单直接");
        subtract(score, summary, hasRemote, Math.ceil(weight / 2), "带 APP/远控功能，和简单直接的偏好有距离");
        break;
      case "app.neutral":
        add(score, summary, true, weight, "APP 支持不是主要约束，保留更多合适选择");
        break;
      case "noise.strict":
        add(score, summary, product.maxDb != null && product.maxDb <= 45, weight, "静音表现更适合高敏感环境");
        break;
      case "noise.moderate":
        add(score, summary, isQuiet, weight, "声音存在感更贴近当前要求");
        break;
      case "noise.open":
        add(score, summary, true, weight, "声音不是主要约束，保留体验优先空间");
        break;
      case "maintenance.easy":
        add(score, summary, (product.waterproof ?? 0) >= 7 || isEasyCare, weight, "清洁维护更省心");
        break;
      case "maintenance.standard":
        add(score, summary, (product.waterproof ?? 0) >= 5 || isEasyCare, weight, "维护成本符合常规接受范围");
        break;
      case "budget.entry":
        add(score, summary, product.price <= 120, weight, "价格更贴近轻量尝试预算");
        break;
      case "budget.mid":
        add(score, summary, isMidBudget, weight, "价格更贴近标准预算带");
        break;
      case "budget.premium":
        add(score, summary, product.price >= 300, weight, "更贴近一步到位的探索预算");
        break;
      case "privacy.high":
        add(score, summary, product.appearance === "high_disguise" || Boolean(disguiseSummary), weight, "外观和收纳压力更贴近高伪装偏好");
        break;
      case "privacy.open":
        add(score, summary, true, weight, "当前更重视体验本身，外观限制放宽");
        break;
      case "male.drive.manual":
        add(score, summary, product.physicalForm === "external" || hasHandheld, weight, "更适合手动主导和自主掌控");
        break;
      case "male.drive.automatic":
        add(score, summary, product.physicalForm === "internal" || hasAutomatic, weight, "更贴近自动驱动和省力体验");
        break;
      case "male.drive.hybrid":
        add(score, summary, product.physicalForm === "composite", weight, "更适合复合结构玩法");
        break;
      case "male.channel.soft":
        add(score, summary, product.motorType === "gentle" || hasSoft, weight, "反馈更偏柔软慢玩");
        break;
      case "male.channel.tight":
        add(score, summary, product.motorType === "strong" || hasTight, weight, "反馈更偏紧致集中");
        break;
      case "male.goal.slow":
        add(score, summary, product.motorType === "gentle" || isQuiet || hasSoft, weight, "更适合慢玩持久节奏");
        break;
      case "male.goal.daily":
        add(score, summary, isStable || isEasyCare, weight, "更适合日常复用和省心打理");
        break;
      case "male.goal.explosive":
        add(score, summary, hasStrong, weight, "更贴近快速高刺激目标");
        break;
      case "couple.interaction.sync":
        add(score, summary, product.gender === "unisex" && hasSync, weight, "同步共振信号更贴近双方同时进入状态");
        break;
      case "couple.interaction.guided":
        add(score, summary, hasGuided || hasHandheld || product.physicalForm === "composite", weight, "更适合主导、引导和位置切换");
        break;
      case "couple.interaction.remote":
        add(score, summary, hasRemote, weight, "远控联动更贴近互动氛围玩法");
        break;
      case "couple.partner.mixed":
        add(score, summary, product.gender === "unisex" || isCoupleType, weight, "异性搭配下更需要兼顾双方结构");
        add(score, summary, isCockRing || hasRemote || hasWearable, Math.floor(weight / 2), "共玩佩戴、远控或环类结构更适合异性搭配");
        subtract(score, summary, isMaleSolo || (isFemaleSolo && !isCoupleType), Math.floor(weight / 2), "单人取向较强，异性共玩适配度会降低");
        break;
      case "couple.partner.male_male":
        add(score, summary, isMaleCompatible, weight, "更贴近男男搭配的男性向共玩结构");
        add(score, summary, isProstate || isCockRing || hasRemote || isCoupleType, Math.floor(weight / 2), "前列腺、环类或远控结构更适合男男共玩");
        subtract(score, summary, isFemaleSolo && !isCoupleType, weight, "女性单人取向较强，男男搭配适配度会降低");
        break;
      case "couple.partner.female_female":
        add(score, summary, isFemaleCompatible, weight, "更贴近女女搭配的女性向共玩结构");
        add(score, summary, ["external_vibe", "suction", "dual_stimulation", "wearable_remote"].includes(typeCode) || hasRemote || isCoupleType, Math.floor(weight / 2), "外部、复合或远控结构更适合女女共玩");
        subtract(score, summary, (isMaleSolo || isProstate) && !isCoupleType, weight, "男性单人取向较强，女女搭配适配度会降低");
        break;
      case "couple.partner.open":
        add(score, summary, product.gender === "unisex" || isCoupleType || isStable, weight, "对象不限定时，优先保留通用、稳定、低风险的共玩选择");
        break;
      case "couple.fit.wearable":
        add(score, summary, hasWearable || product.physicalForm === "external", weight, "更贴近稳定贴合的使用姿态");
        break;
      case "couple.fit.handheld":
        add(score, summary, hasHandheld || product.physicalForm === "composite", weight, "更适合手持灵活切换");
        break;
      case "couple.scene.quiet":
        add(score, summary, isQuiet || product.appearance === "high_disguise", weight, "更适合安静私密的共玩环境");
        break;
      case "couple.scene.bedroom":
        add(score, summary, isStable || isEasyCare, weight, "更适合卧室常用和稳定复现");
        break;
      case "couple.scene.playful":
        add(score, summary, hasPlayful || hasRemote, weight, "互动趣味和新鲜感更贴近氛围尝鲜");
        break;
      default:
        if (signal.id.startsWith("uncertain.")) {
          add(score, summary, isStable || isQuiet || isEasyCare, weight, "偏好待判断时，优先保留更稳妥低风险的选择");
        }
        break;
    }
  }

  return {
    score: score.value,
    summary: Array.from(new Set(summary)).slice(0, 4),
  };
}
