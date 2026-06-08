export function shouldPersistXiaoguaishouReviewEntry(rawDescription: string | null | undefined): boolean {
  const text = String(rawDescription || '').trim();
  return Boolean(text && text !== '信息未获取');
}
