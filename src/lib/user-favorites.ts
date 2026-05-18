type FavoriteApiErrorPayload = {
  error?: string;
  details?: string;
};

async function readApiErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as FavoriteApiErrorPayload | null;
  const detail = payload?.details || payload?.error;
  return detail ? `${fallback}：${detail}` : fallback;
}

export async function listFavorites({
  authToken,
  fetcher = fetch,
}: {
  authToken: string;
  fetcher?: typeof fetch;
}) {
  if (!authToken.trim()) {
    throw new Error("需要登录后才能查看收藏");
  }

  const response = await fetcher("/api/user/favorites", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "读取收藏失败，请稍后重试"));
  }

  return (await response.json()) as { productIds: string[] };
}

export async function addFavorite({
  authToken,
  productId,
  fetcher = fetch,
}: {
  authToken: string;
  productId: string;
  fetcher?: typeof fetch;
}) {
  if (!authToken.trim()) {
    throw new Error("需要登录后才能收藏");
  }

  const response = await fetcher("/api/user/favorites", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "收藏失败，请稍后重试"));
  }
}

export async function removeFavorite({
  authToken,
  productId,
  fetcher = fetch,
}: {
  authToken: string;
  productId: string;
  fetcher?: typeof fetch;
}) {
  if (!authToken.trim()) {
    throw new Error("需要登录后才能取消收藏");
  }

  const response = await fetcher(`/api/user/favorites/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "取消收藏失败，请稍后重试"));
  }
}
