export type LoadingFunFactSurface = "matching" | "loading";
export type LoadingFunFactTheme = "decision" | "care" | "experience";

export type LoadingFunFact = {
  id: string;
  title: string;
  description: string;
  theme: LoadingFunFactTheme;
  surfaces: LoadingFunFactSurface[];
  priorityTokens?: string[];
};

type GetLoadingFunFactsOptions = {
  preferredTags?: string[];
  preferredThemes?: LoadingFunFactTheme[];
};

const LOADING_FUN_FACTS: LoadingFunFact[] = [
  {
    id: "matching-angle",
    title: "角度往往比蛮力更关键",
    description:
      "体验强弱不只看参数大小，贴合角度、接触区域和节奏变化，通常更影响实际体感。",
    theme: "experience",
    priorityTokens: ["外部", "纯入体", "复合", "体验"],
    surfaces: ["matching"],
  },
  {
    id: "matching-beginner",
    title: "入门更适合稳定型产品",
    description:
      "新手通常更适合易清洁、反馈稳定、上手门槛低的款式，而不是一味追求最猛参数。",
    theme: "decision",
    priorityTokens: ["入门", "温柔", "慢玩", "新手"],
    surfaces: ["matching"],
  },
  {
    id: "matching-noise",
    title: "静音感受不只看分贝",
    description:
      "同一玩具放在不同表面上，结构共振和接触材质都会改变你实际听到的声音表现。",
    theme: "decision",
    priorityTokens: ["45dB", "静音", "分贝"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-rhythm",
    title: "节奏切换常比持续输出更耐玩",
    description:
      "很多人更偏好有层次的节奏变化，因为它更容易拉开体验差异，也更不容易疲劳。",
    theme: "experience",
    priorityTokens: ["强力", "进阶", "旗舰", "节奏"],
    surfaces: ["matching"],
  },
  {
    id: "matching-budget",
    title: "预算先买对方向，比堆功能更重要",
    description:
      "预算有限时，优先保证刺激方向、静音和清洁便利，比追求花哨模式更值得。",
    theme: "decision",
    priorityTokens: ["入门级", "进阶级", "旗舰级", "预算"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-appearance",
    title: "高伪装更看收纳心智",
    description:
      "所谓伪装感，不只是外观像不像日用品，还包括拿取是否顺手、是否敢放在常用位置。",
    theme: "decision",
    priorityTokens: ["高伪装", "伪装", "隐蔽"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-waterproof",
    title: "清洗压力会影响你后续使用频率",
    description:
      "如果一次用完后还要拆很多部件清洁，很多人会明显降低复用率，所以易洗往往很重要。",
    theme: "care",
    priorityTokens: ["防水", "清洁", "IPX"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-material-softness",
    title: "软硬度会直接改变体感路线",
    description:
      "同样的动力输出，外层更柔软通常更温和包裹，结构更硬朗则容易把刺激感传得更直接。",
    theme: "experience",
    priorityTokens: ["温柔", "强力", "慢玩", "紧致"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-first-try",
    title: "第一次尝试别把强度拉满",
    description:
      "先从更低档位和更短时长开始，往往更容易找到适合自己的节奏，也能减少不适感。",
    theme: "care",
    priorityTokens: ["入门", "温柔", "慢玩", "首次"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-summary",
    title: "最常被复购的，通常是最顺手的那款",
    description:
      "真正留下来的产品，往往不是参数最夸张的，而是拿取方便、清洁轻松、体感稳定的那一类。",
    theme: "decision",
    priorityTokens: ["预算", "复用", "稳定"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-mode-count",
    title: "常用档位比模式数量更重要",
    description:
      "模式很多不一定都常用，真正影响体验的是能否快速找到稳定、顺手、容易复现的那几档。",
    theme: "decision",
    priorityTokens: ["多频段", "自动型", "模式", "档位"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-skin-contact",
    title: "贴合稳定会放大体感细节",
    description:
      "同样的力度下，接触是否稳定、是否容易偏移，往往会明显改变细腻度和持续感。",
    theme: "experience",
    priorityTokens: ["柔软", "温柔", "纯入体", "外部"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "matching-expectation",
    title: "用前预期越具体，越容易选对",
    description:
      "先想清楚想要安静、强反馈、慢慢进入还是方便收纳，通常比临时看参数更可靠。",
    theme: "decision",
    priorityTokens: ["预算", "静音", "强力", "高伪装"],
    surfaces: ["matching", "loading"],
  },
  {
    id: "loading-waterproof",
    title: "防水不等于适合长期浸泡",
    description:
      "防水等级更偏向清洁与日常使用参考，接口、充电触点和密封老化都会影响长期表现。",
    theme: "care",
    priorityTokens: ["防水", "IPX", "清洁"],
    surfaces: ["loading"],
  },
  {
    id: "loading-material",
    title: "材质手感会直接影响偏好",
    description:
      "同样的震动模式，硅胶表层的软硬度、回弹和摩擦感不同，体感也会很不一样。",
    theme: "experience",
    priorityTokens: ["温柔", "强力", "慢玩", "紧致"],
    surfaces: ["loading"],
  },
  {
    id: "loading-clean",
    title: "清洁方便会提高复用率",
    description:
      "很多人最终更常使用的，并不是功能最多的款，而是结构简单、清洁省心、拿取顺手的那一款。",
    theme: "care",
    priorityTokens: ["清洁", "收纳", "防水"],
    surfaces: ["loading"],
  },
  {
    id: "loading-lube",
    title: "搭配合适润滑能明显改善体验",
    description:
      "尤其是偏入门或长时间使用场景，合适的润滑类型能减少拉扯感，让反馈更稳定舒适。",
    theme: "care",
    priorityTokens: ["入门", "温柔", "纯入体", "慢玩"],
    surfaces: ["loading"],
  },
  {
    id: "loading-charge",
    title: "续航焦虑会打断体验完整度",
    description:
      "如果你更在意随拿随用，稳定续航和充电方便，往往比多几个附加模式更有长期价值。",
    theme: "decision",
    priorityTokens: ["旗舰", "进阶", "日常"],
    surfaces: ["loading"],
  },
  {
    id: "loading-storage",
    title: "收纳方式会影响隐蔽体验",
    description:
      "硬壳盒、布袋和专属抽屉的差别很大，是否容易单独收纳，常常决定你用后是否更安心。",
    theme: "care",
    priorityTokens: ["高伪装", "隐蔽", "收纳"],
    surfaces: ["loading"],
  },
  {
    id: "loading-resonance",
    title: "桌面共振可能比机器本身更吵",
    description:
      "即使机器参数不高，接触床板、桌面或收纳盒时也可能放大声音，所以垫一层软物很有用。",
    theme: "care",
    priorityTokens: ["45dB", "静音", "分贝"],
    surfaces: ["loading"],
  },
  {
    id: "loading-ipx",
    title: "防水等级更像清洁线索",
    description:
      "多数人真正需要的是好冲洗、少藏污和好晾干，IPX 只是参考，不代表所有场景都省心。",
    theme: "decision",
    priorityTokens: ["防水", "IPX", "清洁"],
    surfaces: ["loading"],
  },
  {
    id: "loading-speed",
    title: "高档位不一定等于更舒服",
    description:
      "持续高强度有时反而会让感受变钝，很多人更喜欢逐步推进和中途切换节奏的玩法。",
    theme: "experience",
    priorityTokens: ["强力", "进阶", "旗舰", "节奏"],
    surfaces: ["loading"],
  },
  {
    id: "loading-care-routine",
    title: "用后 3 分钟的打理最关键",
    description:
      "及时清洁、擦干和放回固定位置，比事后补救更重要，也更能延长日常使用体验。",
    theme: "care",
    priorityTokens: ["清洁", "收纳", "维护"],
    surfaces: ["loading"],
  },
  {
    id: "loading-fit",
    title: "尺寸适配比纸面参数更重要",
    description:
      "哪怕价格更高，如果尺寸、造型或接触方式不适合自己，实际体验也很难稳定发挥出来。",
    theme: "decision",
    priorityTokens: ["外部", "纯入体", "复合", "适配"],
    surfaces: ["loading"],
  },
  {
    id: "loading-gentle",
    title: "温和不代表没存在感",
    description:
      "温和型更强调细节、层次和耐受友好度，很多人长期反而更依赖这种稳定可控的反馈。",
    theme: "experience",
    priorityTokens: ["温柔", "慢玩", "入门"],
    surfaces: ["loading"],
  },
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function getThemeScore(
  fact: LoadingFunFact,
  preferredThemes: LoadingFunFactTheme[],
) {
  const index = preferredThemes.indexOf(fact.theme);
  return index === -1 ? 0 : preferredThemes.length - index;
}

function getTagScore(fact: LoadingFunFact, preferredTags: string[]) {
  if (!fact.priorityTokens?.length || preferredTags.length === 0) {
    return 0;
  }

  const normalizedTags = preferredTags.map(normalizeText).filter(Boolean);
  let score = 0;

  for (const token of fact.priorityTokens) {
    const normalizedToken = normalizeText(token);
    if (!normalizedToken) continue;

    if (
      normalizedTags.some(
        (tag) => tag.includes(normalizedToken) || normalizedToken.includes(tag),
      )
    ) {
      score += 3;
    }
  }

  return score;
}

export function getLoadingFunFacts(
  surface: LoadingFunFactSurface,
  options: GetLoadingFunFactsOptions = {},
): LoadingFunFact[] {
  const preferredThemes = options.preferredThemes ?? [];
  const preferredTags = options.preferredTags ?? [];

  return LOADING_FUN_FACTS
    .filter((fact) => fact.surfaces.includes(surface))
    .map((fact, index) => ({
      fact,
      index,
      score:
        getTagScore(fact, preferredTags) * 10 +
        getThemeScore(fact, preferredThemes),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.fact);
}

export function getNextLoadingFunFactIndex(
  currentIndex: number,
  total: number,
): number {
  if (total <= 1) {
    return 0;
  }

  return (currentIndex + 1) % total;
}
