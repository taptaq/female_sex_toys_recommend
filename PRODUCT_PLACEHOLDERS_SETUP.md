# 产品占位符图片处理指南

## 图片文件准备

请将以下5张图片按照规范处理后放入项目目录：

### 目标目录
```
public/assets/product-placeholders/
```

### 图片规格要求

**统一尺寸：800x800px (1:1 比例)**

**格式：PNG（支持透明背景）或 JPG**

**文件大小：建议 < 200KB**

### 图片命名和对应关系

| 原图描述 | 文件名 | Subtype Code | 说明 |
|---------|--------|--------------|------|
| 第1张 - 吮吸类设备 | `suction_pure.png` | suction_pure | 青紫色吮吸器 |
| 第2张 - 入体震动棒 | `insertable_vibe.png` | insertable_vibe | 粉紫渐变震动棒 |
| 第3张 - 收纳袋配件 | `lube_care.png` | lube_care | 紫色收纳袋和配件 |
| 第4张 - 魔杖按摩器 | `wand_massager.png` | wand_massager | 紫色魔杖按摩器 |
| 第5张 - 内衣服饰 | `lingerie.png` | lingerie | 粉紫色内衣 |

## 处理步骤

### 方法1：使用 ImageMagick (推荐)

```bash
# 安装 ImageMagick (如果未安装)
brew install imagemagick

# 批量处理图片到 800x800，保持宽高比，居中裁剪
cd /path/to/原始图片目录

# 处理第1张
magick 第1张原图.png -resize 800x800^ -gravity center -extent 800x800 suction_pure.png

# 处理第2张
magick 第2张原图.png -resize 800x800^ -gravity center -extent 800x800 insertable_vibe.png

# 处理第3张
magick 第3张原图.png -resize 800x800^ -gravity center -extent 800x800 lube_care.png

# 处理第4张
magick 第4张原图.png -resize 800x800^ -gravity center -extent 800x800 wand_massager.png

# 处理第5张
magick 第5张原图.png -resize 800x800^ -gravity center -extent 800x800 lingerie.png

# 移动到项目目录
mv *.png /Users/taptaq/Documents/Original\ Heart\ Road/project/female_toy_recommender/public/assets/product-placeholders/
```

### 方法2：使用在线工具

1. 访问 https://www.iloveimg.com/resize-image 或 https://squoosh.app/
2. 上传图片
3. 设置尺寸为 800x800px
4. 选择"裁剪"或"填充"模式（保持主体居中）
5. 下载处理后的图片
6. 按照上述文件名重命名
7. 放入 `public/assets/product-placeholders/` 目录

### 方法3：使用 macOS 预览

1. 在预览中打开图片
2. 工具 → 调整大小
3. 勾选"缩放比例相称"
4. 将较长边设为 800px
5. 使用裁剪工具裁剪为 800x800
6. 导出为 PNG

## 验证

处理完成后，目录结构应该是：

```
public/assets/product-placeholders/
├── suction_pure.png          (800x800px)
├── insertable_vibe.png       (800x800px)
├── lube_care.png             (800x800px)
├── wand_massager.png         (800x800px)
└── lingerie.png              (800x800px)
```

验证命令：
```bash
cd public/assets/product-placeholders
file *.png
ls -lh *.png
```

## 下一步

图片准备完成后，运行以下命令验证：

```bash
npm run build
```

如果构建成功，说明图片已正确应用！
