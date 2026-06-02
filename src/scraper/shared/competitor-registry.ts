type CompetitorRecord = {
  id: string;
  name: string | null;
  domain: string | null;
  country: string | null;
  founded_date: string | null;
  description: string | null;
  is_domestic: boolean | null;
  focus?: string | null;
  philosophy?: string[] | null;
  major_user_group_profile?: string | null;
};

type CompetitorPrismaLike = {
  competitors: {
    findFirst: (args: Record<string, unknown>) => Promise<CompetitorRecord | null>;
    create: (args: Record<string, unknown>) => Promise<CompetitorRecord>;
    update: (args: Record<string, unknown>) => Promise<CompetitorRecord>;
  };
};

type RetryFn = <T>(label: string, action: () => Promise<T>) => Promise<T>;

export type CompetitorRegistryConfig = {
  canonicalName: string;
  matchNames: string[];
  domain?: string | null;
  country?: string | null;
  foundedDate?: string | null;
  description?: string | null;
  focus?: "Female" | "Male" | "Unisex" | null;
  philosophy?: string[] | null;
  majorUserGroupProfile?: string | null;
  isDomestic?: boolean | null;
};

export const OFFICIAL_COMPETITOR_REGISTRY: CompetitorRegistryConfig[] = [
  {
    canonicalName: "POPOCAT",
    matchNames: ["popocat"],
    domain: "popocat.tmall.com",
    country: "中国",
    description:
      "POPOCAT 是天猫在售的个人护理与情趣用品品牌，覆盖女性向器具、情侣场景用品以及部分护理耗材。",
    focus: "Female",
    philosophy: [
      "以电商货架式运营为主，强调丰富 SKU、入门友好和女性向使用场景。",
      "产品覆盖器具、润滑与辅助用品，强调从单人到情侣场景的可选范围。",
      "以天猫店铺为核心销售阵地，依赖平台化内容呈现与促销转化。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-40 岁女性用户为主，兼顾情侣共同购买场景。\n【心理特征】偏好在电商平台直接比价和快速下单，重视隐私包装、基础功能和价格接受度。\n【核心痛点】希望在一个店铺内快速买齐入门器具与配套用品，减少跨品牌筛选成本。\n【消费行为】更依赖天猫搜索、活动页与店铺货架推荐，对促销、销量和图文卖点敏感。",
    isDomestic: true,
  },
  {
    canonicalName: "KUMOCOOM",
    matchNames: ["kumocoom"],
    domain: "kumocoom.com",
    country: "中国",
    description:
      "KUMOCOOM 是原创幻想造型情趣品牌，主打以铂金硅胶材质打造的艺术化玩具与奇幻风格产品。",
    focus: "Unisex",
    philosophy: [
      "强调 100% 铂金硅胶与手工制作，兼顾安全性与艺术表达。",
      "以奇幻生物与幻想主题为核心，弱化传统情趣用品的刻板造型。",
      "采用隐私包装与全球配送，降低购买与收藏门槛。",
    ],
    majorUserGroupProfile:
      "【核心人口】以 20-40 岁、偏二次元/幻想审美取向的女性与酷儿用户为主，也覆盖收藏型与情侣共玩人群。\n【心理特征】重视审美表达、身体安全与个性化体验，愿意为原创设计和手工质感买单。\n【核心痛点】希望在不牺牲美感的前提下获得安全、独特且带有陪伴感的玩具体验。\n【消费行为】偏好独立站直购、社媒种草与限量上新，能接受中高客单价与收藏属性。",
    isDomestic: true,
  },
  {
    canonicalName: "Magic Motion",
    matchNames: ["magic motion", "magicmotion"],
    domain: "us.magicmotion.shop",
    country: "中国",
    foundedDate: "2016",
    description:
      "Magic Motion 是智能情趣科技品牌，覆盖女性向、穿戴式与远程互动类玩具产品。",
    focus: "Female",
    philosophy: [
      "以智能互联和可穿戴体验切入亲密健康场景。",
      "强调女性友好、隐私设计和稳定的 App 连接能力。",
      "通过更低门槛的智能体验，把情趣科技带入日常使用场景。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-40 岁女性为主，兼顾异地情侣和科技偏好用户。\n【心理特征】追求科技感、易用性和私密体验，乐于尝试 App 控制与远程互动功能。\n【核心痛点】希望获得更稳定的远程控制、更轻松的入门体验，以及兼顾静音与便携的产品。",
    isDomestic: true,
  },
  {
    canonicalName: "Hot Octopuss",
    matchNames: ["hot octopuss", "hotoctopuss"],
    domain: "www.hotoctopuss.com",
    country: "英国",
    description:
      "Hot Octopuss 是英国情趣科技品牌，覆盖男性、女性与情侣场景，并以脉冲技术产品见长。",
    focus: "Unisex",
    philosophy: [
      "以脉冲技术和创新刺激方式切入不同身体与关系场景。",
      "强调技术差异化与产品功能创新，而非传统情趣用品叙事。",
      "覆盖男性、女性和伴侣共玩，强调更包容的快感设计。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-45 岁、接受新技术与新刺激方式的中高消费用户，男女与情侣场景并重。\n【心理特征】愿意尝试差异化技术方案，重视功能创新、品牌调性与产品专业度。\n【核心痛点】传统刺激方式同质化，希望获得更强技术差异和更明确的功能收益。",
    isDomestic: false,
  },
  {
    canonicalName: "LBDO",
    matchNames: ["lbdo"],
    domain: "us.lbdo.com",
    country: "美国",
    description:
      "LBDO 是情趣与亲密关系场景品牌，产品覆盖玩具、润滑剂、蜡烛与互动套装。",
    focus: "Unisex",
    philosophy: [
      "把亲密关系、前戏氛围和身体探索放在同一套产品叙事里。",
      "强调套装化、场景化与更温和的 intimacy 定位。",
      "通过蜡烛、润滑剂与玩具组合，降低用户进入门槛。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-40 岁情侣与关系经营导向用户为主，也覆盖偏温和入门的新手女性用户。\n【心理特征】更关注关系体验、氛围营造和情绪价值，而不是单点强刺激。\n【核心痛点】希望一站式完成亲密场景搭建，避免单买玩具后仍缺配套产品。",
    isDomestic: false,
  },
  {
    canonicalName: "Hello Nancy",
    matchNames: ["hello nancy", "hellonancy", "nancy"],
    domain: "hellonancy.com",
    country: "中国",
    description:
      "Hello Nancy 是面向女性情趣场景的品牌，覆盖吸吮、震动与便携式个人护理玩具。",
    focus: "Female",
    philosophy: [
      "围绕女性向入门与轻松使用场景设计产品与沟通方式。",
      "强调直观命名、便携体积和更易理解的购买体验。",
      "通过广告与内容降低新手用户的羞耻感和试错成本。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-35 岁女性新手用户为主，偏社媒种草型消费人群。\n【心理特征】希望快速理解产品差异，偏好小巧、便携、外观友好的产品。\n【核心痛点】第一次购买时缺乏知识，担心选错、太刺激或不够隐私。",
    isDomestic: true,
  },
  {
    canonicalName: "Je Joue",
    matchNames: ["je joue", "jejoue"],
    domain: "www.jejoue.com",
    country: "英国",
    description:
      "Je Joue 是英国情趣品牌，聚焦设计感与高端材质的女性向震动与按摩产品。",
    focus: "Female",
    philosophy: [
      "把情趣用品作为设计产品来打造，强调美感、材质和人体工学。",
      "通过更高级的外观和触感降低产品的工具感。",
      "坚持高端女性向定位，突出舒适和品质体验。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-45 岁、对设计和材质敏感的中高消费女性用户。\n【心理特征】重视产品美感、品牌气质和使用时的身体舒适度。\n【核心痛点】不接受廉价外观与粗糙触感，希望玩具能兼顾美观、性能与收藏感。",
    isDomestic: false,
  },
  {
    canonicalName: "Kiiroo",
    matchNames: ["kiiroo"],
    domain: "www.kiiroo.com",
    country: "荷兰",
    description:
      "Kiiroo 是互动情趣科技品牌，覆盖男性、女性与情侣远程联动设备与配套产品。",
    focus: "Unisex",
    philosophy: [
      "把远程互动、内容同步和 connected toy 作为核心能力。",
      "强调跨设备联动和异地场景中的实时互动体验。",
      "以互动科技而不是单纯硬件参数作为品牌区分点。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-45 岁的科技型用户、异地情侣和互动内容偏好者。\n【心理特征】接受 connected toy 概念，愿意为互动玩法和远程功能买单。\n【核心痛点】希望跨距离保持亲密感，并获得区别于传统单机玩具的联动体验。",
    isDomestic: false,
  },
  {
    canonicalName: "Arcwave",
    matchNames: ["arcwave"],
    domain: "www.arcwave.com",
    country: "德国",
    foundedDate: "2020",
    description:
      "Arcwave 是男性向高端情趣科技品牌，聚焦男士快感设备与空气脉冲体验。",
    focus: "Male",
    philosophy: [
      "将男性快感设备做成技术型、高端化、设计导向的消费电子产品。",
      "以空气脉冲、CleanTech 硅胶与智能静音等卖点区分传统男用设备。",
      "强调清洁、收纳和长期使用体验，而不只是即时刺激。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-45 岁、中高消费能力的男性用户为主，也覆盖为伴侣选购的情侣用户。\n【心理特征】偏好科技感、结构创新与高端外观，不希望产品显得廉价或羞耻化。\n【核心痛点】传统男用设备同质化严重，清洁麻烦、材料廉价、品牌调性不足。",
    isDomestic: false,
  },
  {
    canonicalName: "CRAVE",
    matchNames: ["crave", "lovecrave"],
    domain: "lovecrave.com",
    country: "美国",
    description:
      "CRAVE 是以 pleasure jewelry 和 bedside products 著称的高端女性向品牌，强调首饰感、工艺和审美表达。",
    focus: "Female",
    philosophy: [
      "Objects for life’s most intimate moments should be beautiful.",
      "以首饰化、精品化的方式重写情趣用品的视觉和材料标准。",
      "由女性主导设计与品控，强调精密工艺和长期使用质感。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-45 岁、中高收入、偏都市审美与礼品消费场景的女性用户。\n【心理特征】重视配饰感、设计细节和身份表达，希望玩具同时具备饰品属性与隐私友好性。\n【核心痛点】传统产品外观粗糙，缺乏可穿戴、可展示、可赠礼的高级感。",
    isDomestic: false,
  },
  {
    canonicalName: "Dame",
    matchNames: ["dame"],
    domain: "dame.com",
    country: "美国",
    foundedDate: "2014",
    description:
      "Dame 是美国女性向 sexual wellness 品牌，由 sexologist Alexandra Fine 与 MIT engineer Janet Lieberman 创立，强调研究驱动与女性本位设计。",
    focus: "Female",
    philosophy: [
      "By women, for women.",
      "通过临床研究、真实用户测试与医学顾问体系缩小 Pleasure Gap。",
      "把愉悦纳入 wellness 语境，强调易用、安全、安静与日常化。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-40 岁女性与 femme 用户为主，兼顾非二元用户和伴侣场景。\n【心理特征】重视身体知识、科学设计和医疗级安全感，希望产品不羞耻、可解释、好上手。\n【核心痛点】传统产品缺乏以女性身体为中心的设计，难以兼顾舒适、安静和可信赖的专业感。",
    isDomestic: false,
  },
  {
    canonicalName: "Master4Fancy",
    matchNames: ["master4fancy", "四趣"],
    domain: "master4fancy.com",
    country: "中国",
    foundedDate: "2019",
    description:
      "Master4Fancy 是中国原创幻想情趣品牌，以手工铂金硅胶、角色设定和怪物幻想题材著称，由女性与 queer 艺术团队打造。",
    focus: "Unisex",
    philosophy: [
      "将幻想、角色故事与情趣玩具结合，打破性羞耻与单一身体想象。",
      "强调手工制作、角色世界观、定制色彩与收藏展示价值。",
      "让女性与 queer 用户的欲望表达脱离传统异性恋中心叙事。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-40 岁、偏女性与 queer 社群的幻想审美用户，也覆盖怪物玩具收藏爱好者。\n【心理特征】乐于表达个性化欲望，重视世界观、角色设定、手工感与社群认同。\n【核心痛点】主流市场缺乏怪物幻想与原创审美产品，用户难以找到真正符合个人想象的玩具。",
    isDomestic: true,
  },
  {
    canonicalName: "Unbound",
    matchNames: ["unbound", "unbound babes"],
    domain: "unboundbabes.com",
    country: "美国",
    description:
      "Unbound 是美国女性主导的情趣与亲密健康品牌，强调 body-safe 设计、社会倡议和更无羞耻感的愉悦社区。",
    focus: "Unisex",
    philosophy: [
      "把 pleasure 与 reproductive health、社会倡议和社区表达连接起来。",
      "通过更轻松、无羞耻感的内容和设计降低情趣消费门槛。",
      "强调 body-safe vibrators、lubes 与 accessories 的综合场景。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-40 岁、偏女性与 LGBTQ+ 社群的都市用户，也覆盖关注社会议题的伴侣人群。\n【心理特征】认同性健康去污名化、女性与 queer 友好表达，偏爱有立场的品牌。\n【核心痛点】希望获得既安全又有审美和社区归属感的品牌，而不是冰冷的功能型货架商品。",
    isDomestic: false,
  },
  {
    canonicalName: "Womanizer",
    matchNames: ["womanizer"],
    domain: "www.womanizer.com",
    country: "德国",
    foundedDate: "2014",
    description:
      "Womanizer 是以 Pleasure Air Technology 著称的国际女性向情趣科技品牌，现为 Lovehoney Group 旗下核心品牌之一。",
    focus: "Female",
    philosophy: [
      "围绕女性自爱、自我探索和去污名化展开品牌叙事。",
      "通过 Pleasure Air、Autopilot 与 Smart Silence 等技术建立品类差异。",
      "倡导 pleasure 也是 self-care，并持续推动公开讨论 masturbation。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-45 岁女性用户为主，覆盖从入门到进阶的高消费与品质导向群体。\n【心理特征】重视技术有效性、品牌信任和更现代的女性欲望表达。\n【核心痛点】传统产品难以提供稳定阴蒂刺激体验，且品牌叙事常带有羞耻感或设计落后。",
    isDomestic: false,
  },
  {
    canonicalName: "We-Vibe",
    matchNames: ["we-vibe", "we vibe", "wevibe"],
    domain: "www.we-vibe.com",
    country: "加拿大",
    description:
      "We-Vibe 是加拿大高端情趣科技品牌，产品覆盖女性向、男性向与伴侣共玩系列。",
    focus: "Unisex",
    philosophy: [
      "以情侣互动、远程联动和智能控制体验作为核心品牌识别。",
      "强调亲密关系里的共同探索，兼顾单人使用和伴侣共玩。",
      "通过 App、穿戴式结构与人体工学设计降低互动场景的操作成本。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-45 岁情侣、异地关系用户和接受智能情趣科技的女性用户。\n【心理特征】重视连接稳定性、互动感和品牌可信度，希望产品能自然进入亲密关系场景。\n【核心痛点】远程互动容易受连接、佩戴舒适度和操作复杂度影响，需要更成熟的品牌与生态。",
    isDomestic: false,
  },
  {
    canonicalName: "ROMP",
    matchNames: ["romp", "绒谱"],
    domain: "www.romp.toys",
    country: "德国",
    description:
      "ROMP 是 Lovehoney Group 旗下更强调颜色、趣味与可及性的情趣品牌，覆盖女性、男性与情侣场景产品。",
    focus: "Unisex",
    philosophy: [
      "Add color to your sex life.",
      "让愉悦更容易获得，以更活泼的设计和更亲近的价格切入大众市场。",
      "用鲜明配色和轻松语气降低情趣用品的羞耻感与距离感。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-35 岁的入门与中阶用户为主，偏年轻情侣和追求高性价比设计感的人群。\n【心理特征】喜欢色彩、轻松语气和不那么压迫的高端感，希望产品既好玩又不过于严肃。\n【核心痛点】高端品牌价格门槛高，低价品牌又缺少设计和可信度，想要一条折中路线。",
    isDomestic: false,
  },
];

function normalizeKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

export function findCompetitorRegistryConfig(
  brandName: string,
): CompetitorRegistryConfig | null {
  const target = normalizeKey(brandName);
  if (!target) {
    return null;
  }

  for (const config of OFFICIAL_COMPETITOR_REGISTRY) {
    const candidates = [config.canonicalName, ...config.matchNames].map(normalizeKey);
    if (candidates.includes(target)) {
      return config;
    }
  }

  return null;
}

export function buildCompetitorCreateData(config: CompetitorRegistryConfig) {
  return {
    name: config.canonicalName,
    domain: config.domain ?? undefined,
    country: config.country ?? undefined,
    founded_date: config.foundedDate ?? undefined,
    description: config.description ?? undefined,
    focus: config.focus ?? undefined,
    philosophy: config.philosophy ?? undefined,
    major_user_group_profile: config.majorUserGroupProfile ?? undefined,
    is_domestic: config.isDomestic ?? undefined,
  };
}

export function buildCompetitorUpdateData(
  existing: CompetitorRecord,
  config: CompetitorRegistryConfig,
) {
  const patch: Record<string, unknown> = {};

  if (config.domain && !existing.domain) patch.domain = config.domain;
  if (config.country && !existing.country) patch.country = config.country;
  if (config.foundedDate && !existing.founded_date) patch.founded_date = config.foundedDate;
  if (config.description && !existing.description) patch.description = config.description;
  if (config.focus && !existing.focus) patch.focus = config.focus;
  if (config.philosophy && (!existing.philosophy || existing.philosophy.length === 0)) patch.philosophy = config.philosophy;
  if (config.majorUserGroupProfile && !existing.major_user_group_profile) {
    patch.major_user_group_profile = config.majorUserGroupProfile;
  }
  if (config.isDomestic != null && existing.is_domestic == null) patch.is_domestic = config.isDomestic;

  return patch;
}

export async function ensureCompetitorRecord(input: {
  prisma: CompetitorPrismaLike;
  withDbRetry: RetryFn;
  brandName: string;
  overrideConfig?: CompetitorRegistryConfig | null;
}) {
  const config =
    input.overrideConfig ??
    findCompetitorRegistryConfig(input.brandName) ?? {
      canonicalName: input.brandName,
      matchNames: [input.brandName],
    };

  const searchNames = Array.from(
    new Set([config.canonicalName, ...config.matchNames].map((value) => String(value || "").trim()).filter(Boolean)),
  );

  const existing = await input.withDbRetry(`查询 ${config.canonicalName} 竞品`, () =>
    input.prisma.competitors.findFirst({
      where: {
        OR: searchNames.map((name) => ({
          name: { contains: name, mode: "insensitive" },
        })),
      },
    }),
  );

  if (existing) {
    const patch = buildCompetitorUpdateData(existing, config);
    if (Object.keys(patch).length > 0) {
      const updated = await input.withDbRetry(`更新 ${config.canonicalName} 竞品`, () =>
        input.prisma.competitors.update({
          where: { id: existing.id },
          data: patch,
        }),
      );
      return updated.id;
    }

    return existing.id;
  }

  const created = await input.withDbRetry(`创建 ${config.canonicalName} 竞品`, () =>
    input.prisma.competitors.create({
      data: buildCompetitorCreateData(config),
    }),
  );

  return created.id;
}
