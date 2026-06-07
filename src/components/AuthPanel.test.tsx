import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AuthPanel } from "./AuthPanel.tsx";

test("auth panel keeps inputs editable even before supabase config is ready", () => {
  const html = renderToStaticMarkup(
    <AuthPanel
      isConfigured={false}
      userLabel={null}
      statusMessage={null}
      isSubmitting={false}
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(html, /需要配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY 后才能完成登录或注册/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /type="email"[^>]*disabled=""/);
  assert.doesNotMatch(html, /type="password"[^>]*disabled=""/);
  assert.match(html, /type="submit"[^>]*disabled/);
});

test("auth panel uses email wording for login and signup", () => {
  const html = renderToStaticMarkup(
    <AuthPanel
      isConfigured={true}
      userLabel={null}
      statusMessage={null}
      isSubmitting={false}
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(html, /邮箱/);
  assert.match(html, /autoComplete="email"|autocomplete="email"/);
  assert.doesNotMatch(html, /用户名/);
});

test("auth panel modal surface is opaque instead of glassy", () => {
  const html = renderToStaticMarkup(
    <AuthPanel
      isConfigured={true}
      userLabel={null}
      statusMessage={null}
      isSubmitting={false}
      surface="modal"
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(html, /auth-panel-modal/);
  assert.match(html, /bg-white\/95/);
  assert.doesNotMatch(html, /bg-slate-950/);
  assert.doesNotMatch(html, /bg-cyan-400\/\[/);
});

test("auth panel uses a calmer stacked layout on mobile for both auth and signed-in states", () => {
  const signedOutHtml = renderToStaticMarkup(
    <AuthPanel
      isConfigured={true}
      userLabel={null}
      statusMessage={null}
      isSubmitting={false}
      surface="modal"
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(
    signedOutHtml,
    /mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between/,
  );
  assert.match(signedOutHtml, /w-full/);
  assert.match(signedOutHtml, /justify-center/);
  assert.match(signedOutHtml, /sm:w-auto/);

  const signedInHtml = renderToStaticMarkup(
    <AuthPanel
      isConfigured={true}
      userLabel="taptaq"
      statusMessage={null}
      isSubmitting={false}
      surface="modal"
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(
    signedInHtml,
    /flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between/,
  );
  assert.match(signedInHtml, /w-full/);
  assert.match(signedInHtml, /justify-center/);
  assert.match(signedInHtml, /sm:w-auto/);
});
