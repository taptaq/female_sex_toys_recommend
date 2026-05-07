# Home Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an anonymous feedback entry on the home page that opens a lightweight modal, collects required text plus up to three optional screenshots, and stores the submission in PostgreSQL through the existing Express server.

**Architecture:** Keep the UI local to the existing home page experience by adding a dedicated feedback modal component and a small browser-side helper for image validation/encoding. On the server, follow the existing store + route + ensure-schema pattern already used by recommendation profiles so anonymous feedback writes cleanly into a new `public.user_feedback` table.

**Tech Stack:** React 19, TypeScript, Lucide React, Express, `pg`, Node test runner, Tailwind CSS

---

### Task 1: Add feedback persistence on the server

**Files:**
- Create: `src/server/user-feedback-store.ts`
- Create: `src/server/user-feedback-store.test.ts`
- Create: `src/server/user-feedback-route.ts`
- Create: `src/server/user-feedback-route.test.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
test("ensureUserFeedbackSchema creates anonymous feedback storage", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [] };
    },
  };

  await ensureUserFeedbackSchema(pool);

  const combinedSql = queries.join("\n");
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.user_feedback/);
  assert.match(combinedSql, /message text NOT NULL/);
  assert.match(combinedSql, /screenshots jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(combinedSql, /page_route text NOT NULL DEFAULT '\/'/);
  assert.match(combinedSql, /user_agent text/);
  assert.match(combinedSql, /created_at timestamptz NOT NULL DEFAULT now\(\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/server/user-feedback-store.test.ts`
Expected: FAIL because `src/server/user-feedback-store.ts` does not exist yet.

- [ ] **Step 3: Write the minimal store and schema**

```ts
export type UserFeedbackStore = {
  saveFeedback: (input: {
    message: string;
    screenshots: string[];
    pageRoute: string;
    userAgent: string | null;
  }) => Promise<{ id: string }>;
};

export async function ensureUserFeedbackSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message text NOT NULL,
      screenshots jsonb NOT NULL DEFAULT '[]'::jsonb,
      page_route text NOT NULL DEFAULT '/',
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export function createUserFeedbackStore({ pool }: { pool: Queryable }): UserFeedbackStore {
  return {
    async saveFeedback(input) {
      const result = await pool.query(
        `
          INSERT INTO public.user_feedback (
            message,
            screenshots,
            page_route,
            user_agent
          )
          VALUES ($1, $2::jsonb, $3, $4)
          RETURNING id
        `,
        [
          input.message,
          JSON.stringify(input.screenshots),
          input.pageRoute,
          input.userAgent,
        ],
      );

      const row = result.rows[0] as { id?: string } | undefined;
      return { id: row?.id ?? "" };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/server/user-feedback-store.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing route tests**

```ts
test("feedback handler rejects an empty message", async () => {
  const handler = createSaveUserFeedbackHandler({
    store: { saveFeedback: async () => ({ id: "feedback-1" }) },
  });

  const mockResponse = createMockResponse();
  await handler(createMockRequest({ body: { message: "   ", screenshots: [] } }), mockResponse.response);

  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Feedback message is required",
  });
});

test("feedback handler rejects more than three screenshots", async () => {
  const handler = createSaveUserFeedbackHandler({
    store: { saveFeedback: async () => ({ id: "feedback-1" }) },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "筛选浮层被遮挡",
        screenshots: ["data:image/png;base64,a", "data:image/png;base64,b", "data:image/png;base64,c", "data:image/png;base64,d"],
      },
      headers: { "user-agent": "test-agent" },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "At most 3 screenshots are allowed",
  });
});

