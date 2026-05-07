import type { AnswerState, Product } from "../data/mock.ts";
import { getDescriptionPreferenceAdjustments } from "./product-description-signals.ts";

export type ScorePresetId = "female" | "male" | "couple";

export type BranchPreferenceAdjustment = {
  score: number;
  summary: string[];
};

function hasDecisionPendingTag(
  answers: Pick<AnswerState, "tags">,
  tag: string,
) {
  return Array.isArray(answers.tags) && answers.tags.includes(tag);
}

function getUncertainPreferenceAdjustments(
  product: Product,
  answers: AnswerState,
  presetId: ScorePresetId,
): BranchPreferenceAdjustment {
  let score = 0;
  const summary: string[] = [];

  if (presetId === "female") {
    if (hasDecisionPendingTag(answers, "路线待判断")) {
      if (product.physicalForm === "external") {
        score += 6;
        summary.push("还没确定路线时，先从外部反馈更容易建立舒适感");
      } else if (product.physicalForm === "internal") {
        score -= 2;
      } else if (product.physicalForm === "composite") {
        score -= 3;
      }
    }

    if (hasDecisionPendingTag(answers, "敏感度待判断")) {
      if (product.motorType === "gentle") {
        score += 6;
        summary.push("敏感度还没摸清时，先从温和档位更稳妥");
      } else {
        score -= 3;
      }
    }
  }

  if (presetId === "male") {
    if (hasDecisionPendingTag(answers, "驱动待判断")) {
      if (product.physicalForm === "external") {
        score += 4;
        summary.push("驱动方式还没想清时，先从更好上手的结构开始");
      } else if (product.physicalForm === "composite") {
        score -= 2;
      }
    }

    if (hasDecisionPendingTag(answers, "刺激风格待判断")) {
      if (product.motorType === "gentle") {
        score += 4;
        summary.push("刺激风格待判断时，先从更耐玩的节奏入手更稳");
      } else {
        score -= 2;
      }
    }

    if (hasDecisionPendingTag(answers, "使用节奏待判断")) {
      if (product.waterproof != null && product.waterproof >= 6) {
        score += 3;
        summary.push("还没确定使用节奏时，优先看更省事、复用压力更低的类型");
      }
    }
  }

  if (presetId === "couple") {
    if (hasDecisionPendingTag(answers, "互动方式待判断") && product.gender === "unisex") {
      score += 4;
      summary.push("互动方式还没定下时，通用共玩结构更容易协调");
    }

    if (hasDecisionPendingTag(answers, "使用姿态待判断")) {
      if (product.physicalForm === "external") {
        score += 4;
        summary.push("使用姿态待判断时，先看更容易贴合配合的结构");
      } else if (product.physicalForm === "composite") {
        score -= 2;
      }
    }

    if (hasDecisionPendingTag(answers, "双方偏好待判断")) {
      if (product.motorType === "gentle") {
        score += 5;
        summary.push("双方偏好还在摸索时，温和路线更容易共同接受");
      } else {
        score -= 2;
      }
    }

    if (hasDecisionPendingTag(answers, "共玩场景待判断") && product.maxDb != null) {
      if (product.maxDb <= 50) {
        score += 3;
        summary.push("共玩场景待判断时，先保留更安静的氛围余量");
      } else if (product.maxDb >= 60) {
        score -= 2;
      }
    }
  }

  if (hasDecisionPendingTag(answers, "静音待判断") && product.maxDb != null) {
    if (product.maxDb <= 48) {
      score += 4;
      summary.push("环境要求还不明确时，静音一点更不容易出错");
    } else if (product.maxDb >= 60) {
      score -= 3;
    }
  }

  if (hasDecisionPendingTag(answers, "清洁待判断")) {
    if (product.waterproof != null && product.waterproof >= 6) {
      score += 3;
      summary.push("清洁要求待判断时，先选更省心的防水等级更安心");
    } else if (product.waterproof == null) {
      score -= 1;
    }
  }

  if (hasDecisionPendingTag(answers, "预算待判断")) {
    if (product.price >= 120 && product.price <= 320) {
      score += 4;
      summary.push("预算还没定下时，先看性价比更稳的中段价格带");
    } else if (product.price > 420) {
      score -= 3;
    }
  }

  if (hasDecisionPendingTag(answers, "收纳待判断")) {
    if (product.appearance === "high_disguise") {
      score += 3;
      summary.push("收纳压力待判断时，先保留更低存在感会更从容");
    }
  }

  return {
    score,
    summary: Array.from(new Set(summary)).slice(0, 4),
  };
}

