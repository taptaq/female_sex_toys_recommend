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

const OPENING_QUESTION: Question = {
  id: "q0",
  title: "航向选择",
  subtitle: "请选择你的内太空探索方向（提示：这会决定后续题目的重心）",
  field: "gender",
  options: [
    {
      label: "女性向探索（跳蛋、\u9707\u52a8\u68d2、吮吸器等）",
      value: "female",
      tag: "女性向",
    },
    {
      label: "男性向探索（\u98de\u673a\u676f、\u98de\u673a\u676f附件等）",
      value: "male",
      tag: "男性向",
    },
    {
      label: "情侣共玩探索（双人互动、共震、远控氛围等）",
      value: "unisex",
      tag: "情侣共玩",
    },
  ],
};

const FEMALE_QUESTIONS: Question[] = [
  {
    id: "female-route",
    title: "刺激路径",
    subtitle: "你更期待哪种身体反馈路线？",
    field: "experienceLevel",
    options: [
      {
        label: "外部细节优先（更看重外部震动或吸感的明确反馈）",
        value: "sensitive",
        tag: "外部震动/吮吸",
        answerPatch: {
          physicalForm: "external",
        },
      },
      {
        label: "纯入体探索（更在意包裹感、充实感和深入体验）",
        value: "balanced",
        tag: "纯入体",
        answerPatch: {
          physicalForm: "internal",
        },
      },
      {
        label: "内外一起到位（想要复合刺激和更丰富层次）",
        value: "intense",
        tag: "复合机型",
        answerPatch: {
          physicalForm: "composite",
        },
      },
      helpMeDecideOption("我还不确定路线，先帮我判断", "路线待判断"),
    ],
  },
  {
    id: "female-experience",
    title: "经验与敏感度",
    subtitle: "你的身体更适合什么节奏进入状态？",
    field: "experienceLevel",
    options: [
      {
        label: "敏感慢热（新手、容易不适，想先从温和层次开始）",
        value: "sensitive",
        tag: "温柔慢热",
        answerPatch: {
          motorType: "gentle",
        },
      },
      {
        label: "平衡进阶（希望有存在感，但不要一下子太猛）",
        value: "balanced",
        tag: "平衡进阶",
        answerPatch: {
          motorType: undefined,
        },
      },
      {
        label: "强刺激偏好（耐受较高，想要更直接更明显的反馈）",
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
    id: "female-noise",
    title: "静音场景",
    subtitle: "你现在更需要控制设备存在感，还是可以放开选？",
    field: "maxDb",
    options: [
      {
        label: "极度怕吵（宿舍、合租、隔音差，越安静越好）",
        value: 40,
        tag: "< 40dB",
      },
      {
        label: "一般可接受（希望别太夸张，但不用极端静音）",
        value: 50,
        tag: "< 50dB",
      },
      {
        label: "不太在意（空间相对自由，声音不是核心约束）",
        value: 100,
        tag: "无限制分贝",
      },
      helpMeDecideOption("不确定环境要求，先按稳妥判断", "静音待判断"),
    ],
  },
  {
    id: "female-cleanup",
    title: "清洁与维护",
    subtitle: "你更偏好什么样的收尾成本？",
    field: "waterproof",
    options: [
      {
        label: "越省心越好（希望直接冲洗，减少清洁心理负担）",
        value: 7,
        tag: "≥ IPX7 防水",
      },
      {
        label: "常规即可（能接受基础擦拭和常规清洁流程）",
        value: 6,
        tag: "基础防水",
      },
      helpMeDecideOption("不确定清洁要求，先帮我判断", "清洁待判断"),
    ],
  },
  {
    id: "female-budget",
    title: "能源预算",
    subtitle: "这次想把预算放在哪个探索区间？",
    field: "budget",
    options: [
      { label: "轻量级（100 元以内，先找对方向）", value: [0, 100], tag: "入门级" },
      { label: "标准级（100-300 元，兼顾稳定体验）", value: [100, 300], tag: "进阶级" },
      { label: "探索级（300 元以上，想一步到位）", value: [300, 10000], tag: "旗舰级" },
      helpMeDecideOption("预算还不确定，先按性价比判断", "预算待判断"),
    ],
  },
  {
    id: "female-appearance",
    title: "视觉隐蔽",
    subtitle: "你在不在意它看上去像不像日常用品？",
    field: "appearance",
    options: [
      {
        label: "很在意（希望收纳压力小，看到也不容易尴尬）",
        value: "high_disguise",
        tag: "高伪装",
      },
      {
        label: "不太在意（只要体验对，外观直接一点也可以）",
        value: "normal",
        tag: "无伪装限制",
      },
      helpMeDecideOption("不确定收纳压力，先帮我判断", "收纳待判断"),
    ],
  },
];

const MALE_QUESTIONS: Question[] = [
  {
    id: "male-drive",
    title: "驱动方式",
    subtitle: "你更喜欢哪种主导体验？",
    field: "driveMode",
    options: [
      {
        label: "手动主导（更想自己掌控节奏和推进感）",
        value: "manual",
        tag: "手动型",
        answerPatch: {
          physicalForm: "external",
        },
      },
      {
        label: "自动驱动（希望省力一些，偏向自动震动或活塞）",
        value: "automatic",
        tag: "自动型",
        answerPatch: {
          physicalForm: "internal",
        },
      },
      {
        label: "混合附件型（想要附件、结构或玩法上更复合）",
        value: "hybrid",
        tag: "复合型",
        answerPatch: {
          physicalForm: "composite",
        },
      },
      helpMeDecideOption("不确定驱动方式，先帮我判断", "驱动待判断"),
    ],
  },
  {
    id: "male-channel",
    title: "通道体验",
    subtitle: "你更偏好的包裹和刺激风格是？",
    field: "channelFeel",
    options: [
      {
        label: "柔软包裹（久玩舒服，刺激不要太猛）",
        value: "soft",
        tag: "慢玩柔软",
        answerPatch: {
          motorType: "gentle",
        },
      },
      {
        label: "平衡真实（既要有存在感，也要相对耐玩）",
        value: "balanced",
        tag: "平衡真实",
        answerPatch: {
          motorType: undefined,
        },
      },
      {
        label: "紧致强刺激（追求更快更集中的刺激反馈）",
        value: "tight",
        tag: "紧致刺激",
        answerPatch: {
          motorType: "strong",
        },
      },
      helpMeDecideOption("不确定刺激风格，先帮我判断", "刺激风格待判断"),
    ],
  },
  {
    id: "male-session-goal",
    title: "使用目标",
    subtitle: "你这类产品更偏向哪种使用节奏？",
    field: "sessionGoal",
    options: [
      {
        label: "慢玩持久（更重视放松、延长和稳定节奏）",
        value: "slow",
        tag: "慢玩持久",
      },
      {
        label: "日常释放（想要稳定、顺手、复用率高）",
        value: "daily",
        tag: "日常释放",
      },
      {
        label: "快速高刺激（想要更直接、更强烈的爆发感）",
        value: "explosive",
        tag: "快速高刺激",
      },
      helpMeDecideOption("不确定使用节奏，先帮我判断", "使用节奏待判断"),
    ],
  },
  {
    id: "male-cleanup",
    title: "清洁成本",
    subtitle: "你能接受怎样的后续打理流程？",
    field: "waterproof",
    options: [
      {
        label: "越省事越好（更希望好冲洗、少拆洗、好收尾）",
        value: 7,
        tag: "易清洁优先",
      },
      {
        label: "可接受常规维护（能接受普通拆洗和日常保养）",
        value: 6,
        tag: "常规维护",
      },
      helpMeDecideOption("不确定清洁要求，先帮我判断", "清洁待判断"),
    ],
  },
  {
    id: "male-budget",
    title: "能源预算",
    subtitle: "你更想把预算放在哪个段位？",
    field: "budget",
    options: [
      { label: "轻量级（100 元以内，先试方向）", value: [0, 100], tag: "入门级" },
      { label: "标准级（100-300 元，日常够用且更稳）", value: [100, 300], tag: "进阶级" },
      { label: "探索级（300 元以上，直接看更强体验）", value: [300, 10000], tag: "旗舰级" },
      helpMeDecideOption("预算还不确定，先按性价比判断", "预算待判断"),
    ],
  },
  {
    id: "male-appearance",
    title: "收纳隐蔽",
    subtitle: "你会不会在意设备看起来太直白？",
    field: "appearance",
    options: [
      {
        label: "会在意（更希望低存在感、好收纳、拿放压力小）",
        value: "high_disguise",
        tag: "低存在感收纳",
      },
      {
        label: "不太在意（重点在体验本身，外观直接也可以）",
        value: "normal",
        tag: "体验优先",
      },
      helpMeDecideOption("不确定收纳压力，先帮我判断", "收纳待判断"),
    ],
  },
];

const COUPLE_QUESTIONS: Question[] = [
  {
    id: "couple-partner-composition",
    title: "互动对象",
    subtitle: "这次共玩更接近哪种设备适配关系？这只用于筛选更合适的装备。",
    field: "partnerComposition",
    options: [
      {
        label: "异性搭配（更需要兼顾双方结构）",
        value: "mixed",
        tag: "异性搭配",
      },
      {
        label: "男男搭配（更偏男性向共玩结构）",
        value: "male_male",
        tag: "男男搭配",
      },
      {
        label: "女女搭配（更偏女性向共玩结构）",
        value: "female_female",
        tag: "女女搭配",
      },
      {
        label: "先不限定（先看通用共玩适配）",
        value: "open",
        tag: "对象不限定",
      },
    ],
  },
  {
    id: "couple-interaction",
    title: "互动方式",
    subtitle: "你们更期待哪种共玩结构？",
    field: "interactionMode",
    options: [
      {
        label: "一起同步感受（希望双方能同时进入状态）",
        value: "sync",
        tag: "同步共振",
      },
      {
        label: "一方主导一方配合（偏前戏、引导或主导互动）",
        value: "guided",
        tag: "主导互动",
      },
      {
        label: "远控或氛围玩法（更看重互动感和趣味性）",
        value: "remote",
        tag: "远控氛围",
      },
      helpMeDecideOption("不确定互动方式，先帮我们判断", "互动方式待判断"),
    ],
  },
  {
    id: "couple-fit",
    title: "佩戴与贴合",
    subtitle: "你们更需要哪种使用姿态？",
    field: "fitPreference",
    options: [
      {
        label: "稳定贴合优先（更希望佩戴稳、接触点不容易跑）",
        value: "wearable",
        tag: "稳定贴合",
        answerPatch: {
          physicalForm: "external",
        },
      },
      {
        label: "手持灵活优先（希望更自由切换位置和节奏）",
        value: "handheld",
        tag: "手持灵活",
        answerPatch: {
          physicalForm: "composite",
        },
      },
      helpMeDecideOption("不确定使用姿态，先帮我们判断", "使用姿态待判断"),
    ],
  },
  {
    id: "couple-scene",
    title: "共玩场景",
    subtitle: "你们更接近哪一种实际使用环境？",
    field: "coupleScene",
    options: [
      {
        label: "安静私密（更怕声音和收纳压力影响氛围）",
        value: "quiet",
        tag: "安静私密",
      },
      {
        label: "日常卧室（稳定、顺手、容易复现更重要）",
        value: "bedroom",
        tag: "卧室常用",
      },
      {
        label: "偏氛围尝鲜（更想要趣味性和互动新鲜感）",
        value: "playful",
        tag: "氛围尝鲜",
      },
      helpMeDecideOption("不确定共玩场景，先帮我们判断", "共玩场景待判断"),
    ],
  },
  {
    id: "couple-intensity",
    title: "双方刺激风格",
    subtitle: "你们整体更接近哪种反馈偏好？",
    field: "sharedIntensity",
    options: [
      {
        label: "温和舒适（更重视舒适、细节和耐玩）",
        value: "gentle",
        tag: "温和舒适",
        answerPatch: {
          motorType: "gentle",
        },
      },
      {
        label: "平衡有层次（想要存在感，但别太冲）",
        value: "balanced",
        tag: "平衡层次",
        answerPatch: {
          motorType: undefined,
        },
      },
      {
        label: "明确强反馈（更想要刺激感和明显存在感）",
        value: "strong",
        tag: "强反馈",
        answerPatch: {
          motorType: "strong",
        },
      },
      helpMeDecideOption("不确定双方偏好，先帮我们判断", "双方偏好待判断"),
    ],
  },
  {
    id: "couple-noise",
    title: "静音要求",
    subtitle: "声音会不会直接影响你们的使用意愿？",
    field: "maxDb",
    options: [
      {
        label: "非常重要（很怕打断氛围，越安静越好）",
        value: 40,
        tag: "< 40dB",
      },
      {
        label: "一般重要（最好别太明显，但不用极限静音）",
        value: 50,
        tag: "< 50dB",
      },
      {
        label: "不太敏感（声音不是主要顾虑）",
        value: 100,
        tag: "无限制分贝",
      },
      helpMeDecideOption("不确定静音要求，先按稳妥判断", "静音待判断"),
    ],
  },
  {
    id: "couple-cleanup",
    title: "清洁便利",
    subtitle: "双人场景下，你们更偏好什么收尾难度？",
    field: "waterproof",
    options: [
      {
        label: "越快越好（希望用后快速处理，不打断氛围）",
        value: 7,
        tag: "快速清洁",
      },
      {
        label: "常规维护也可以（能接受普通打理步骤）",
        value: 6,
        tag: "常规清洁",
      },
      helpMeDecideOption("不确定清洁要求，先帮我们判断", "清洁待判断"),
    ],
  },
  {
    id: "couple-budget",
    title: "能源预算",
    subtitle: "这次双人探索更想落在哪个预算带？",
    field: "budget",
    options: [
      { label: "轻量级（100 元以内，先试氛围和方向）", value: [0, 100], tag: "入门级" },
      { label: "标准级（100-300 元，兼顾体验和实用）", value: [100, 300], tag: "进阶级" },
      { label: "探索级（300 元以上，想看更完整体验）", value: [300, 10000], tag: "旗舰级" },
      helpMeDecideOption("预算还不确定，先按性价比判断", "预算待判断"),
    ],
  },
  {
    id: "couple-appearance",
    title: "收纳压力",
    subtitle: "你们会不会在意设备用后收纳和存在感？",
    field: "appearance",
    options: [
      {
        label: "会在意（希望更好收、更低压力、更不突兀）",
        value: "high_disguise",
        tag: "低压力收纳",
      },
      {
        label: "不太在意（主要还是先把互动体验做好）",
        value: "normal",
        tag: "互动体验优先",
      },
      helpMeDecideOption("不确定收纳压力，先帮我们判断", "收纳待判断"),
    ],
  },
];

export const questionFlows: Record<AudienceGender, Question[]> = {
  female: [OPENING_QUESTION, ...FEMALE_QUESTIONS],
  male: [OPENING_QUESTION, ...MALE_QUESTIONS],
  unisex: [OPENING_QUESTION, ...COUPLE_QUESTIONS],
};

export const femaleMvpQuestionFlow: Question[] = FEMALE_QUESTIONS;

export function getActiveQuestions(gender?: AudienceGender): Question[] {
  if (!gender) {
    return [OPENING_QUESTION];
  }

  return questionFlows[gender];
}
