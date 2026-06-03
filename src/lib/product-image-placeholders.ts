import type { LibrarySubtypeCode } from "./library-product-types.ts";

/**
 * 产品图片占位符映射系统
 *
 * 为不同的 subtype_code 提供精美的兜底图片
 * 当产品没有真实图片时，使用对应类型的占位符图片
 */

export type ProductImagePlaceholder = {
  /** 占位符类型 - 'image' 使用图片URL，'gradient' 使用 CSS 渐变类名 */
  type: 'image' | 'gradient';
  /** 图片URL或CSS类名 */
  value: string;
  /** 占位符描述（用于 alt 文本） */
  description: string;
};

/**
 * Subtype 到占位符的映射表
 *
 * 图片命名规范：{subtype_code}.png
 * 图片路径：/assets/product-placeholder/
 * 建议尺寸：800x800px (1:1 比例)
 */
const SUBTYPE_IMAGE_PLACEHOLDERS: Partial<Record<LibrarySubtypeCode, ProductImagePlaceholder>> = {
  // ==================== 女性向产品 ====================

  // 吮吸类
  suction_pure: {
    type: 'image',
    value: '/assets/product-placeholder/suction_pure.png',
    description: '纯吮吸产品示意图'
  },

  suction_dual: {
    type: 'image',
    value: '/assets/product-placeholder/suction_dual.png',
    description: '吮吸双刺激产品示意图'
  },

  // 外部震动
  bullet_vibe: {
    type: 'image',
    value: '/assets/product-placeholder/bullet_vibe.png',
    description: '跳蛋产品示意图'
  },

  wand_massager: {
    type: 'image',
    value: '/assets/product-placeholder/wand_massager.png',
    description: '魔杖按摩器示意图'
  },

  // 入体震动
  gspot_insertable: {
    type: 'image',
    value: '/assets/product-placeholder/gspot_insertable.png',
    description: 'G点探索产品示意图'
  },

  insertable_vibe: {
    type: 'image',
    value: '/assets/product-placeholder/insertable_vibe.png',
    description: '入体震动产品示意图'
  },

  // 双刺激
  rabbit_dual: {
    type: 'image',
    value: '/assets/product-placeholder/rabbit_dual.png',
    description: '兔耳双刺激产品示意图'
  },

  multi_head_dual: {
    type: 'image',
    value: '/assets/product-placeholder/multi_head_dual.png',
    description: '多头双刺激产品示意图'
  },

  // ==================== 双人互动 ====================

  insertable_couples: {
    type: 'image',
    value: '/assets/product-placeholder/insertable_couples.png',
    description: '双人入体产品示意图'
  },

  external_couples: {
    type: 'image',
    value: '/assets/product-placeholder/external_couples.png',
    description: '双人外用产品示意图'
  },

  // ==================== 远控穿戴 ====================

  panty_wearable: {
    type: 'image',
    value: '/assets/product-placeholder/panty_wearable.png',
    description: '隐形穿戴产品示意图'
  },

  insertable_remote: {
    type: 'image',
    value: '/assets/product-placeholder/insertable_remote.png',
    description: '入体远控产品示意图'
  },

  dual_wearable_remote: {
    type: 'image',
    value: '/assets/product-placeholder/dual_wearable_remote.png',
    description: '双人远控产品示意图'
  },

  // ==================== 护理与周边 ====================

  lube_care: {
    type: 'image',
    value: '/assets/product-placeholder/lube_care.png',
    description: '润滑护理产品示意图'
  },

  condom: {
    type: 'image',
    value: '/assets/product-placeholder/condom.png',
    description: '避孕套产品示意图'
  },

  lingerie: {
    type: 'image',
    value: '/assets/product-placeholder/lingerie.png',
    description: '内衣服饰示意图'
  },

  // ==================== BDSM 类 ====================

  bondage_restraint: {
    type: 'image',
    value: '/assets/product-placeholder/bondage_restraint.png',
    description: '束缚拘束产品示意图'
  },

  collar_leash: {
    type: 'image',
    value: '/assets/product-placeholder/collar_leash.png',
    description: '项圈牵引产品示意图'
  },

  impact_play: {
    type: 'image',
    value: '/assets/product-placeholder/impact_play.png',
    description: '拍打调教产品示意图'
  },

  nipple_play: {
    type: 'image',
    value: '/assets/product-placeholder/nipple_play.png',
    description: '乳夹刺激产品示意图'
  },

  // ==================== 男性向产品 ====================

  // 前列腺
  prostate_plug: {
    type: 'image',
    value: '/assets/product-placeholder/prostate_plug.png',
    description: '前列腺塞产品示意图'
  },
};

const SUBTYPE_PLACEHOLDER_ALIASES: Record<string, LibrarySubtypeCode> = {
  clitoral_suction: 'suction_pure',
  air_pulse_suction: 'suction_pure',
  rabbit_vibe: 'rabbit_dual',
  wand_vibe: 'wand_massager',
  g_spot_vibe: 'gspot_insertable',
  gspot_vibe: 'gspot_insertable',
  prostate_massager: 'prostate_plug',
  manual_stroker: 'manual_masturbator',
  powered_stroker: 'vibrating_masturbator',
  cock_ring: 'vibrating_cock_ring',
  condom_care: 'condom',
};

