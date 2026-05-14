import type { KnowledgeNebulaTopicSlug } from "../data/knowledge-nebula.ts";
import { AppRoute, detectRoute } from "./app-shell.ts";
import { buildKnowledgeNebulaPath, parseKnowledgeNebulaPath } from "./knowledge-nebula-route.ts";

export type AppHistoryState = {
  knowledgeOriginRoute?: AppRoute;
  profilesOriginRoute?: AppRoute;
};

export type ShellRouteState = {
  route: AppRoute;
  knowledgeTopicSlug?: KnowledgeNebulaTopicSlug;
};

export type AppLocationSnapshot = {
  route: AppRoute;
  knowledgeTopicSlug?: KnowledgeNebulaTopicSlug;
  knowledgeSectionId?: string;
  knowledgeOriginRoute?: AppRoute;
  profilesOriginRoute?: AppRoute;
};

function scrollWindowToTop() {
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function buildShellRouteState(
  route: AppRoute,
  knowledgeTopicSlug?: KnowledgeNebulaTopicSlug,
): ShellRouteState {
  return {
    route,
    knowledgeTopicSlug: route === "/knowledge" ? knowledgeTopicSlug : undefined,
  };
}

export function isInvalidKnowledgeDetailPath(pathname: string) {
  if (detectRoute(pathname) !== "/knowledge") {
    return false;
  }

  const normalizedPathname =
    pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  if (normalizedPathname === "/knowledge") {
    return false;
  }

  return parseKnowledgeNebulaPath(pathname).topicSlug === undefined;
}

export function readAppLocationSnapshot(
  pathname: string,
  historyState?: AppHistoryState | null,
): AppLocationSnapshot {
  const route = detectRoute(pathname);
  const parsedKnowledgeRoute =
    route === "/knowledge" ? parseKnowledgeNebulaPath(pathname) : undefined;

  return {
    route,
    knowledgeTopicSlug: parsedKnowledgeRoute?.topicSlug,
    knowledgeSectionId: parsedKnowledgeRoute?.sectionId,
    knowledgeOriginRoute:
      route === "/knowledge" ? historyState?.knowledgeOriginRoute : undefined,
    profilesOriginRoute:
      route === "/profiles" ? historyState?.profilesOriginRoute : undefined,
  };
}

export function pushAppRoute(route: AppRoute, replace = false) {
  if (window.location.pathname !== route) {
    window.history[replace ? "replaceState" : "pushState"]({}, "", route);
  }
  scrollWindowToTop();
}

export function pushKnowledgeRoute(params: {
  topicSlug?: KnowledgeNebulaTopicSlug;
  sectionId?: string;
  replace?: boolean;
  currentRoute: AppRoute;
  knowledgeOriginRoute?: AppRoute;
}) {
  const {
    topicSlug,
    sectionId,
    replace = false,
    currentRoute,
    knowledgeOriginRoute,
  } = params;
  const knowledgePath = buildKnowledgeNebulaPath(topicSlug, sectionId);
  const nextKnowledgeOriginRoute =
    currentRoute === "/knowledge" ? knowledgeOriginRoute : currentRoute;

  if (window.location.pathname !== knowledgePath) {
    window.history[replace ? "replaceState" : "pushState"](
      { knowledgeOriginRoute: nextKnowledgeOriginRoute } satisfies AppHistoryState,
      "",
      knowledgePath,
    );
  } else if (replace) {
    window.history.replaceState(
      { knowledgeOriginRoute: nextKnowledgeOriginRoute } satisfies AppHistoryState,
      "",
      knowledgePath,
    );
  }

  scrollWindowToTop();
  return nextKnowledgeOriginRoute;
}

export function pushProfilesRoute(params: {
  currentRoute: AppRoute;
  profilesOriginRoute?: AppRoute;
}) {
  const { currentRoute, profilesOriginRoute } = params;
  const nextProfilesOriginRoute =
    currentRoute === "/profiles" ? profilesOriginRoute : currentRoute;

  if (window.location.pathname !== "/profiles") {
    window.history.pushState(
      { profilesOriginRoute: nextProfilesOriginRoute } satisfies AppHistoryState,
      "",
      "/profiles",
    );
  }

  scrollWindowToTop();
  return nextProfilesOriginRoute;
}
