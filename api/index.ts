import * as serverAppModule from "../src/server/app.ts";

export function normalizeVercelApiRequestUrl(currentUrl: string) {
  const parsedUrl = new URL(currentUrl, "http://localhost");
  const path = parsedUrl.searchParams.get("path");

  if (!path) {
    return currentUrl;
  }

  parsedUrl.searchParams.delete("path");
  const search = parsedUrl.searchParams.toString();
  return `/api/${path}${search ? `?${search}` : ""}`;
}

function restoreOriginalApiUrl(request: unknown) {
  const req = request as { url?: string };
  req.url = normalizeVercelApiRequestUrl(req.url || "/api");
}

type ServerAppModule = {
  app: (req: unknown, res: unknown) => unknown;
  ensureServerReady: () => Promise<void>;
};

type ApiResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
};

function respondWithFunctionError(response: ApiResponse, error: unknown) {
  response.statusCode = 500;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      error: "Server initialization failed",
      details: error instanceof Error ? error.message : String(error),
    }),
  );
}

export function createApiHandler({
  loadServerApp = async () => serverAppModule as ServerAppModule,
}: {
  loadServerApp?: () => Promise<ServerAppModule>;
} = {}) {
  return async function handler(req: unknown, res: unknown) {
    try {
      const { app: serverApp, ensureServerReady: ensureReady } =
        await loadServerApp();
      await ensureReady();
      restoreOriginalApiUrl(req);
      return serverApp(req, res);
    } catch (error) {
      console.error("💥 [Vercel/API] 服务初始化失败:", error);
      respondWithFunctionError(res as ApiResponse, error);
    }
  };
}

export default createApiHandler();