const TYPE_PLACEHOLDER_SUBTYPES: Record<string, LibrarySubtypeCode> = {
  suction: 'suction_pure',
  external_vibe: 'bullet_vibe',
  insertable: 'insertable_vibe',
  dual_stimulation: 'rabbit_dual',
  masturbator: 'vibrating_masturbator',
  prostate: 'prostate_plug',
  cock_ring: 'vibrating_cock_ring',
  couples: 'external_couples',
  wearable_remote: 'insertable_remote',
  care_accessory: 'lube_care',
  bdsm: 'fetish_accessory',
};

const PHYSICAL_FORM_PLACEHOLDER_SUBTYPES: Record<string, LibrarySubtypeCode> = {
  external: 'suction_pure',
  internal: 'insertable_vibe',
  composite: 'rabbit_dual',
};

function resolvePlaceholderSubtypeCode(
  subtypeCode: string | null | undefined,
): LibrarySubtypeCode | null {
  const normalizedSubtypeCode = String(subtypeCode || '').trim();
  if (!normalizedSubtypeCode) {
    return null;
  }

  return (
    SUBTYPE_PLACEHOLDER_ALIASES[normalizedSubtypeCode] ??
    (normalizedSubtypeCode as LibrarySubtypeCode)
  );
}

/**
 * 默认渐变占位符（当没有对应图片时使用）
 */
const DEFAULT_GRADIENT_PLACEHOLDERS: Record<string, ProductImagePlaceholder> = {
  default: {
    type: 'gradient',
    value: 'bg-gradient-to-br from-slate-900/90 via-slate-800/95 to-cyan-950/90',
    description: '默认渐变背景'
  },
  female: {
    type: 'gradient',
    value: 'bg-gradient-to-br from-pink-900/40 to-rose-900/40',
    description: '女性向渐变背景'
  },
  male: {
    type: 'gradient',
    value: 'bg-gradient-to-br from-slate-950/50 to-blue-900/30',
    description: '男性向渐变背景'
  },
  care: {
    type: 'gradient',
    value: 'bg-gradient-to-br from-violet-900/40 to-purple-900/40',
    description: '护理类渐变背景'
  },
};

const DEFAULT_GRADIENT_PLACEHOLDER_VALUES = new Set(
  Object.values(DEFAULT_GRADIENT_PLACEHOLDERS).map((placeholder) => placeholder.value),
);

/**
 * 获取产品图片占位符
 *
 * @param subtypeCode - 产品子类型代码
 * @param gender - 产品性别分类（用于选择默认渐变）
 * @returns 占位符配置对象
 */
export function getProductImagePlaceholder(
  subtypeCode: string | null | undefined,
  typeCodeOrGender?: string | null,
  gender?: 'female' | 'male' | 'unisex' | null,
  physicalForm?: string | null
): ProductImagePlaceholder {
  const typeCode =
    typeCodeOrGender === 'female' ||
    typeCodeOrGender === 'male' ||
    typeCodeOrGender === 'unisex'
      ? null
      : typeCodeOrGender;
  const resolvedGender =
    typeCodeOrGender === 'female' ||
    typeCodeOrGender === 'male' ||
    typeCodeOrGender === 'unisex'
      ? typeCodeOrGender
      : gender;
  const resolvedSubtypeCode =
    resolvePlaceholderSubtypeCode(subtypeCode) ??
    TYPE_PLACEHOLDER_SUBTYPES[String(typeCode || '').trim()] ??
    PHYSICAL_FORM_PLACEHOLDER_SUBTYPES[String(physicalForm || '').trim()] ??
    null;

  // 如果有对应的图片占位符，直接返回
  if (resolvedSubtypeCode && resolvedSubtypeCode in SUBTYPE_IMAGE_PLACEHOLDERS) {
    return SUBTYPE_IMAGE_PLACEHOLDERS[resolvedSubtypeCode]!;
  }

  // 护理类使用专门的渐变
  if (resolvedSubtypeCode === 'condom' || resolvedSubtypeCode?.includes('care')) {
    return DEFAULT_GRADIENT_PLACEHOLDERS.care;
  }

  // 根据性别选择默认渐变
  if (resolvedGender === 'female') {
    return DEFAULT_GRADIENT_PLACEHOLDERS.female;
  }

  if (resolvedGender === 'male') {
    return DEFAULT_GRADIENT_PLACEHOLDERS.male;
  }

  // 最终兜底
  return DEFAULT_GRADIENT_PLACEHOLDERS.default;
}

/**
 * 获取占位符值（用于 imagePlaceholder 字段）
 *
 * @param subtypeCode - 产品子类型代码
 * @param gender - 产品性别分类
 * @returns 图片URL或CSS类名字符串
 */
export function getProductImagePlaceholderValue(
  subtypeCode: string | null | undefined,
  typeCodeOrGender?: string | null,
  gender?: 'female' | 'male' | 'unisex' | null,
  physicalForm?: string | null
): string {
  return getProductImagePlaceholder(
    subtypeCode,
    typeCodeOrGender,
    gender,
    physicalForm,
  ).value;
}

/**
 * 判断占位符是否为图片类型
 */
export function isImagePlaceholder(placeholderValue: string): boolean {
  return (
    placeholderValue.startsWith('/assets/product-placeholder/') ||
    placeholderValue.startsWith('/assets/product-placeholders/')
  );
}

/**
 * 判断是否为历史默认渐变占位符。
 */
export function isDefaultGradientPlaceholder(placeholderValue: string): boolean {
  const trimmed = placeholderValue.trim();

  return (
    DEFAULT_GRADIENT_PLACEHOLDER_VALUES.has(trimmed) ||
    /^bg-gradient-to-[a-z]+(?:\s+|$)/.test(trimmed)
  );
}
