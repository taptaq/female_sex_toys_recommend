import type { BodyPersonaResult } from "./body-persona.ts";

type BodyPersonaCandidate = {
  id: string;
  name: string;
  score: number;
  tags?: string[];
  typeCode?: string | null;
  appearance?: string | null;
  maxDb?: number | null;
};

function scorePersonaCandidate(
  personaCode: string,
  candidate: Pick<
    BodyPersonaCandidate,
    "appearance" | "maxDb" | "tags" | "score"
  >,
) {
  let boost = 0;

  if (personaCode === "starlit_guard") {
    if (candidate.appearance === "high_disguise") boost += 8;
    if ((candidate.maxDb ?? 99) <= 45) boost += 6;
    if ((candidate.tags ?? []).some((tag) => /伪装|静音|隐蔽/.test(tag))) {
      boost += 6;
    }
  }

  if (personaCode === "comet_spark") {
    if ((candidate.tags ?? []).some((tag) => /强刺激|直给|高能/.test(tag))) {
      boost += 6;
    }
  }

  return candidate.score + boost;
}

export function buildBodyPersonaFullReport({
  persona,
  candidatePool,
}: {
  persona: BodyPersonaResult;
  candidatePool: BodyPersonaCandidate[];
}) {
  const sorted = [...candidatePool]
    .map((candidate) => ({
      ...candidate,
      personaScore: scorePersonaCandidate(persona.primaryPersonaCode, candidate),
    }))
    .sort((a, b) => b.personaScore - a.personaScore)
    .slice(0, 5);

  return {
    title: persona.freeSummary.title,
    portrait: `${persona.freeSummary.blurb} 这意味着你更适合低压力但有边界感的体验路线。`,
    hiddenRouteSummary: `你的隐藏路线偏向${
      persona.hiddenRouteCode === "daily_object" ? "日常器物型" : "口袋随身型"
    }，隐藏力 ${persona.hiddenPowerGrade}，共居安心度 ${
      persona.coLivingComfortGrade === "high" ? "高" : "中"
    }。`,
    goodFits: ["更适合低存在感、易收纳、节奏可控的路线"],
    avoidNotes: ["暂不优先看高存在感、噪音更明显的路线"],
    productPicks: sorted,
  };
}
