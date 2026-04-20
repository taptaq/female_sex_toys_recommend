/** 合并进白名单时允许的单字段最大长度（产地/厂名等可能略长） */
export const MAX_MERGED_PARAM_VALUE_LEN = 220;
const PARAM_KEY_REGEX =
  /^(材质|面料材质|材料|品牌|产地|原产地|生产企业|生产厂家|厂家|制造商|生产商|生产企业名称|备案人|注册人|委托生产企业|医疗器械名称|产品名称|商品名称|分类|类别|型号分类|品名|名称|商品名|型号|颜色分类)$/;

function normalizeInlineText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/：/g, ':').trim();
}

function isCandidateParamKey(text: string): boolean {
  return PARAM_KEY_REGEX.test(text.replace(/[:：]/g, '').trim());
}

export function isPlaceholderParamValue(text: string): boolean {
  const normalized = normalizeInlineText(text).replace(/[。.!！?？,，;；]+$/g, '');
  return /^(未提及|暂无|未知|无|没有|未说明|暂未提及|暂未说明|不详|n\/a|none)$/i.test(normalized);
}

export function extractParamPairsFromCompactText(text: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();
  const push = (k: string, v: string) => {
    const kk = normalizeInlineText(k).replace(/:$/, '');
    const vv = normalizeInlineText(v);
    if (!kk || !vv || !isCandidateParamKey(kk) || vv.length > MAX_MERGED_PARAM_VALUE_LEN) return;
    const sig = `${kk}\0${vv}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    pairs.push([kk, vv]);
  };

  const sectionStarts = ['参数信息', '产品参数', '规格参数', '基本信息'];
  const sectionEnds = ['图文详情', '本店推荐', '看了又看', '用户评价', '店铺优惠后', '颜色分类切换大图模式'];
  const keyNames = [
    '委托生产企业',
    '生产企业名称',
    '医疗器械名称',
    '商品名称',
    '产品名称',
    '生产企业',
    '生产厂家',
    '颜色分类',
    '原产地',
    '型号分类',
    '制造商',
    '生产商',
    '商品名',
    '材质',
    '材料',
    '品牌',
    '产地',
    '分类',
    '品名',
    '名称',
    '型号',
    '厂家',
    '类别',
  ];

  for (const startToken of sectionStarts) {
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const start = text.indexOf(startToken, searchFrom);
      if (start < 0) break;
      searchFrom = start + startToken.length;

      let section = text.slice(start + startToken.length, start + startToken.length + 1500);
      let minEnd = section.length;
      for (const endToken of sectionEnds) {
        const idx = section.indexOf(endToken);
        if (idx >= 0) minEnd = Math.min(minEnd, idx);
      }
      section = section.slice(0, minEnd).trim();
      if (!section) continue;

      const positions: Array<{ key: string; start: number; end: number }> = [];
      for (const key of keyNames) {
        let from = 0;
        while (from < section.length) {
          const idx = section.indexOf(key, from);
          if (idx < 0) break;
          positions.push({ key, start: idx, end: idx + key.length });
          from = idx + key.length;
        }
      }

      positions.sort((a, b) => a.start - b.start || b.key.length - a.key.length);

      const deduped = positions.filter((pos, index) => {
        const prev = positions[index - 1];
        return !prev || prev.start !== pos.start;
      });

      if (!deduped.length) continue;

      const first = deduped[0];
      const prefix = section.slice(0, first.start).trim();
      if (prefix) push(first.key, prefix);

      for (let i = 0; i < deduped.length; i++) {
        const current = deduped[i];
        const next = deduped[i + 1];
        const value = section.slice(current.end, next ? next.start : section.length).trim();
        if (value) push(current.key, value);
      }
    }
  }

  return pairs;
}

/**
 * 详情页「参数」白名单键归一化（Node 与调试脚本共用）
 */
export function normalizeParamKey(key: string): string {
  const k = key.replace(/\s+/g, '').toLowerCase();
  if (k.includes('材质') || k.includes('面料材质') || k.includes('材料')) return '材质';
  if (k.includes('品牌')) return '品牌';
  if (k.includes('产地') || k.includes('原产地')) return '产地';
  if (
    k.includes('生产企业') ||
    k.includes('生产厂家') ||
    k.includes('厂家') ||
    k.includes('制造商') ||
    k.includes('生产商') ||
    k.includes('备案人') ||
    k.includes('注册人') ||
    k.includes('委托生产企业')
  ) {
    return '生产企业';
  }
  if (k.includes('分类') || k.includes('类别') || k.includes('型号分类') || k.includes('颜色分类')) return '分类';
  if (
    k.includes('品名') ||
    k.includes('商品名') ||
    k.includes('产品名称') ||
    k.includes('商品名称') ||
    k.includes('医疗器械名称') ||
    (k.includes('型号') && !k.includes('颜色分类'))
  ) {
    return '品名';
  }
  if (k.includes('名称') && !k.includes('企业') && !k.includes('备案') && !k.includes('注册')) return '品名';
  return '';
}

function decodeOneJsonString(raw: string): string {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * 从详情页原始 HTML 中抠「商品属性」JSON（新版页常见，不依赖 #J_AttrUL）。
 * 覆盖：name/value 对、分号分隔的 properties 串。
 */
export function extractParamPairsFromPageHtml(html: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();

  const push = (k: string, v: string) => {
    const kk = k.replace(/\s+/g, ' ').trim();
    const vv = v.replace(/\s+/g, ' ').trim();
    if (!kk || !vv || vv.length > 500) return;
    const sig = `${kk}\0${vv}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    pairs.push([kk, vv]);
  };

  const reNv = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"value"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = reNv.exec(html)) !== null) {
    push(decodeOneJsonString(m[1]), decodeOneJsonString(m[2]));
  }

  const reNvRev = /"value"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  while ((m = reNvRev.exec(html)) !== null) {
    push(decodeOneJsonString(m[2]), decodeOneJsonString(m[1]));
  }

  const reProp = /"properties"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  while ((m = reProp.exec(html)) !== null) {
    const raw = decodeOneJsonString(m[1]);
    for (const seg of raw.split(/;+/)) {
      const idxCol = seg.indexOf(':');
      const idxCn = seg.indexOf('：');
      const idx = idxCol >= 0 && idxCn >= 0 ? Math.min(idxCol, idxCn) : Math.max(idxCol, idxCn);
      if (idx <= 0 || idx > 45) continue;
      push(seg.slice(0, idx), seg.slice(idx + 1));
    }
  }

  return pairs;
}