function getAnsweredBranch(answers: Pick<AnswerState, "gender">): ScorePresetId {
  if (answers.gender === "male") return "male";
  if (answers.gender === "unisex") return "couple";
  return "female";
}

function looksLikeTengaPool(products: Product[]) {
  if (products.length === 0) return false;
  const tengaCount = products.filter((product) =>
    /tenga|iroha/i.test(`${product.brand || ""} ${product.name || ""}`),
  ).length;
  return tengaCount / products.length >= 0.35;
}

export function selectScorePresetId(
  answers: AnswerState,
  products: Product[],
): ScorePresetId {
  if (answers.gender === "female") return "female";
  if (answers.gender === "male") return "male";
  if (answers.gender === "unisex") return "couple";
  if (looksLikeTengaPool(products)) return "male";
  return "female";
}

export function getResultLeadCopy(
  answers: Pick<AnswerState, "gender">,
): string {
  switch (getAnsweredBranch(answers)) {
    case "female":
      return "基于你的刺激路径、敏感度和使用环境，我们筛出了更贴近这次状态的装备。";
    case "male":
      return "基于你的驱动方式、通道体验和使用目标，我们筛出了更顺手的一组装备。";
    case "couple":
      return "基于当前互动方式、贴合需求和共玩场景，我们筛出了更适合双人协同的一组装备。";
  }
}

export function buildBranchFallbackReason(
  product: Product,
  answers: AnswerState,
): string {
  switch (getAnsweredBranch(answers)) {
    case "female":
      if (answers.experienceLevel === "sensitive" && product.motorType === "gentle") {
        return "节奏更温和，适合慢热进入和细节感受。";
      }
      if (answers.physicalForm && product.physicalForm === answers.physicalForm) {
        return "刺激路径贴近你这次更想要的身体反馈路线。";
      }
      return "整体反馈更稳，适合作为这次路线下的平衡选择。";
    case "male":
      if (answers.sessionGoal === "daily") {
        return "顺手度和日常复用感更友好，适合稳定进入常用名单。";
      }
      if (answers.driveMode === "manual" && product.physicalForm === "external") {
        return "更适合自主掌控节奏，保留你想要的参与感。";
      }
      return "驱动和刺激路线更贴近这次使用目标。";
    case "couple":
      if (product.gender === "unisex") {
        return "更适合情侣共玩，互动和协同成本都更低。";
      }
      if (answers.maxDb != null && answers.maxDb < 100 && product.maxDb != null && product.maxDb <= answers.maxDb) {
        return "静音表现更稳，不容易打断当前互动氛围。";
      }
      return "更贴近这次双人互动的节奏和共玩场景。";
  }
}

