import type { BrandBrief } from "../lib/brand-brief.ts";

export type Product = {
  id: string;
  originalId?: string | null;
  name: string;
  displayName?: string;
  safeDisplayName?: string;
  canonicalName?: string;
  price: number;
  maxDb: number | null;
  waterproof: number | null;
  appearance: "high_disguise" | "normal";
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  gender: "male" | "female" | "unisex";
  typeCode?: string | null;
  subtypeCode?: string | null;
  brand: string;
  material: string;
  imagePlaceholder: string;
  link?: string;
  sourceUrl?: string;
  rawDescription?: string | null;
  tags?: string[];
  reason?: string;
  personaAnalysis?: string;
  isDomestic?: boolean;
  brandBrief?: BrandBrief | null;
};

export const products: Product[] = [];

export type AudienceGender = "male" | "female" | "unisex";
export type PhysicalFormPreference = Product["physicalForm"];
export type MotorTypePreference = Product["motorType"];
export type ExperienceLevel = "sensitive" | "balanced" | "intense";
export type PleasureFocus =
  | "clitoral"
  | "gspot"
  | "dual"
  | "nipple"
  | "anal"
  | "unsure";
export type TemperaturePreference = "want" | "avoid" | "neutral";
export type AppSupportPreference = "required" | "avoid_app" | "neutral_app";
export type DriveMode = "manual" | "automatic" | "hybrid";
export type ChannelFeel = "soft" | "balanced" | "tight";
export type SessionGoal = "slow" | "daily" | "explosive";
export type InteractionMode = "sync" | "guided" | "remote";
export type FitPreference = "wearable" | "handheld";
export type CoupleScene = "quiet" | "bedroom" | "playful";
export type SharedIntensity = "gentle" | "balanced" | "strong";
export type PartnerComposition = "mixed" | "male_male" | "female_female" | "open";

export type AnswerState = {
  gender?: AudienceGender;
  physicalForm?: PhysicalFormPreference;
  motorType?: MotorTypePreference;
  maxDb?: number;
  waterproof?: number;
  budget?: [number, number];
  appearance?: "high_disguise" | "normal";
  experienceLevel?: ExperienceLevel;
  pleasureFocus?: PleasureFocus;
  temperaturePreference?: TemperaturePreference;
  appSupportPreference?: AppSupportPreference;
  driveMode?: DriveMode;
  channelFeel?: ChannelFeel;
  sessionGoal?: SessionGoal;
  interactionMode?: InteractionMode;
  fitPreference?: FitPreference;
  coupleScene?: CoupleScene;
  sharedIntensity?: SharedIntensity;
  partnerComposition?: PartnerComposition;
  tags: string[];
};

export type QuestionOption = {
  label: string;
  value: AnswerState[keyof AnswerState];
  tag: string;
  answerPatch?: Partial<Omit<AnswerState, "tags">>;
};

function helpMeDecideOption(
  label = "我还不确定，先帮我判断",
  tag = "需要系统判断",
): QuestionOption {
  return {
    label,
    value: undefined,
    tag,
    answerPatch: {},
  };
}

export type Question = {
  id: string;
  title: string;
  subtitle: string;
  field: keyof AnswerState;
  options: QuestionOption[];
};