/**
 * 从任意文本（整页 HTML、mtop 响应体）中宽松匹配天猫常见的参数字段对。
 */
export function extractParamPairsFromLooseJsonText(text: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();
  const push = (k: string, v: string) => {
    const kk = k.replace(/\s+/g, ' ').trim();
    const vv = v.replace(/\s+/g, ' ').trim();
    if (!kk || !vv || kk.length > 80 || vv.length > 500) return;
    const sig = `${kk}\0${vv}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    pairs.push([kk, vv]);
  };

  const run = (re: RegExp, swap: boolean) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (swap) push(decodeOneJsonString(m[2]), decodeOneJsonString(m[1]));
      else push(decodeOneJsonString(m[1]), decodeOneJsonString(m[2]));
    }
  };

  run(
    /"propertyName"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"propertyValueName"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
    false,
  );
  run(
    /"propertyValueName"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"propertyName"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
    true,
  );
  run(/"attrName"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"attrValue"\s*:\s*"((?:[^"\\]|\\.)*)"/g, false);
  run(/"paramName"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"paramValue"\s*:\s*"((?:[^"\\]|\\.)*)"/g, false);

  return pairs;
}

/**
 * 从 OCR/LLM 回显文本中提取可回填的参数字段。
 * 典型输入：
 * 1. 产品名称/型号: iroha 小花蕾
 * 2. 内部构造/材质: 食品级硅胶
 */
export function extractParamPairsFromOcrText(text: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();
  const push = (k: string, v: string) => {
    const kk = k.replace(/\s+/g, ' ').trim();
    const vv = v.replace(/\s+/g, ' ').trim();
    if (!kk || !vv || vv.length > MAX_MERGED_PARAM_VALUE_LEN || isPlaceholderParamValue(vv)) return;
    const sig = `${kk}\0${vv}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    pairs.push([kk, vv]);
  };

  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(?:\d+\.\s*)?([^:：]{2,40})[:：]\s*(.+)$/);
    if (!match) continue;

    const rawKey = match[1];
    const rawVal = match[2].trim();
    const mappedKey = normalizeParamKey(rawKey);
    if (!mappedKey) continue;

    let value = rawVal;
    if (mappedKey === '品名') {
      value = value.replace(/^iroha[\s·_-]*/i, '').trim() || rawVal;
    }
    push(mappedKey, value);
  }

  return pairs;
}

