import {
  type KnowledgeNebulaTopicSlug,
  getKnowledgeNebulaTopicBySlug,
} from "../data/knowledge-nebula.ts";

export type KnowledgeNebulaRouteState = {
  route: "/knowledge";
  topicSlug?: KnowledgeNebulaTopicSlug;
  sectionId?: string;
};

const KNOWLEDGE_NEBULA_BASE_PATH = "/knowledge";

function trimTrailingSlashes(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function buildKnowledgeNebulaPath(
  topicSlug?: KnowledgeNebulaTopicSlug,
  sectionId?: string,
) {
  if (!topicSlug) return KNOWLEDGE_NEBULA_BASE_PATH;
  if (sectionId) {
    return `${KNOWLEDGE_NEBULA_BASE_PATH}/${topicSlug}/${sectionId}`;
  }
  return `${KNOWLEDGE_NEBULA_BASE_PATH}/${topicSlug}`;
}

export function parseKnowledgeNebulaPath(pathname: string): KnowledgeNebulaRouteState {
  const normalizedPathname = trimTrailingSlashes(pathname);

  if (normalizedPathname === KNOWLEDGE_NEBULA_BASE_PATH) {
    return { route: "/knowledge", topicSlug: undefined };
  }

  if (!normalizedPathname.startsWith(`${KNOWLEDGE_NEBULA_BASE_PATH}/`)) {
    return { route: "/knowledge", topicSlug: undefined };
  }

  const slugSegments = normalizedPathname
    .slice(`${KNOWLEDGE_NEBULA_BASE_PATH}/`.length)
    .split("/")
    .filter(Boolean);
  const slug = slugSegments[0];
  if (getKnowledgeNebulaTopicBySlug(slug)) {
    return {
      route: "/knowledge",
      topicSlug: slug as KnowledgeNebulaTopicSlug,
      sectionId: slugSegments[1] || undefined,
    };
  }

  return { route: "/knowledge", topicSlug: undefined };
}