const FEMALE_QUESTIONS: Question[] = [
  {
    id: "female-route",
    title: "刺激路径",
    subtitle: "先选一个最想尝试的方向，不确定也可以交给系统判断。",
    field: "physicalForm",
    options: [
      {
        label: "外部轻刺激",
        value: "external",
        tag: "外部震动/吮吸",
      },
      {
        label: "想试一点入体感",
        value: "internal",
        tag: "纯入体",
      },
      {
        label: "内外一起",
        value: "composite",
        tag: "复合机型",
      },
      helpMeDecideOption("我还不确定路线，先帮我判断", "路线待判断"),
    ],
  },
  {
    id: "female-experience",
    title: "刺激强度",
    subtitle: "你的身体更适合哪种力度？",
    field: "experienceLevel",
    options: [
      {
        label: "轻一点，慢慢来",
        value: "sensitive",
        tag: "温柔慢热",
        answerPatch: {
          motorType: "gentle",
        },
      },
      {
        label: "中等，有存在感就好",
        value: "balanced",
        tag: "平衡进阶",
        answerPatch: {
          motorType: undefined,
        },
      },
      {
        label: "直接一点，反馈明显",
        value: "intense",
        tag: "强刺激偏好",
        answerPatch: {
          motorType: "strong",
        },
      },
      helpMeDecideOption("不确定敏感度，先帮我判断", "敏感度待判断"),
    ],
  },
  {
    id: "female-pleasure-focus",
    title: "愉悦部位",
    subtitle: "更想把刺激集中在哪个身体反馈点？不确定也可以先让系统判断。",
    field: "pleasureFocus",
    options: [
      {
        label: "阴蒂/外部更直接",
        value: "clitoral",
        tag: "阴蒂刺激",
        answerPatch: {
          physicalForm: "external",
        },
      },
      {
        label: "G 点/阴道内探索",
        value: "gspot",
        tag: "G点刺激",
        answerPatch: {
          physicalForm: "internal",
        },
      },
      {
        label: "内外一起更完整",
        value: "dual",
        tag: "内外双刺激",
        answerPatch: {
          physicalForm: "composite",
        },
      },
      {
        label: "乳头/身体表面",
        value: "nipple",
        tag: "乳头刺激",
      },
      {
        label: "肛门/后庭探索",
        value: "anal",
        tag: "肛门刺激",
        answerPatch: {
          physicalForm: "internal",
        },
      },
      helpMeDecideOption("还不确定部位，先帮我判断", "部位待判断"),
    ],
  },
  {
    id: "female-temperature",
    title: "温热感",
    subtitle: "你会不会希望设备带一点温热感，帮助身体更放松？",
    field: "temperaturePreference",
    options: [
      {
        label: "想要，有温热感更放松",
        value: "want",
        tag: "想要温热",
      },
      {
        label: "不要，我更喜欢常温",
        value: "avoid",
        tag: "不要加热",
      },
      {
        label: "都可以，不作为重点",
        value: "neutral",
        tag: "温热不限定",
      },
    ],
  },
  {
    id: "female-app-support",
    title: "APP 支持",
    subtitle: "你会希望它能连接 APP、远控或异地互动吗？",
    field: "appSupportPreference",
    options: [
      {
        label: "需要，想要远控/APP",
        value: "required",
        tag: "需要APP支持",
      },
      {
        label: "不需要，简单直接最好",
        value: "avoid_app",
        tag: "不需要APP",
      },
      {
        label: "都可以，不作为重点",
        value: "neutral_app",
        tag: "APP不限定",
      },
    ],
  },
  {
    id: "female-noise",
    title: "声音顾虑",
    subtitle: "你有多怕被声音打扰？",
    field: "maxDb",
    options: [
      {
        label: "非常怕吵",
        value: 40,
        tag: "< 40dB",
      },
      {
        label: "有点在意",
        value: 50,
        tag: "< 50dB",
      },
      {
        label: "不太在意",
        value: 100,
        tag: "无限制分贝",
      },
      helpMeDecideOption("不确定环境要求，先按稳妥判断", "静音待判断"),
    ],
  },
  {
    id: "female-cleanup",
    title: "清洁收尾",
    subtitle: "你希望用完之后多省心？",
    field: "waterproof",
    options: [
      {
        label: "越省心越好",
        value: 7,
        tag: "≥ IPX7 防水",
      },
      {
        label: "常规即可",
        value: 6,
        tag: "基础防水",
      },
      helpMeDecideOption("不确定清洁要求，先帮我判断", "清洁待判断"),
    ],
  },
  {
    id: "female-budget",
    title: "预算",
    subtitle: "这次大概想花多少？",
    field: "budget",
    options: [
      { label: "先试试（100 内）", value: [0, 100], tag: "入门级" },
      { label: "稳一点（100-300）", value: [100, 300], tag: "进阶级" },
      { label: "一步到位（300+）", value: [300, 10000], tag: "旗舰级" },
      helpMeDecideOption("预算还不确定，先按性价比判断", "预算待判断"),
    ],
  },
  {
    id: "female-appearance",
    title: "收纳压力",
    subtitle: "你在意它被看到时是否尴尬吗？",
    field: "appearance",
    options: [
      {
        label: "很在意，要低调",
        value: "high_disguise",
        tag: "高伪装",
      },
      {
        label: "不太在意",
        value: "normal",
        tag: "无伪装限制",
      },
      helpMeDecideOption("不确定收纳压力，先帮我判断", "收纳待判断"),
    ],
  },
];

export const questionFlows: { female: Question[] } = {
  female: FEMALE_QUESTIONS,
};

export const femaleMvpQuestionFlow: Question[] = FEMALE_QUESTIONS;

export function getActiveQuestions(_gender?: AudienceGender): Question[] {
  return femaleMvpQuestionFlow;
}