/**
 * 将 HTML 与 DOM 抓到的候选对合并进 Map（按 normalizeParamKey 白名单）
 */
export function mergeWhitelistParams(
  merged: Map<string, string>,
  candidates: Array<[string, string]>,
): void {
  for (const [rawKey, rawVal] of candidates) {
    const mappedKey = normalizeParamKey(rawKey);
    if (
      mappedKey &&
      rawVal &&
      rawVal.length > 0 &&
      rawVal.length <= MAX_MERGED_PARAM_VALUE_LEN &&
      !isPlaceholderParamValue(rawVal)
    ) {
      if (!merged.has(mappedKey)) merged.set(mappedKey, rawVal);
    }
  }
}

/**
 * 在浏览器 frame 内执行：多策略抓取「属性: 值」候选对（与 crawler 详情逻辑一致）
 */
export function scrapeParamPairsInPage(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const maxLen = 220;
  const paramKeyRegex =
    /^(材质|材料|品牌|产地|原产地|生产企业|生产厂家|厂家|制造商|生产商|生产企业名称|备案人|注册人|委托生产企业|医疗器械名称|产品名称|商品名称|分类|类别|型号分类|品名|名称|商品名|型号|颜色分类)$/;
  const seen = new Set<string>();
  const normalize = (v: string) => v.replace(/\s+/g, ' ').replace(/：/g, ':').trim();
  const isCandidateKey = (text: string) => paramKeyRegex.test(text.replace(/[:：]/g, '').trim());
  const extractCompactPairs = (text: string): Array<[string, string]> => {
    const compactPairs: Array<[string, string]> = [];
    const compactSeen = new Set<string>();
    const compactPush = (k: string, v: string) => {
      const kk = normalize(k).replace(/:$/, '');
      const vv = normalize(v);
      if (!kk || !vv || !isCandidateKey(kk) || vv.length > maxLen) return;
      const sig = `${kk}\0${vv}`;
      if (compactSeen.has(sig)) return;
      compactSeen.add(sig);
      compactPairs.push([kk, vv]);
    };

    const sectionStarts = ['参数信息', '产品参数', '规格参数', '基本信息'];
    const sectionEnds = ['图文详情', '本店推荐', '看了又看', '用户评价', '店铺优惠后', '颜色分类切换大图模式'];
    const keyNames = [
      '委托生产企业',
      '生产企业名称',
      '医疗器械名称',
      '商品名称',
      '产品名称',
      '生产企业',
      '生产厂家',
      '颜色分类',
      '原产地',
      '型号分类',
      '制造商',
      '生产商',
      '商品名',
      '材质',
      '材料',
      '品牌',
      '产地',
      '分类',
      '品名',
      '名称',
      '型号',
      '厂家',
      '类别',
    ];

    for (const startToken of sectionStarts) {
      let searchFrom = 0;
      while (searchFrom < text.length) {
        const start = text.indexOf(startToken, searchFrom);
        if (start < 0) break;
        searchFrom = start + startToken.length;

        let section = text.slice(start + startToken.length, start + startToken.length + 1500);
        let minEnd = section.length;
        for (const endToken of sectionEnds) {
          const idx = section.indexOf(endToken);
          if (idx >= 0) minEnd = Math.min(minEnd, idx);
        }
        section = section.slice(0, minEnd).trim();
        if (!section) continue;

        const positions: Array<{ key: string; start: number; end: number }> = [];
        for (const key of keyNames) {
          let from = 0;
          while (from < section.length) {
            const idx = section.indexOf(key, from);
            if (idx < 0) break;
            positions.push({ key, start: idx, end: idx + key.length });
            from = idx + key.length;
          }
        }

        positions.sort((a, b) => a.start - b.start || b.key.length - a.key.length);
        const deduped = positions.filter((pos, index) => {
          const prev = positions[index - 1];
          return !prev || prev.start !== pos.start;
        });
        if (!deduped.length) continue;

        const first = deduped[0];
        const prefix = section.slice(0, first.start).trim();
        if (prefix) compactPush(first.key, prefix);

        for (let i = 0; i < deduped.length; i++) {
          const current = deduped[i];
          const next = deduped[i + 1];
          const value = section.slice(current.end, next ? next.start : section.length).trim();
          if (value) compactPush(current.key, value);
        }
      }
    }

    return compactPairs;
  };
  const push = (k: string, v: string) => {
    const kk = normalize(k).replace(/:$/, '');
    const vv = normalize(v);
    if (!kk || !vv || kk.length > 80 || vv.length > maxLen) return;
    const sig = `${kk}\0${vv}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    pairs.push([kk, vv]);
  };
  const collectNearbyValue = (el: Element | null): string => {
    if (!el) return '';

    const candidates = [
      el.nextElementSibling,
      el.previousElementSibling,
      el.parentElement?.nextElementSibling,
      el.parentElement?.previousElementSibling,
    ];

    for (const candidate of candidates) {
      const text = normalize((candidate as HTMLElement | null)?.innerText || candidate?.textContent || '');
      if (text && !isCandidateKey(text) && text.length <= maxLen) {
        return text;
      }
    }

    return '';
  };

  const attrNodes = document.querySelectorAll('ul#J_AttrUL li');
  attrNodes.forEach((li) => {
    const text = normalize(li.textContent || '');
    const match = text.match(/^([^:：]{2,22})\s*[:：]\s*(.+)$/);
    if (match) push(match[1], match[2]);
  });

  document.querySelectorAll('dl').forEach((dl) => {
    const dts = Array.from(dl.querySelectorAll('dt'));
    const dds = Array.from(dl.querySelectorAll('dd'));
    const n = Math.min(dts.length, dds.length);
    for (let i = 0; i < n; i++) {
      const k = normalize(dts[i].textContent || '');
      const v = normalize(dds[i].textContent || '');
      if (k && v && k.length < 50 && v.length < 400) push(k, v);
    }
  });

  document.querySelectorAll('tr').forEach((tr) => {
    const tds = tr.querySelectorAll('td');
    if (tds.length === 2) {
      const k = normalize(tds[0].textContent || '');
      const v = normalize(tds[1].textContent || '');
      if (k && v && k.length < 45 && v.length < 400) push(k, v);
    }
  });

  const rows = Array.from(
    document.querySelectorAll(
      'tr, li, dt, dd, [class*="row" i], [class*="item" i], div.BasicContent--item--1h9O_v_, [class*="param" i] li, [class*="attrs" i] li',
    ),
  );
  for (const row of rows) {
    const text = normalize(row.textContent || '');
    if (!text || text.length > 260) continue;

    const matchPos = text.indexOf(':');
    const matchPosCn = text.indexOf('：');
    let cut = -1;
    if (matchPos > 0 && matchPos < 22) cut = matchPos;
    if (matchPosCn > 0 && matchPosCn < 22) {
      cut = cut < 0 ? matchPosCn : Math.min(cut, matchPosCn);
    }
    if (cut >= 0) {
      push(text.slice(0, cut), text.slice(cut + 1));
    } else {
      const children = Array.from(row.children) as HTMLElement[];
      if (children.length === 2 && children[0].innerText && children[1].innerText) {
        push(children[0].innerText, children[1].innerText);
      }
    }
  }

  const allElements = document.querySelectorAll('span, div, p, label, th');
  for (const el of Array.from(allElements)) {
    const text = normalize(el.textContent || '');
    const keyOnly = text.replace(/[:：]/g, '');
    if (isCandidateKey(keyOnly)) {
      const nearbyValue = collectNearbyValue(el);
      if (nearbyValue) {
        push(keyOnly, nearbyValue);
      }
    }
  }

  const containerSelectors = [
    'section',
    'article',
    'li',
    'dl',
    'tr',
    '[class*="item" i]',
    '[class*="row" i]',
    '[class*="card" i]',
    '[class*="content" i]',
    '[class*="param" i]',
    '[class*="attr" i]',
  ].join(', ');
  const containers = Array.from(document.querySelectorAll(containerSelectors)).slice(0, 1200);
  for (const container of containers) {
    const leafTexts = Array.from(container.querySelectorAll('span, div, p, label, dt, dd, strong'))
      .filter((node) => node.children.length === 0)
      .map((node) => normalize((node as HTMLElement).innerText || node.textContent || ''))
      .filter((text, index, arr) => text && text.length <= maxLen && arr.indexOf(text) === index)
      .slice(0, 6);

    if (leafTexts.length < 2 || leafTexts.length > 4) continue;

    for (let i = 0; i < leafTexts.length - 1; i++) {
      const a = leafTexts[i];
      const b = leafTexts[i + 1];
      if (isCandidateKey(a) && !isCandidateKey(b)) push(a, b);
      if (!isCandidateKey(a) && isCandidateKey(b)) push(b, a);
    }
  }

  const bodyText = (document.body?.innerText || '').replace(/\r/g, '');
  for (const [k, v] of extractCompactPairs(bodyText)) {
    push(k, v);
  }
  const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = line.replace(/[:：]$/, '');
    if (isCandidateKey(cleanLine)) {
      const nextLine = (lines[i + 1] || '').trim();
      if (nextLine && nextLine.length <= maxLen) {
        push(cleanLine, nextLine);
      }

      const prevLine = (lines[i - 1] || '').trim();
      if (prevLine && !isCandidateKey(prevLine) && prevLine.length <= maxLen) {
        push(cleanLine, prevLine);
      }
    } else {
      const mm = line.match(/^(.{2,22})[:：]\s*(.+)$/);
      if (mm && isCandidateKey(mm[1])) {
        push(mm[1], mm[2]);
      }
    }
  }

  return pairs;
}

/**
 * 天猫/淘宝新版详情把「商品属性」放在 window.__ICE_APP_CONTEXT__.loaderData 的大 JSON 里，
 * 首屏不渲染成 #J_AttrUL，需在页面上下文递归收集 { name, value } / { text, value } / { key, value }。
 */
export function scrapeParamPairsFromIceContext(): Array<[string, string]> {
  const w = window as unknown as { __ICE_APP_CONTEXT__?: { loaderData?: unknown } };
  const loaderData = w.__ICE_APP_CONTEXT__?.loaderData;
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();

  const push = (k: string, v: string) => {
    const kk = k.replace(/\s+/g, ' ').trim();
    const vv = v.replace(/\s+/g, ' ').trim();
    if (!kk || !vv || kk.length > 80 || vv.length > 500) return;
    const sig = `${kk}\0${vv}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    pairs.push([kk, vv]);
  };

  const walk = (obj: unknown, depth: number): void => {
    if (depth > 20 || pairs.length > 300) return;
    if (obj === null || obj === undefined) return;
    if (typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item, depth + 1);
      return;
    }

    const o = obj as Record<string, unknown>;

    if (typeof o.propertyName === 'string' && typeof o.propertyValueName === 'string') {
      push(o.propertyName, o.propertyValueName);
    }
    if (typeof o.attrName === 'string' && typeof o.attrValue === 'string') {
      push(o.attrName, o.attrValue);
    }
    if (typeof o.paramName === 'string' && typeof o.paramValue === 'string') {
      push(o.paramName, o.paramValue);
    }
    if (typeof o.title === 'string' && typeof o.content === 'string' && o.title.length <= 35) {
      const hint = o.title.replace(/\s+/g, '');
      if (
        /材质|品牌|产地|生产企业|品名|名称|分类|备案|注册|医疗器械|产品名称|生产厂家|材料/.test(hint)
      ) {
        push(o.title, o.content.slice(0, 400));
      }
    }

    const value = o.value;
    if (typeof value === 'string') {
      if (typeof o.name === 'string') push(o.name, value);
      else if (typeof o.text === 'string') push(o.text, value);
      else if (typeof o.key === 'string') push(o.key, value);
    } else if (value && typeof value === 'object' && typeof o.name === 'string') {
      const vo = value as Record<string, unknown>;
      const inner =
        typeof vo.text === 'string'
          ? vo.text
          : typeof vo.name === 'string'
            ? vo.name
            : typeof vo.value === 'string'
              ? vo.value
              : null;
      if (inner) push(o.name, inner);
    }

    for (const k of Object.keys(o)) walk(o[k], depth + 1);
  };

  walk(loaderData, 0);
  return pairs;
}
