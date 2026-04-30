import {
  type KnowledgeNebulaTopicSlug,
  getKnowledgeNebulaTopicBySlug,
} from "../data/knowledge-nebula.ts";

export type KnowledgeNebulaRouteState = {
  route: "/knowledge";
  topicSlug?: KnowledgeNebulaTopicSlug;
};

const KNOWLEDGE_NEBULA_BASE_PATH = "/knowledge";

function trimTrailingSlashes(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function buildKnowledgeNebulaPath(topicSlug?: KnowledgeNebulaTopicSlug) {
  if (!topicSlug) return KNOWLEDGE_NEBULA_BASE_PATH;
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

  const slug = normalizedPathname.slice(`${KNOWLEDGE_NEBULA_BASE_PATH}/`.length);
  if (getKnowledgeNebulaTopicBySlug(slug)) {
    return {
      route: "/knowledge",
      topicSlug: slug as KnowledgeNebulaTopicSlug,
    };
  }

  return { route: "/knowledge", topicSlug: undefined };
}