export function buildBranchBackupReason(
  product: Product,
  backupLabel: string | undefined,
  answers?: Pick<
    AnswerState,
    | "gender"
    | "experienceLevel"
    | "sessionGoal"
    | "interactionMode"
    | "appearance"
    | "tags"
  >,
): string {
  const branch = getAnsweredBranch(answers ?? {});

  switch (branch) {
    case "female":
      switch (backupLabel) {
        case "更静音":
          return product.maxDb != null
            ? `噪音约 ${product.maxDb}dB，更适合安静、慢慢进入状态的环境`
            : "静音取向更明显，适合更放松的使用场景";
        case "更省预算":
          return `价格约 ${product.price} 元，适合作为更轻负担的尝鲜或补位选择`;
        case "更防水":
          return product.waterproof != null
            ? `防水约 IPX${product.waterproof}，更适合把清洁压力降下来`
            : "防水信息有限，但这条备选更偏向省心清洁";
        case "更隐蔽":
          return "外观更利于日常收纳，降低被看到时的压力";
        case "更直观":
          return "造型更直接，适合不太受伪装需求约束的场景";
        case "更强劲":
          return "输出更直接，适合想把反馈拉得更明显的时候";
        case "更温和":
          return "节奏更温和，适合慢热和细节感受";
        default:
          return "综合表现均衡，适合作为当前探索方向的补充备选";
      }
    case "male":
      switch (backupLabel) {
        case "更静音":
          return product.maxDb != null
            ? `噪音约 ${product.maxDb}dB，日常使用时存在感更低`
            : "静音取向更明显，适合想降低存在感的时候";
        case "更省预算":
          return `价格约 ${product.price} 元，适合作为更顺手的日常备选`;
        case "更防水":
          return product.waterproof != null
            ? `防水约 IPX${product.waterproof}，用后打理更省事，复用压力更低`
            : "防水信息有限，但这条备选更偏向省事维护";
        case "更隐蔽":
          return "收纳存在感更低，更适合低压力放置";
        case "更直观":
          return "造型更直接，适合只看体验、不太在意外观的场景";
        case "更强劲":
          return "输出更直接，适合追求更快更明显的反馈";
        case "更温和":
          return "节奏更稳，适合慢玩或日常释放";
        default:
          return "综合表现均衡，适合作为更顺手的一条备选方向";
      }
    case "couple":
      switch (backupLabel) {
        case "更静音":
          return product.maxDb != null
            ? `噪音约 ${product.maxDb}dB，更不容易打断互动氛围`
            : "静音取向更明显，更适合低打扰的共玩场景";
        case "更省预算":
          return `价格约 ${product.price} 元，适合作为更轻松的共玩备选`;
        case "更防水":
          return product.waterproof != null
            ? `防水约 IPX${product.waterproof}，双人场景下收尾更省心`
            : "防水信息有限，但这条备选更偏向双人收尾省心";
        case "更隐蔽":
          return "收纳压力更低，更适合双人日常留存";
        case "更直观":
          return "更偏体验表达，适合把互动感放在前面的场景";
        case "更强劲":
          return "反馈更直接，适合想把共玩存在感拉高的时候";
        case "更温和":
          return "节奏更柔和，适合更舒适的双人互动";
        default:
          return "综合表现均衡，适合作为不同共玩节奏下的备选方向";
      }
  }
}

export function getBranchShoppingGuidanceLead(
  answers: Pick<AnswerState, "gender">,
  filteredCount: number,
): string {
  const branch = getAnsweredBranch(answers);

  if (filteredCount <= 3) {
    switch (branch) {
      case "female":
        return "候选池比较窄，先看备选卡片，补足不同刺激路线。";
      case "male":
        return "候选池比较窄，先看备选卡片，比较哪款更顺手、更适合复用。";
      case "couple":
        return "候选池比较窄，先看备选卡片，优先比较更适合当前互动节奏的方向。";
    }
  }

  switch (branch) {
    case "female":
      return "当前结果已经收窄，可以重点比较更适合进入状态的差异化备选。";
    case "male":
      return "当前结果已经收窄，可以重点比较更顺手的差异化备选。";
    case "couple":
      return "当前结果已经收窄，可以重点比较更适合当前共玩氛围的差异化备选。";
  }
}

export function getBranchShoppingPreferenceHints(
  answers: Pick<
    AnswerState,
    "gender" | "maxDb" | "appearance" | "tags"
  >,
): string[] {
  const branch = getAnsweredBranch(answers);
  const hints: string[] = [];

  if (answers.maxDb != null && answers.maxDb < 100) {
    switch (branch) {
      case "female":
        hints.push("你在意静音，优先比较更安静、更不打断进入状态的备选。");
        break;
      case "male":
        hints.push("你在意静音，可优先比较更低存在感、更顺手复用的备选。");
        break;
      case "couple":
        hints.push("当前场景在意静音，优先比较不容易打断互动氛围的备选。");
        break;
    }
  }

  if (answers.appearance === "high_disguise") {
    switch (branch) {
      case "female":
        hints.push("你也在意隐蔽性，可顺手看更利于日常收纳的替代方向。");
        break;
      case "male":
        hints.push("你也在意收纳压力，可顺手看更低存在感的备选。");
        break;
      case "couple":
        hints.push("当前场景也在意收纳压力，可顺手看更低压力收纳的共玩备选。");
        break;
    }
  }

  return hints;
}

