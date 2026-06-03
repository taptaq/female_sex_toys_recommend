#!/bin/bash

# 产品占位符图片批量处理脚本
# 使用方法：将5张图片下载到同一目录，然后运行此脚本

set -e

echo "========================================"
echo "产品占位符图片批量处理工具"
echo "========================================"
echo ""

# 配置
PROJECT_DIR="/Users/taptaq/Documents/Original Heart Road/project/female_toy_recommender"
TARGET_DIR="${PROJECT_DIR}/public/assets/product-placeholders"
TEMP_DIR="/tmp/product-placeholders-processing"

# 创建必要的目录
mkdir -p "$TARGET_DIR"
mkdir -p "$TEMP_DIR"

echo "步骤1：请将5张图片按照以下命名保存到临时目录："
echo "  ${TEMP_DIR}/"
echo ""
echo "文件命名规则："
echo "  1.png - 吮吸类设备（青紫色吮吸器）"
echo "  2.png - 入体震动棒（粉紫渐变）"
echo "  3.png - 收纳袋配件（紫色袋子）"
echo "  4.png - 魔杖按摩器（紫色魔杖）"
echo "  5.png - 内衣服饰（粉紫内衣）"
echo ""

# 检查 ImageMagick 是否安装
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo "❌ 未检测到 ImageMagick，正在安装..."
    if command -v brew &> /dev/null; then
        brew install imagemagick
    else
        echo "请先安装 Homebrew: https://brew.sh"
        exit 1
    fi
fi

# 使用 magick 或 convert 命令
if command -v magick &> /dev/null; then
    CONVERT_CMD="magick"
else
    CONVERT_CMD="convert"
fi

echo "按回车键继续，脚本将检查图片..."
read

# 检查源文件
cd "$TEMP_DIR"
if [ ! -f "1.png" ] || [ ! -f "2.png" ] || [ ! -f "3.png" ] || [ ! -f "4.png" ] || [ ! -f "5.png" ]; then
    echo "❌ 请先将5张图片（1.png 到 5.png）放入："
    echo "   ${TEMP_DIR}/"
    exit 1
fi

echo ""
echo "✅ 检测到所有图片文件"
echo ""
echo "步骤2：开始处理图片..."

# 处理图片的函数
process_image() {
    local input=$1
    local output=$2
    local name=$3

    echo "  处理中：${name}..."

    # 调整尺寸为 800x800，保持宽高比，居中裁剪
    $CONVERT_CMD "$input" \
        -resize 800x800^ \
        -gravity center \
        -extent 800x800 \
        -quality 90 \
        "$output"

    # 显示文件信息
    local size=$(du -h "$output" | cut -f1)
    echo "    ✓ 完成 (${size})"
}

# 处理每张图片
process_image "1.png" "${TARGET_DIR}/suction_pure.png" "吮吸类 (suction_pure)"
process_image "2.png" "${TARGET_DIR}/insertable_vibe.png" "入体震动 (insertable_vibe)"
process_image "3.png" "${TARGET_DIR}/lube_care.png" "护理配件 (lube_care)"
process_image "4.png" "${TARGET_DIR}/wand_massager.png" "魔杖按摩 (wand_massager)"
process_image "5.png" "${TARGET_DIR}/lingerie.png" "内衣服饰 (lingerie)"

echo ""
echo "步骤3：验证处理结果..."
echo ""

cd "$TARGET_DIR"
ls -lh *.png

echo ""
echo "========================================"
echo "✅ 图片处理完成！"
echo "========================================"
echo ""
echo "文件位置：${TARGET_DIR}"
echo ""
echo "下一步：运行构建验证"
echo "  cd \"${PROJECT_DIR}\""
echo "  npm run build"
echo ""
