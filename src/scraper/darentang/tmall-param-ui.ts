import type { Page } from 'playwright';

/**
 * 天猫详情里「参数」常在折叠 Tab / 懒加载面板中，需先点击再抓 DOM。
 */
export async function tryRevealTmallParamTabs(page: Page): Promise<void> {
  const tryClick = async (text: string) => {
    await page.getByRole('tab', { name: text, exact: true }).click({ timeout: 1800 }).catch(() => {});
    await page.getByText(text, { exact: true }).first().click({ timeout: 1800 }).catch(() => {});
  };

  const tryScrollToText = async (text: string) => {
    const locator = page.getByText(text, { exact: true }).first();
    await locator.scrollIntoViewIfNeeded({ timeout: 1800 }).catch(() => {});
    await locator.click({ timeout: 1800 }).catch(() => {});
  };

  await tryClick('产品参数');
  await tryClick('规格与包装');
  await tryClick('规格参数');
  await tryClick('参数信息');

  await page.getByRole('tab', { name: '参数', exact: true }).click({ timeout: 1500 }).catch(() => {});
  const onlyParam = page.locator('[role="tab"]').filter({ hasText: /^参数$/ }).first();
  await onlyParam.click({ timeout: 1500 }).catch(() => {});

  // 新版详情页常要先点顶部导航，再把正文滚到「参数信息」标题附近才会真正渲染参数块。
  await tryScrollToText('参数信息');
  await page.evaluate(async () => {
    const targets = Array.from(document.querySelectorAll('div, span, h2, h3, h4')).filter((el) =>
      (el.textContent || '').trim() === '参数信息',
    ) as HTMLElement[];

    const target = targets.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top > 0 && rect.top < window.innerHeight * 2;
    }) || targets[0];

    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 500));
      window.scrollBy(0, -120);
      await new Promise((r) => setTimeout(r, 500));
    }
  }).catch(() => {});

  await page.waitForTimeout(1200);
}