export function getBranchPreferenceAdjustments(
  product: Product,
  answers: AnswerState,
  presetId: ScorePresetId,
): BranchPreferenceAdjustment {
  const branchAdjustment = (() => {
    switch (presetId) {
      case "female":
        return getFemalePreferenceAdjustments(product, answers);
      case "male":
        return getMalePreferenceAdjustments(product, answers);
      case "couple":
        return getCouplePreferenceAdjustments(product, answers);
    }
  })();
  const descriptionAdjustment = getDescriptionPreferenceAdjustments(
    product,
    answers,
    presetId,
  );
  const uncertainAdjustment = getUncertainPreferenceAdjustments(
    product,
    answers,
    presetId,
  );

  return {
    score:
      branchAdjustment.score +
      descriptionAdjustment.score +
      uncertainAdjustment.score,
    summary: Array.from(
      new Set([
        ...branchAdjustment.summary,
        ...uncertainAdjustment.summary,
        ...descriptionAdjustment.summary,
      ]),
    ).slice(0, 4),
  };
}

function getFemalePreferenceAdjustments(
  product: Product,
  answers: AnswerState,
): BranchPreferenceAdjustment {
  let score = 0;
  const summary: string[] = [];

  if (answers.experienceLevel === "sensitive" && product.motorType === "gentle") {
    score += 6;
    summary.push("更适合温和慢热的进入节奏");
  }

  if (answers.experienceLevel === "intense" && product.motorType === "strong") {
    score += 6;
    summary.push("更贴近明确强反馈的期待");
  }

  if (answers.maxDb != null && answers.maxDb < 50 && product.maxDb != null && product.maxDb <= answers.maxDb) {
    score += 3;
  }

  return { score, summary };
}

function getMalePreferenceAdjustments(
  product: Product,
  answers: AnswerState,
): BranchPreferenceAdjustment {
  let score = 0;
  const summary: string[] = [];

  if (answers.driveMode === "manual" && product.physicalForm === "external") {
    score += 7;
    summary.push("更适合自主掌控节奏");
  }
  if (answers.driveMode === "automatic" && product.physicalForm === "internal") {
    score += 7;
    summary.push("更贴近省力自动的驱动体验");
  }
  if (answers.driveMode === "hybrid" && product.physicalForm === "composite") {
    score += 6;
    summary.push("更适合多结构复合玩法");
  }

  if (answers.channelFeel === "soft" && product.motorType === "gentle") {
    score += 6;
    summary.push("通道反馈更偏柔和耐玩");
  }
  if (answers.channelFeel === "tight" && product.motorType === "strong") {
    score += 6;
    summary.push("刺激路线更偏紧致直接");
  }

  if (answers.sessionGoal === "slow") {
    if (product.motorType === "gentle") score += 4;
    if (product.maxDb != null && product.maxDb <= 50) score += 2;
  }
  if (answers.sessionGoal === "daily" && product.waterproof != null && product.waterproof >= 6) {
    score += 4;
    summary.push("日常复用和清洁负担更友好");
  }
  if (answers.sessionGoal === "explosive" && product.motorType === "strong") {
    score += 5;
    summary.push("更贴近快速强刺激目标");
  }

  return { score, summary };
}

function getCouplePreferenceAdjustments(
  product: Product,
  answers: AnswerState,
): BranchPreferenceAdjustment {
  let score = 0;
  const summary: string[] = [];

  if (product.gender === "unisex") {
    score += 8;
    summary.push("更适合情侣共玩场景");
  }

  if (answers.fitPreference === "wearable" && product.physicalForm === "external") {
    score += 6;
    summary.push("贴合稳定，更适合共玩时保持接触点");
  }
  if (answers.fitPreference === "handheld" && product.physicalForm === "composite") {
    score += 6;
    summary.push("更适合手持切换和互动配合");
  }

  if (answers.sharedIntensity === "gentle" && product.motorType === "gentle") {
    score += 5;
    summary.push("更适合温和舒适的双方节奏");
  }
  if (answers.sharedIntensity === "strong" && product.motorType === "strong") {
    score += 5;
    summary.push("更贴近明确强反馈的共玩期待");
  }

  if (answers.coupleScene === "quiet") {
    if (product.maxDb != null && product.maxDb <= 50) {
      score += 5;
      summary.push("静音表现更不容易打断氛围");
    }
    if (product.appearance === "high_disguise") {
      score += 3;
    }
  }

  if (answers.interactionMode === "remote" && product.gender === "unisex") {
    score += 3;
  }

  if (answers.appearance === "high_disguise" && product.appearance === "high_disguise") {
    score += 3;
    summary.push("收纳压力更低，适合双人日常留存");
  }

  return {
    score,
    summary: Array.from(new Set(summary)).slice(0, 3),
  };
}
