function normalizeDisplayTag(tag: string) {
  return String(tag || "").replace(/\s+/g, " ").trim();
}

export function dedupeDisplayTags(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = normalizeDisplayTag(tag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
