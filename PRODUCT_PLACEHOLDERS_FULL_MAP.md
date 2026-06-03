# 产品占位符图片完整映射表

## 概述

已为 **23 个 subtype_code** 配置了占位符系统。每张图片对应一个产品子类型。

---

## 📋 完整映射列表

### 女性向产品

#### 吮吸类 (Suction)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `suction_pure` | suction_pure.png | 纯吮吸 | ⏳ 待上传 |
| `suction_dual` | suction_dual.png | 吮吸双刺激 | ⏳ 待上传 |

**对应图片：** 第1张（青紫色吮吸器）

---

#### 外部震动 (External Vibe)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `bullet_vibe` | bullet_vibe.png | 跳蛋/子弹 | ⏳ 待上传 |
| `wand_massager` | wand_massager.png | 魔杖按摩 | ⏳ 待上传 |

**对应图片：** 
- 第4张（紫色魔杖按摩器）→ wand_massager
- 第2张（紫色跳蛋形状）→ bullet_vibe

---

#### 入体探索 (Insertable)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `gspot_insertable` | gspot_insertable.png | G点探索 | ⏳ 待上传 |
| `insertable_vibe` | insertable_vibe.png | 入体震动 | ⏳ 待上传 |

**对应图片：** 第2张（粉紫渐变震动棒）

---

#### 双刺激 (Dual Stimulation)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `rabbit_dual` | rabbit_dual.png | 兔耳双刺激 | ⏳ 待上传 |
| `multi_head_dual` | multi_head_dual.png | 多头双刺激 | ⏳ 待上传 |

**对应图片：** 兔耳形状的双刺激产品

---

### 双人互动 (Couples)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `insertable_couples` | insertable_couples.png | 双人入体 | ⏳ 待上传 |
| `external_couples` | external_couples.png | 双人外用 | ⏳ 待上传 |

**对应图片：** 远控C型或U型产品

---

### 远控穿戴 (Wearable Remote)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `panty_wearable` | panty_wearable.png | 隐形穿戴 | ⏳ 待上传 |
| `insertable_remote` | insertable_remote.png | 入体远控 | ⏳ 待上传 |
| `dual_wearable_remote` | dual_wearable_remote.png | 双人远控 | ⏳ 待上传 |

**对应图片：** 远控穿戴类产品

---

### 护理与周边 (Care & Accessory)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `lube_care` | lube_care.png | 润滑护理 | ⏳ 待上传 |
| `condom` | condom.png | 避孕套 | ⏳ 待上传 |
| `lingerie` | lingerie.png | 内衣服饰 | ⏳ 待上传 |

**对应图片：**
- 第3张（紫色收纳袋和配件）→ lube_care
- 第5张（粉紫色内衣）→ lingerie
- 润滑液瓶装图 → condom (可复用)

---

### BDSM 类

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `bondage_restraint` | bondage_restraint.png | 束缚拘束 | ⏳ 待上传 |
| `collar_leash` | collar_leash.png | 项圈牵引 | ⏳ 待上传 |
| `impact_play` | impact_play.png | 拍打调教 | ⏳ 待上传 |
| `nipple_play` | nipple_play.png | 乳夹刺激 | ⏳ 待上传 |

**对应图片：**
- 第6张（手铐束缚类）→ bondage_restraint
- 第7张（项圈牵引）→ collar_leash
- 粉色拍板 → impact_play
- 乳夹 → nipple_play

---

### 男性向产品

#### 前列腺 (Prostate)

| Subtype Code | 文件名 | 中文名称 | 状态 |
|-------------|--------|---------|------|
| `prostate_plug` | prostate_plug.png | 前列腺塞 | ⏳ 待上传 |

**对应图片：** 前列腺按摩器

---

## 📦 图片上传指南

### 步骤1：准备图片文件

你需要将对话中的图片按照以下命名保存：

```
bondage_restraint.png
bullet_vibe.png
collar_leash.png
condom.png
dual_wearable_remote.png
external_couples.png
gspot_insertable.png
impact_play.png
insertable_couples.png
insertable_remote.png
insertable_vibe.png
lingerie.png
lube_care.png
multi_head_dual.png
nipple_play.png
panty_wearable.png
prostate_plug.png
rabbit_dual.png
suction_dual.png
suction_pure.png
wand_massager.png
```

### 步骤2：图片规格

- **尺寸：** 800x800px (1:1 比例)
- **格式：** PNG（推荐，支持透明）或 JPG
- **大小：** < 200KB per file
- **背景：** 透明或浅色

### 步骤3：上传路径

将所有处理好的图片放入：
```
/Users/taptaq/Documents/Original Heart Road/project/female_toy_recommender/public/assets/product-placeholders/
```

### 步骤4：验证

```bash
cd "/Users/taptaq/Documents/Original Heart Road/project/female_toy_recommender"

# 检查文件数量（应该是 21 个文件）
ls public/assets/product-placeholders/*.png | wc -l

# 检查文件大小
ls -lh public/assets/product-placeholders/

# 验证构建
npm run build
```

---

## 🎯 使用示例

### 在爬虫中使用

```typescript
import { getProductImagePlaceholderValue } from "../lib/product-image-placeholders";

const product = {
  id: 'xxx',
  name: 'Satisfyer Pro 2',
  subtypeCode: 'suction_pure',
  gender: 'female',
  // 自动获取占位符
  imagePlaceholder: getProductImagePlaceholderValue('suction_pure', 'female'),
  // 结果：'/assets/product-placeholders/suction_pure.png'
};
```

### 智能降级

如果某个 subtype_code 还没有对应的图片，系统会自动降级到渐变背景：

```typescript
// 假设 manual_masturbator 还没有图片
getProductImagePlaceholderValue('manual_masturbator', 'male')
// 结果：'bg-gradient-to-br from-slate-950/50 to-blue-900/30'
```

---

## 📊 当前进度

- ✅ **系统已完成：** 23 个类型配置完成
- ⏳ **图片待上传：** 21 张图片
- ✅ **构建状态：** 成功
- ✅ **组件更新：** 已支持本地图片

---

## 🚀 后续扩展

随时可以添加更多类型：

```typescript
// 在 product-image-placeholders.ts 中添加
new_subtype: {
  type: 'image',
  value: '/assets/product-placeholders/new_subtype.png',
  description: '新类型示意图'
},
```

然后将对应图片放入 `public/assets/product-placeholders/` 即可。

---

## ✨ 系统优势

1. **类型安全** - TypeScript 完全类型化
2. **智能降级** - 图片 → 渐变，永不破图
3. **易于维护** - 集中配置，一处修改
4. **性能优化** - 本地图片，统一尺寸
5. **可扩展** - 随时添加新类型

---

**构建状态：✅ 成功**

准备好图片后，按照上述步骤上传即可！
