import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';

type TranslationCacheEntry = {
  source: string;
  translated: string;
  updatedAt: string;
};

type TranslationCache = Record<string, TranslationCacheEntry>;

const URL_PATTERN = /https?:\/\/[^\s]+/g;

let primaryClient: OpenAI | null = null;
let fallbackClient: OpenAI | null = null;

function getPrimaryClient(): OpenAI {
  if (primaryClient) return primaryClient;
  const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY / DEEPSEEK_API_KEY 未配置，无法执行英文转中文。');
  }
  primaryClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com/v1',
  });
  return primaryClient;
}

function getFallbackClient(): OpenAI {
  if (fallbackClient) return fallbackClient;
  const provider = resolveTranslationFallbackProvider();

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY / OPENAI_API_KEY 未配置，无法执行 DeepSeek 翻译兜底。');
    }
    fallbackClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
    return fallbackClient;
  }

  if (provider === 'glm') {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error('GLM_API_KEY 未配置，无法执行 GLM 翻译兜底。');
    }
    fallbackClient = new OpenAI({
      apiKey,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    });
    return fallbackClient;
  }

  throw new Error('DEEPSEEK_API_KEY / OPENAI_API_KEY / GLM_API_KEY 均未配置，无法执行英文转中文兜底。');
}

export function resolveTranslationFallbackProvider(
  env: NodeJS.ProcessEnv = process.env,
): 'deepseek' | 'glm' | null {
  if (env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY) {
    return 'deepseek';
  }
  if (env.GLM_API_KEY) {
    return 'glm';
  }
  return null;
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readCache(cachePath: string): TranslationCache {
  if (!fs.existsSync(cachePath)) return {};
  try {
    const content = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as TranslationCache;
  } catch {
    return {};
  }
}

function writeCache(cachePath: string, cache: TranslationCache) {
  ensureDir(cachePath);
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

function textHash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

function hasEnglishContent(input: string): boolean {
  return /[A-Za-z]{4,}/.test(input || '');
}

function sanitizeModelOutput(value: string): string {
  return String(value || '')
    .replace(/```(?:json|text)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

export function replaceUrlsWithPlaceholders(input: string): {
  text: string;
  placeholders: Array<{ placeholder: string; url: string }>;
} {
  const source = String(input || '');
  const urls = source.match(URL_PATTERN) ?? [];
  if (urls.length === 0) {
    return { text: source, placeholders: [] };
  }

  let nextText = source;
  const placeholders = urls.map((url, index) => {
    const placeholder = `【链接${index + 1}】`;
    nextText = nextText.replace(url, placeholder);
    return { placeholder, url };
  });

  return { text: nextText, placeholders };
}

export function restoreUrlPlaceholders(
  input: string,
  placeholders: Array<{ placeholder: string; url: string }>,
): string {
  let restored = String(input || '');
  for (const entry of placeholders) {
    restored = restored.replaceAll(entry.placeholder, entry.url);
  }
  return restored;
}

function chunkByLines(input: string, maxChars = 14000): string[] {
  const text = String(input || '').replace(/\r/g, '\n');
  if (text.length <= maxChars) return [text];

  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= maxChars) {
      current = line;
      continue;
    }
    let start = 0;
    while (start < line.length) {
      const part = line.slice(start, start + maxChars);
      chunks.push(part);
      start += maxChars;
    }
    current = '';
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

async function translateChunkToZh(chunk: string): Promise<string> {
  const prompt = `
你是一个严格的翻译器。请把下面内容里的英文翻译成简体中文。

要求：
1. 保留原有结构、换行、方括号标题（例如 [基础信息]、[英文正文摘录]）。
2. 仅翻译英文，已有中文保持不变。
3. 不要总结，不要删减，不要补充解释。
4. 所有英文短语都要翻译（包括副标题、页面标题、分类提示、卖点摘要、正文句子）。
5. 像【链接1】这类占位符必须原样保留，不要改写，不要解释。
6. 输出中禁止出现任何英文字母（A-Z/a-z），但原始链接占位符除外。
7. 只输出翻译结果本身。

待处理文本：
"""
${chunk}
"""
`;

  try {
    const primary = getPrimaryClient();
    const response = await primary.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });
    const output = sanitizeModelOutput(response.choices[0]?.message?.content || '');
    return output || chunk;
  } catch (primaryError) {
    const provider = resolveTranslationFallbackProvider();
    if (!provider) {
      throw primaryError;
    }

    const fallback = getFallbackClient();

    if (provider === 'deepseek') {
      const response = await fallback.chat.completions.create({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });
      const output = sanitizeModelOutput(response.choices[0]?.message?.content || '');
      return output || chunk;
    }

    const response = await fallback.chat.completions.create({
      model: 'glm-4.6v',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });
    const output = sanitizeModelOutput(response.choices[0]?.message?.content || '');
    return output || chunk;
  }
}

export async function translateRawDescriptionToZh(
  input: string,
  options?: {
    cachePath?: string;
    logLabel?: string;
    force?: boolean;
  },
): Promise<string> {
  const source = String(input || '').trim();
  if (!source) return source;
  if (!hasEnglishContent(source)) return source;

  const cachePath = options?.cachePath ? path.resolve(options.cachePath) : '';
  let cache: TranslationCache = {};
  if (cachePath) cache = readCache(cachePath);

  const hash = textHash(source);
  if (!options?.force && cache[hash]?.translated) return cache[hash].translated;

  const label = options?.logLabel ? ` ${options.logLabel}` : '';
  const { text: protectedSource, placeholders } = replaceUrlsWithPlaceholders(source);
  const chunks = chunkByLines(protectedSource, 14000);
  const translatedChunks: string[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    console.log(`[翻译]${label} 分块 ${index + 1}/${chunks.length}`);
    const translated = await translateChunkToZh(chunks[index]);
    translatedChunks.push(translated);
  }

  const translated =
    restoreUrlPlaceholders(translatedChunks.join('\n').trim() || source, placeholders);
  if (cachePath) {
    cache[hash] = {
      source,
      translated,
      updatedAt: new Date().toISOString(),
    };
    writeCache(cachePath, cache);
  }
  return translated;
}
