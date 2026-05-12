const PERSONA_TITLES = {
  soft_glow: "微光型·慢热探索者",
  starlit_guard: "星幕型·隐秘安全感者",
  tidal_sync: "潮汐型·感官共振者",
  comet_spark: "彗火型·即时点燃者",
  ring_control: "星环型·节奏掌控者",
  twin_orbit: "双轨型·关系联动者",
} as const;

export const BODY_PERSONA_QUESTIONS = [
  {
    id: "safety_need",
    title: "刚进入体验前，你更在意什么？",
    options: [
      {
        value: "high",
        label: "先让我安心，再慢慢进入",
        weights: { starlit_guard: 3, soft_glow: 2 },
      },
      {
        value: "medium",
        label: "有点铺垫最好，但不用太久",
        weights: { tidal_sync: 2, ring_control: 2 },
      },
      {
        value: "low",
        label: "我更想快速进入状态",
        weights: { comet_spark: 3 },
      },
    ],
  },
  {
    id: "privacy_need",
    title: "对收纳和被看见这件事，你更像哪种？",
    options: [
      {
        value: "high",
        label: "最好低调到一眼看不出来",
        weights: { starlit_guard: 3 },
        hidden: { route: "daily_object", power: 2 },
      },
      {
        value: "medium",
        label: "别太高调，顺手收起来就好",
        weights: { soft_glow: 1, ring_control: 1 },
        hidden: { route: "pocket_ready", power: 1 },
      },
      {
        value: "low",
        label: "只要体验对，外观不是第一位",
        weights: { comet_spark: 1, tidal_sync: 1 },
      },
    ],
  },
  {
    id: "pace_preference",
    title: "更接近你的进入节奏的是？",
    options: [
      {
        value: "slow",
        label: "慢慢升温比较舒服",
        weights: { soft_glow: 3, starlit_guard: 2 },
      },
      {
        value: "balanced",
        label: "有铺垫，但不用太长",
        weights: { tidal_sync: 2, ring_control: 2 },
      },
      {
        value: "fast",
        label: "希望更快进入状态",
        weights: { comet_spark: 3 },
      },
    ],
  },
  {
    id: "sensory_preference",
    title: "你更喜欢哪种反馈风格？",
    options: [
      {
        value: "layered",
        label: "细腻、有层次、慢慢叠上来",
        weights: { tidal_sync: 3, soft_glow: 1 },
      },
      {
        value: "balanced",
        label: "均衡、稳定、有变化",
        weights: { ring_control: 2, twin_orbit: 1 },
      },
      {
        value: "direct",
        label: "直接、明确、别绕太久",
        weights: { comet_spark: 3 },
      },
    ],
  },
  {
    id: "control_preference",
    title: "你更喜欢怎样掌握过程？",
    options: [
      {
        value: "manual",
        label: "我想自己掌控节奏和切换",
        weights: { ring_control: 3, starlit_guard: 1 },
      },
      {
        value: "hybrid",
        label: "我想掌控大方向，细节交给产品也行",
        weights: { tidal_sync: 2, twin_orbit: 1 },
      },
      {
        value: "guided",
        label: "只要路线对，顺着走就好",
        weights: { comet_spark: 1, soft_glow: 1 },
      },
    ],
  },
  {
    id: "relationship_preference",
    title: "你更在意哪种使用氛围？",
    options: [
      {
        value: "solo",
        label: "我更偏单人、自我探索",
        weights: { soft_glow: 2, starlit_guard: 1 },
      },
      {
        value: "balanced",
        label: "单人和互动都可以",
        weights: { tidal_sync: 2, ring_control: 1 },
      },
      {
        value: "paired",
        label: "我更在意陪伴、同步和互动感",
        weights: { twin_orbit: 3 },
      },
    ],
  },
] as const;

export function resolveBodyPersonaResult({
  answers,
}: {
  answers: Record<string, string>;
}) {
  const personaScores = {
    soft_glow: 0,
    starlit_guard: 0,
    tidal_sync: 0,
    comet_spark: 0,
    ring_control: 0,
    twin_orbit: 0,
  };

  const hiddenRouteScore = {
    zero_profile: 0,
    daily_object: 0,
    beauty_disguise: 0,
    pocket_ready: 0,
  };

  let hiddenPower = 0;

  for (const question of BODY_PERSONA_QUESTIONS) {
    const selected = question.options.find(
      (option) => option.value === answers[question.id],
    );
    if (!selected) continue;

    for (const [code, score] of Object.entries(selected.weights)) {
      personaScores[code as keyof typeof personaScores] += score;
    }

    if (selected.hidden?.route) {
      hiddenRouteScore[selected.hidden.route as keyof typeof hiddenRouteScore] +=
        selected.hidden.power;
      hiddenPower += selected.hidden.power;
    }
  }

  const rankedPersonas = Object.entries(personaScores).sort(
    (a, b) => b[1] - a[1],
  );
  const primaryPersonaCode = rankedPersonas[0]?.[0] ?? "soft_glow";
  const secondaryPersonaCode = rankedPersonas[1]?.[0] ?? null;
  const hiddenRouteCode =
    Object.entries(hiddenRouteScore).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "pocket_ready";
  const hiddenPowerGrade =
    hiddenPower >= 2 ? "S" : hiddenPower >= 1 ? "A" : "B";
  const title =
    PERSONA_TITLES[primaryPersonaCode as keyof typeof PERSONA_TITLES] ??
    PERSONA_TITLES.soft_glow;

  return {
    primaryPersonaCode,
    secondaryPersonaCode,
    hiddenRouteCode,
    hiddenPowerGrade,
    coLivingComfortGrade:
      hiddenPower >= 2 ? "high" : hiddenPower >= 1 ? "medium" : "low",
    freeSummary: {
      title,
      blurb:
        primaryPersonaCode === "starlit_guard"
          ? "你更在意低压力进入、隐私边界和不打扰自己的节奏。"
          : primaryPersonaCode === "comet_spark"
            ? "你更偏向反馈明确、进入更快、体验目标更清晰的路线。"
            : "你更适合先建立自己的节奏，再向更贴合的体验路线推进。",
      why:
        primaryPersonaCode === "starlit_guard"
          ? "你在隐私需求、慢热节奏和安全感维度得分更高。"
          : primaryPersonaCode === "comet_spark"
            ? "你在启动速度、直接反馈和低铺垫倾向上得分更高。"
            : "你的答案在节奏、层次和掌控感之间形成了稳定偏好。",
      hints:
        primaryPersonaCode === "starlit_guard"
          ? ["先看低存在感路线", "优先节奏温和、易收纳的产品"]
          : primaryPersonaCode === "comet_spark"
            ? ["优先看反馈直接路线", "更适合启动更快的产品"]
            : ["先看与你当前场景不冲突的路线", "把节奏匹配放在参数前面"],
    },
  };
}
