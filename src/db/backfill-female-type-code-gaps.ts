import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from "../lib/library-product-type-classifier.ts";
import {
  getParentLibraryTypeCodeForSubtype,
  type LibrarySubtypeCode,
  type LibraryTypeCode,
} from "../lib/library-product-types.ts";

dotenv.config();

const { Pool } = pg;
const SIGNAL_TEXT_LIMIT = 2400;

export type FemaleTypeGapRow = {
  id: string;
  name: string;
  brand: string | null;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  product_name: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type FemaleTypeGapPatch = {
  id: string;
  name: string;
  brand: string | null;
  typeCode: LibraryTypeCode;
  subtypeCode: LibrarySubtypeCode | null;
  fromTypeCode: string | null;
  fromSubtypeCode: string | null;
  reason: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function buildSignalText(row: FemaleTypeGapRow) {
  return [
    row.name,
    row.product_name,
    row.brand,
    row.gender,
    row.physical_form,
    row.raw_description,
    row.product_raw_description,
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

function buildTrustedSignalText(row: FemaleTypeGapRow) {
  return [
    row.name,
    row.product_name,
    row.brand,
    row.gender,
    row.physical_form,
    row.raw_description?.split(/\[英文正文摘录\]|\[英文详情\]/u, 1)[0],
    row.product_raw_description?.split(/\[英文正文摘录\]|\[英文详情\]/u, 1)[0],
    ...(Array.isArray(row.product_tags) ? row.product_tags : []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

function buildClassifierInput(row: FemaleTypeGapRow, typeCode?: string | null) {
  const rawDescription =
    [row.raw_description, row.product_raw_description]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n") || null;

  return {
    gender: row.gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription,
    tags: Array.isArray(row.product_tags)
      ? row.product_tags.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [],
    typeCode,
  };
}

function normalizeTypeCode(value: string | null | undefined): LibraryTypeCode | null {
  const normalized = normalizeText(value);
  return normalized ? (normalized as LibraryTypeCode) : null;
}

function isUnknownOrEmpty(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return !normalized || normalized === "unknown";
}

const EMPTY_OCR_PATTERNS = [
  /产品名称\/型号：未提及/u,
  /产品类型与使用方式：未提及/u,
  /动力规格[^。\n]*未提及/u,
  /核心卖点：未提及/u,
  /未执行或未识别到有效文字/u,
];

function hasOnlyEmptyOcr(row: FemaleTypeGapRow) {
  const descriptions = [row.raw_description, row.product_raw_description]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => normalizeText(value));

  return (
    descriptions.length > 0 &&
    descriptions.every((text) => EMPTY_OCR_PATTERNS.some((pattern) => pattern.test(text)))
  );
}

const NON_PRODUCT_PATTERNS = [
  /bundle|kit|set|套装/u,
  /replacement|attachment|adapter|connector|配件|替换头|转接器/u,
  /harness|strap[-\s]*on|背带|束具|绑带/u,
  /preview|monthly drop|预览|新品发布/u,
  /prompt cards?|conversation cards?|card game|扑克牌|卡牌|对话卡/u,
  /storage|treasure bag|玩具袋|收纳包/u,
];

function isNonProductLike(row: FemaleTypeGapRow, signalText: string) {
  const nameText = normalizeText(row.name);
  if (hasAny(nameText, NON_PRODUCT_PATTERNS)) return true;
  if (/sex machine|性爱机|性爱机器|mini sex machine/u.test(nameText)) return true;
  return /页面标题: .*收纳/u.test(signalText);
}

function hasUnsupportedAnalToySignal(signalText: string) {
  return /肛塞|肛门塞|肛门振动器|肛门刺激|肛门玩具|后庭|\banal\b|\bbutt plug\b|\bpower plug\b|\bbooty\b|\bplug[-\s]?ilicious\b|\brotator plug\b|\bintensity plug\b|\bbooty call\b/u.test(signalText);
}

function hasMixedNippleClampBundleSignal(signalText: string) {
  return /乳头夹|乳夹|nipple clamp|nipple clip/u.test(signalText) && /套装|组合|bundle|&|\+/u.test(signalText);
}

function selectCareSubtype(signalText: string): LibrarySubtypeCode | null {
  if (/避孕套|安全套|套套|\bcondoms?\b/u.test(signalText)) return "condom";
  if (/内衣|内裤|蕾丝|连体衣|睡衣|\blingerie\b|\bbodysuit\b|\blace\b/u.test(signalText)) return "lingerie";
  if (/润滑液|润滑剂|护理液|清洁液|湿巾|按摩油|按摩蜡烛|身体油|\blube\b|\blubricant\b|\bwipes?\b|\bcleaner\b/u.test(signalText)) {
    return "lube_care";
  }
  return null;
}

function selectBdsmSubtype(signalText: string): LibrarySubtypeCode | null {
  if (/手铐|脚铐|束缚|拘束|捆绑|\bbondage\b|\brestraints?\b|\bcuffs?\b/u.test(signalText)) {
    return "bondage_restraint";
  }
  if (/皮鞭|拍打|拍板|藤条|\bflogger\b|\bwhip\b|\bpaddle\b|\bspanking\b/u.test(signalText)) {
    return "impact_play";
  }
  if (/眼罩|蒙眼|\bblindfold\b/u.test(signalText)) return "sensory_play";
  if (/口塞|嘴塞|\bgag\b/u.test(signalText)) return "gag_mask";
  if (/项圈|牵引|\bcollar\b|\bleash\b/u.test(signalText)) return "collar_leash";
  if (/肛钩|\banal hook\b/u.test(signalText)) return "anal_hook_probe";
  if (/乳夹|乳头夹|\bnipple clamp\b|\bnipple clip\b/u.test(signalText)) return "nipple_play";
  if (/bdsm|调教|恋物|\bfetish\b/u.test(signalText)) return "fetish_accessory";
  return null;
}

function selectDeviceSubtype(typeCode: LibraryTypeCode, signalText: string): LibrarySubtypeCode | null {
  if (typeCode === "care_accessory") return selectCareSubtype(signalText);
  if (typeCode === "bdsm") return selectBdsmSubtype(signalText);
  if (typeCode === "suction") {
    return /插入|入体|g点|阴道|兔耳|双刺激|dual|rabbit/u.test(signalText) ? "suction_dual" : "suction_pure";
  }
  if (typeCode === "external_vibe") {
    return /魔杖|\bwand\b/u.test(signalText) ? "wand_massager" : "bullet_vibe";
  }
  if (typeCode === "insertable") {
    return /震动|振动|电动|马达|抽插|脉冲器|pulsator|\bvibrat/i.test(signalText) ? "insertable_vibe" : "gspot_insertable";
  }
  if (typeCode === "dual_stimulation") {
    if (/兔耳|兔嘴|兔子|\brabbit\b/u.test(signalText)) return "rabbit_dual";
    if (/吮吸|吸吮|压力波|声波|suction|sonic/u.test(signalText)) return "suction_dual";
    if (/双头|双马达|双震|双重|内外|同时刺激|阴蒂.{0,12}(阴道|g点)|g点.{0,12}阴蒂|a和g点|二段|伸缩|三球|舌头|舔舌|口交模拟/u.test(signalText)) {
      return "multi_head_dual";
    }
    return null;
  }
  if (typeCode === "wearable_remote") {
    if (/内裤|底裤|panty|panties/u.test(signalText)) return "panty_wearable";
    if (/双人|夫妻|情侣|伴侣|共用|partner|couple|for two|jive|moxie|chorus|tiani|play your way/u.test(signalText)) {
      return "dual_wearable_remote";
    }
    if (/入体|插入|阴道|g点|穿戴|佩戴|远控|遥控|app|lush|aya|猫爪/u.test(signalText)) {
      return "insertable_remote";
    }
    return null;
  }
  if (typeCode === "couples") {
    return /入体|插入|阴道|g点|穿戴|意念棒|tiani|蒂亚尼|chorus|jive/u.test(signalText) ? "insertable_couples" : "external_couples";
  }
  if (typeCode === "masturbator") {
    if (/互动|联动|同步|app|interactive|sync/u.test(signalText)) return "interactive_masturbator";
    if (/电动|震动|振动|加热|自动|vibrat/u.test(signalText)) return "vibrating_masturbator";
    return "manual_masturbator";
  }
  if (typeCode === "cock_ring") {
    return /震动|振动|电动|vibrating/u.test(signalText) ? "vibrating_cock_ring" : "classic_cock_ring";
  }
  if (typeCode === "prostate") {
    return /震动|振动|电动|vibrating/u.test(signalText) ? "prostate_vibe" : "prostate_plug";
  }
  return null;
}

function inferTypeFromFemaleSignals(signalText: string): LibraryTypeCode | null {
  const careSubtype = selectCareSubtype(signalText);
  if (careSubtype) return "care_accessory";

  const bdsmSubtype = selectBdsmSubtype(signalText);
  if (bdsmSubtype) return "bdsm";

  if (/提示卡|对话卡|卡牌|扑克牌|preview|预览|性爱机|sex machine/u.test(signalText)) return null;
  if (hasUnsupportedAnalToySignal(signalText)) return null;

  if (/夫妻|情侣|伴侣|双人|共用|for couples|for two|tiani|蒂亚尼|chorus|wevibe|we-vibe/u.test(signalText)) {
    return /穿戴|入体|插入|阴道|双马达|遥控|app/u.test(signalText) ? "couples" : "couples";
  }
  if (/吮吸|吸吮|压力波|声波|sonic|suction/u.test(signalText)) return "suction";
  if (/兔耳|兔嘴|兔子|双刺激|双重刺激|双马达|内外|同时刺激|三球/u.test(signalText)) {
    return "dual_stimulation";
  }
  if (/穿戴|佩戴|远控|遥控|app控制|app support|app支持|lush|aya/u.test(signalText) && /入体|插入|阴道|g点|穿戴|佩戴/u.test(signalText)) {
    return "wearable_remote";
  }
  if (/g点|ｇ点|g-spot|g-punkt|入体|插入|阴道|缩阴球|班瓦球|凯格尔|beads?|ben wa|珠™|黑色珠|dildo|硅胶玩具|振动蛋|自行抽插|抽插程序|pulsator/u.test(signalText)) {
    return "insertable";
  }
  if (/跳蛋|震动蛋|口红|子弹|振动器|震动器|按摩棒|震动棒|振动棒|阴蒂|clitoral|vibrator|finger vibrator|手指振动器|精准点刺激|舔舌动作|口交模拟器/u.test(signalText)) {
    return "external_vibe";
  }
  return null;
}

function subtypeMatchesType(subtypeCode: LibrarySubtypeCode, typeCode: LibraryTypeCode) {
  return getParentLibraryTypeCodeForSubtype(subtypeCode) === typeCode;
}

export function buildFemaleTypeGapPatch(row: FemaleTypeGapRow): FemaleTypeGapPatch | null {
  const currentTypeCode = normalizeTypeCode(row.current_type_code);
  const currentSubtypeCode = normalizeText(row.current_subtype_code) as LibrarySubtypeCode | "";
  const signalText = normalizeText(buildSignalText(row));
  const trustedSignalText = normalizeText(buildTrustedSignalText(row));

  if (currentTypeCode && currentSubtypeCode) return null;
  if (
    !signalText ||
    hasOnlyEmptyOcr(row) ||
    isNonProductLike(row, trustedSignalText) ||
    hasUnsupportedAnalToySignal(trustedSignalText) ||
    hasMixedNippleClampBundleSignal(trustedSignalText)
  ) {
    return null;
  }

  const classifierType = classifyLibraryTypeCode(buildClassifierInput(row));
  const resolvedTypeCode =
    currentTypeCode && currentTypeCode !== "unknown"
      ? currentTypeCode
      : inferTypeFromFemaleSignals(trustedSignalText);

  if (!resolvedTypeCode || resolvedTypeCode === "unknown") return null;

  const classifierSubtype = classifyLibrarySubtypeCode(buildClassifierInput(row, resolvedTypeCode));
  const localSubtype = selectDeviceSubtype(resolvedTypeCode, trustedSignalText);
  const subtypeCode =
    localSubtype ??
    (classifierSubtype && subtypeMatchesType(classifierSubtype, resolvedTypeCode)
      ? classifierSubtype
      : null);

  if (!subtypeCode || !subtypeMatchesType(subtypeCode, resolvedTypeCode)) return null;

  if (
    currentTypeCode === resolvedTypeCode &&
    currentSubtypeCode === subtypeCode
  ) {
    return null;
  }

  if (currentTypeCode && currentTypeCode !== "unknown" && getParentLibraryTypeCodeForSubtype(subtypeCode) !== currentTypeCode) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    typeCode: resolvedTypeCode,
    subtypeCode,
    fromTypeCode: row.current_type_code,
    fromSubtypeCode: row.current_subtype_code,
    reason: isUnknownOrEmpty(row.current_type_code) ? "infer_type_and_subtype" : "fill_missing_subtype",
  };
}

export function shouldRunFemaleTypeGapScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readGapRows(client: pg.PoolClient) {
  const result = await client.query<FemaleTypeGapRow>(
    `
      SELECT
        t.id::text,
        t.name,
        t.brand,
        t.gender,
        t.physical_form,
        LEFT(COALESCE(t.raw_description, ''), $1) AS raw_description,
        t.type_code AS current_type_code,
        t.subtype_code AS current_subtype_code,
        p.name AS product_name,
        p.tags AS product_tags,
        LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $1) AS product_raw_description
      FROM public.female_recommender_toys AS t
      LEFT JOIN public.products AS p ON p.id = t.original_id
      WHERE NULLIF(BTRIM(COALESCE(t.type_code, '')), '') IS NULL
         OR NULLIF(BTRIM(COALESCE(t.subtype_code, '')), '') IS NULL
         OR t.type_code = 'unknown'
      ORDER BY t.brand, t.name
    `,
    [SIGNAL_TEXT_LIMIT],
  );

  return result.rows;
}

async function backfillFemaleTypeGaps() {
  const shouldApply = process.argv.includes("--apply");
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    const rows = await readGapRows(client);
    const patches = rows
      .map(buildFemaleTypeGapPatch)
      .filter((patch): patch is FemaleTypeGapPatch => patch !== null);

    let updated = 0;
    if (shouldApply && patches.length > 0) {
      const placeholders = patches
        .map(
          (_, index) =>
            `($${index * 3 + 1}::uuid, $${index * 3 + 2}::text, $${index * 3 + 3}::text)`,
        )
        .join(", ");
      const values = patches.flatMap((patch) => [
        patch.id,
        patch.typeCode,
        patch.subtypeCode,
      ]);
      const result = await client.query(
        `
          UPDATE public.female_recommender_toys AS t
          SET type_code = v.type_code,
              subtype_code = v.subtype_code,
              updated_at = NOW()
          FROM (
            VALUES ${placeholders}
          ) AS v(id, type_code, subtype_code)
          WHERE t.id = v.id
            AND (
              t.type_code IS DISTINCT FROM v.type_code OR
              t.subtype_code IS DISTINCT FROM v.subtype_code
            )
        `,
        values,
      );
      updated = result.rowCount ?? 0;
    }

    const unresolved = rows.filter((row) => !patches.some((patch) => patch.id === row.id));
    const distribution = new Map<string, number>();
    for (const patch of patches) {
      const key = `${patch.typeCode}/${patch.subtypeCode ?? "null"}`;
      distribution.set(key, (distribution.get(key) ?? 0) + 1);
    }

    console.log(
      JSON.stringify(
        {
          apply: shouldApply,
          scanned: rows.length,
          patches: patches.length,
          updated,
          unresolved: unresolved.length,
          distribution: Object.fromEntries([...distribution.entries()].sort()),
          sample_patches: patches.slice(0, 60).map((patch) => ({
            brand: patch.brand,
            name: patch.name,
            reason: patch.reason,
            from: [patch.fromTypeCode, patch.fromSubtypeCode],
            to: [patch.typeCode, patch.subtypeCode],
          })),
          sample_unresolved: unresolved.slice(0, 60).map((row) => ({
            brand: row.brand,
            name: row.name,
            current: [row.current_type_code, row.current_subtype_code],
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunFemaleTypeGapScript(import.meta.url, process.argv[1])) {
  backfillFemaleTypeGaps().catch((error) => {
    console.error("[backfill-female-type-code-gaps] 执行失败:", error);
    process.exitCode = 1;
  });
}