test("feedback handler stores anonymous feedback", async () => {
  let captured: unknown;
  const handler = createSaveUserFeedbackHandler({
    store: {
      saveFeedback: async (input) => {
        captured = input;
        return { id: "feedback-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      body: {
        message: "首页这里想补一个反馈入口",
        screenshots: ["data:image/png;base64,a"],
        pageRoute: "/",
      },
      headers: { "user-agent": "test-agent" },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { id: "feedback-1" });
  assert.match(JSON.stringify(captured), /首页这里想补一个反馈入口/);
  assert.match(JSON.stringify(captured), /test-agent/);
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `node --import tsx --test src/server/user-feedback-route.test.ts`
Expected: FAIL because `createSaveUserFeedbackHandler` does not exist yet.

- [ ] **Step 7: Write the minimal route handler and mount it**

```ts
function normalizeMessage(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeScreenshots(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => /^data:image\/(?:png|jpeg|webp);base64,/i.test(item));
}

export function createSaveUserFeedbackHandler({
  store,
}: {
  store: Pick<UserFeedbackStore, "saveFeedback">;
}) {
  return async (req: Request, res: Response) => {
    const message = normalizeMessage((req.body as Record<string, unknown> | null)?.message);
    const screenshots = normalizeScreenshots((req.body as Record<string, unknown> | null)?.screenshots);
    const pageRoute = typeof req.body?.pageRoute === "string" && req.body.pageRoute.trim()
      ? req.body.pageRoute.trim()
      : "/";

    if (!message) {
      res.status(400).json({ error: "Feedback message is required" });
      return;
    }

    if (screenshots.length > 3) {
      res.status(400).json({ error: "At most 3 screenshots are allowed" });
      return;
    }

    const saved = await store.saveFeedback({
      message,
      screenshots,
      pageRoute,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });

    res.status(201).json({ id: saved.id });
  };
}
```

Also register it in `src/server/index.ts`:

```ts
const userFeedbackStore = createUserFeedbackStore({ pool });
app.post("/api/feedback", createSaveUserFeedbackHandler({ store: userFeedbackStore }));
```

And include it in startup schema initialization:

```ts
ensureUserFeedbackSchema(pool),
```

- [ ] **Step 8: Run server tests to verify they pass**

Run: `node --import tsx --test src/server/user-feedback-store.test.ts src/server/user-feedback-route.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/server/user-feedback-store.ts src/server/user-feedback-store.test.ts src/server/user-feedback-route.ts src/server/user-feedback-route.test.ts src/server/index.ts
git commit -m "feat: add anonymous feedback storage"
```

### Task 2: Add a client helper for anonymous feedback submission

**Files:**
- Create: `src/lib/home-feedback.ts`
- Create: `src/lib/home-feedback.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
test("submitHomeFeedback posts message screenshots and page route", async () => {
  let captured: RequestInit | undefined;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    captured = init;
    return new Response(JSON.stringify({ id: "feedback-1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await submitHomeFeedback({
    message: "反馈内容",
    screenshots: ["data:image/png;base64,a"],
    pageRoute: "/",
    fetcher,
  });

  assert.deepEqual(result, { id: "feedback-1" });
  assert.match(String(captured?.body), /反馈内容/);
  assert.match(String(captured?.body), /data:image\/png;base64,a/);
});

test("submitHomeFeedback surfaces api error text", async () => {
  await assert.rejects(
    () =>
      submitHomeFeedback({
        message: "反馈内容",
        screenshots: [],
        pageRoute: "/",
        fetcher: async () =>
          new Response(JSON.stringify({ error: "Feedback message is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    /Feedback message is required/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/home-feedback.test.ts`
Expected: FAIL because `submitHomeFeedback` does not exist yet.

- [ ] **Step 3: Write the minimal helper**

```ts
type ApiErrorPayload = { error?: string; details?: string };

async function readApiErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const detail = payload?.details || payload?.error;
  return detail ? `${fallback}：${detail}` : fallback;
}

export async function submitHomeFeedback({
  message,
  screenshots,
  pageRoute,
  fetcher = fetch,
}: {
  message: string;
  screenshots: string[];
  pageRoute: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, screenshots, pageRoute }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "提交反馈失败，请稍后重试"));
  }

  return (await response.json()) as { id: string };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/home-feedback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/home-feedback.ts src/lib/home-feedback.test.ts
git commit -m "feat: add home feedback client helper"
```

### Task 3: Add the home feedback modal UI

**Files:**
- Create: `src/components/HomeFeedbackModal.tsx`
- Create: `src/components/HomeFeedbackModal.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`

- [ ] **Step 1: Write the failing home page and modal tests**

```ts
test("home page adds a feedback entry alongside secondary exploration actions", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /意见反馈/);
});
```

```ts
test("home feedback modal shows a required message field and optional screenshot picker", () => {
  const html = renderToStaticMarkup(
    <HomeFeedbackModal
      isOpen
      message=""
      screenshotPreviews={[]}
      isSubmitting={false}
      submitError={null}
      submitSuccess={null}
      onMessageChange={() => {}}
      onFilesSelected={() => {}}
      onRemoveScreenshot={() => {}}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

  assert.match(html, /反馈内容/);
  assert.match(html, /截图上传/);
  assert.match(html, /最多 3 张/);
  assert.match(html, /提交反馈/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/pages/HomePage.test.tsx src/components/HomeFeedbackModal.test.tsx`
Expected: FAIL because `HomeFeedbackModal` does not exist and the home page has no feedback entry.

- [ ] **Step 3: Write the minimal modal component**

```tsx
export function HomeFeedbackModal({
  isOpen,
  message,
  screenshotPreviews,
  isSubmitting,
  submitError,
  submitSuccess,
  onMessageChange,
  onFilesSelected,
  onRemoveScreenshot,
  onClose,
  onSubmit,
}: HomeFeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur-xl" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/94 p-5 shadow-[0_24px_90px_rgba(2,8,23,0.42)]" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg text-white">意见反馈</h3>
        <p className="mt-2 text-sm text-slate-400">遇到问题、卡点或想法都可以直接告诉我们。</p>
        <label className="mt-5 block text-xs text-slate-300">反馈内容</label>
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100"
        />
        <label className="mt-5 block text-xs text-slate-300">截图上传（可选，最多 3 张）</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event) => onFilesSelected(event.target.files)}
          className="mt-2 block w-full text-xs text-slate-400"
        />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {screenshotPreviews.map((preview, index) => (
            <button key={preview} type="button" onClick={() => onRemoveScreenshot(index)} className="rounded-2xl border border-white/8 bg-slate-900/90 p-1">
              <img src={preview} alt={`反馈截图 ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />
            </button>
          ))}
        </div>
        {submitError ? <p className="mt-3 text-xs text-rose-300">{submitError}</p> : null}
        {submitSuccess ? <p className="mt-3 text-xs text-emerald-300">{submitSuccess}</p> : null}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onSubmit} disabled={isSubmitting} className="flex-1 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-50">
            {isSubmitting ? "提交中..." : "提交反馈"}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-slate-300">
            暂不反馈
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire the home page entry and local modal state**

Add a third secondary entry in `src/pages/HomePage.tsx`:

```tsx
<SecondaryEntryButton
  onClick={() => setIsFeedbackModalOpen(true)}
  tone="cyan"
  tooltip="遇到问题、想提建议，或者有想补的体验细节，都可以直接告诉我们。"
>
  意见反馈
</SecondaryEntryButton>
```

Also add:

```tsx
const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
```

And render:

```tsx
<HomeFeedbackModal
  isOpen={isFeedbackModalOpen}
  ...
  onClose={() => setIsFeedbackModalOpen(false)}
/>;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test src/pages/HomePage.test.tsx src/components/HomeFeedbackModal.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/components/HomeFeedbackModal.tsx src/components/HomeFeedbackModal.test.tsx
git commit -m "feat: add home feedback modal shell"
```

### Task 4: Connect UI submission, screenshot limits, and success/error states

**Files:**
- Modify: `src/components/HomeFeedbackModal.tsx`
- Modify: `src/components/HomeFeedbackModal.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/lib/home-feedback.ts`

- [ ] **Step 1: Write the failing interaction tests**

```ts
test("home feedback modal prevents submitting an empty message", async () => {
  const html = renderToStaticMarkup(
    <HomeFeedbackModal
      isOpen
      message=""
      screenshotPreviews={[]}
      isSubmitting={false}
      submitError="请先填写反馈内容。"
      submitSuccess={null}
      onMessageChange={() => {}}
      onFilesSelected={() => {}}
      onRemoveScreenshot={() => {}}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

  assert.match(html, /请先填写反馈内容/);
});
```

```ts
test("home page keeps feedback entry secondary and exposes the modal host", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/pages/HomePage.tsx"), "utf8");

  assert.match(source, /意见反馈/);
  assert.match(source, /最多 3 张/);
  assert.match(source, /setIsFeedbackModalOpen/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/pages/HomePage.test.tsx src/components/HomeFeedbackModal.test.tsx`
Expected: FAIL until submit validation and screenshot handling are wired.

- [ ] **Step 3: Add minimal browser-side screenshot handling and submission flow**

Add local state in `src/pages/HomePage.tsx`:

```tsx
const [feedbackMessage, setFeedbackMessage] = useState("");
const [feedbackScreenshots, setFeedbackScreenshots] = useState<string[]>([]);
const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
const [feedbackError, setFeedbackError] = useState<string | null>(null);
const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
```

Use a small helper inside the page for file selection:

```tsx
async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("截图读取失败，请重试"));
    reader.readAsDataURL(file);
  });
}
```

And wire submission:

```tsx
async function handleSubmitFeedback() {
  const message = feedbackMessage.trim();
  if (!message) {
    setFeedbackError("请先填写反馈内容。");
    return;
  }

  setIsSubmittingFeedback(true);
  setFeedbackError(null);

  try {
    await submitHomeFeedback({
      message,
      screenshots: feedbackScreenshots,
      pageRoute: "/",
    });

    setFeedbackSuccess("反馈已收到，感谢你的补充。");
    setFeedbackMessage("");
    setFeedbackScreenshots([]);
    window.setTimeout(() => {
      setIsFeedbackModalOpen(false);
      setFeedbackSuccess(null);
    }, 900);
  } catch (error) {
    setFeedbackError(error instanceof Error ? error.message : "提交反馈失败，请稍后重试");
  } finally {
    setIsSubmittingFeedback(false);
  }
}
```

For file selection, cap the list at 3:

```tsx
async function handleFeedbackFilesSelected(fileList: FileList | null) {
  if (!fileList) return;
  const files = Array.from(fileList).slice(0, 3 - feedbackScreenshots.length);
  if (files.length === 0) {
    setFeedbackError("最多只能上传 3 张截图。");
    return;
  }

  const encoded = await Promise.all(files.map(fileToDataUrl));
  setFeedbackScreenshots((current) => [...current, ...encoded].slice(0, 3));
}
```

- [ ] **Step 4: Run all relevant tests**

Run: `node --import tsx --test src/pages/HomePage.test.tsx src/components/HomeFeedbackModal.test.tsx src/lib/home-feedback.test.ts src/server/user-feedback-store.test.ts src/server/user-feedback-route.test.ts`
Expected: PASS

- [ ] **Step 5: Run static verification**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/components/HomeFeedbackModal.tsx src/components/HomeFeedbackModal.test.tsx src/lib/home-feedback.ts
git commit -m "feat: wire anonymous home feedback flow"
```

## Self-review

- Spec coverage checked:
  - Home page entry: Task 3
  - Anonymous modal flow: Task 3 and Task 4
  - Required text + optional screenshots max 3: Task 1 and Task 4
  - New feedback table and API: Task 1
  - Success/error states and non-blocking UX: Task 4
- Placeholder scan checked:
  - No `TODO` or `implement later` markers remain
  - Each task includes explicit file paths, tests, commands, and minimal code
- Type consistency checked:
  - `saveFeedback`, `createSaveUserFeedbackHandler`, and `submitHomeFeedback` naming is consistent across tasks

