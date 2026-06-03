import { getProductImagePlaceholderValue } from "../lib/product-image-placeholders";

/**
 * 示例：在爬虫中使用新的占位符系统
 *
 * 当产品没有图片时，根据 subtypeCode 和 gender 自动选择合适的占位符
 */

// 示例1：吮吸类产品
const suctionProduct = {
  id: 'example-1',
  name: 'Satisfyer Pro 2',
  subtypeCode: 'suction_pure',
  gender: 'female',
  // 使用新的占位符系统
  imagePlaceholder: getProductImagePlaceholderValue('suction_pure', 'female'),
  // 结果：'/assets/product-placeholders/suction_pure.png'
};

// 示例2：入体震动产品
const insertableProduct = {
  id: 'example-2',
  name: 'G点按摩棒',
  subtypeCode: 'insertable_vibe',
  gender: 'female',
  imagePlaceholder: getProductImagePlaceholderValue('insertable_vibe', 'female'),
  // 结果：'/assets/product-placeholders/insertable_vibe.png'
};

// 示例3：魔杖按摩器
const wandProduct = {
  id: 'example-3',
  name: '魔杖按摩器',
  subtypeCode: 'wand_massager',
  gender: 'female',
  imagePlaceholder: getProductImagePlaceholderValue('wand_massager', 'female'),
  // 结果：'/assets/product-placeholders/wand_massager.png'
};

// 示例4：护理产品
const lubeProduct = {
  id: 'example-4',
  name: '润滑液',
  subtypeCode: 'lube_care',
  gender: 'unisex',
  imagePlaceholder: getProductImagePlaceholderValue('lube_care', 'unisex'),
  // 结果：'/assets/product-placeholders/lube_care.png'
};

// 示例5：内衣服饰
const lingerieProduct = {
  id: 'example-5',
  name: '情趣内衣',
  subtypeCode: 'lingerie',
  gender: 'female',
  imagePlaceholder: getProductImagePlaceholderValue('lingerie', 'female'),
  // 结果：'/assets/product-placeholders/lingerie.png'
};

// 示例6：没有对应图片的类型，使用渐变
const unknownProduct = {
  id: 'example-6',
  name: '未知产品',
  subtypeCode: 'bullet_vibe', // 这个类型还没有图片
  gender: 'female',
  imagePlaceholder: getProductImagePlaceholderValue('bullet_vibe', 'female'),
  // 结果：'bg-gradient-to-br from-pink-900/40 to-rose-900/40' (降级到渐变)
};

export const exampleProducts = [
  suctionProduct,
  insertableProduct,
  wandProduct,
  lubeProduct,
  lingerieProduct,
  unknownProduct,
];
