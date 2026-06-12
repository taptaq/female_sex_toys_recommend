import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMagicMotionFemaleRefreshPatch,
  extractMagicMotionCnFemaleListItems,
  shouldKeepMagicMotionFemaleSourceRow,
  shouldRunMagicMotionFemaleRefreshScript,
} from "./refresh-magicmotion-female-products-from-official.ts";

const BASE_ROW = {
  sourceUrl: "https://www.magicmotion.cn/p-vini.html",
  name: "魅动小V三代",
  safeDisplayName: "魅动小V三代",
  subtitle: "可远程控制的跳蛋",
  coverImage: "https://www.magicmotion.cn/images/index/pr_5.jpg",
  genderHint: "female" as const,
  categoryHints: ["toys", "womenclasses", "可远程控制的跳蛋", "magicmotion.cn"],
  listPosition: 5,
  rawDescription:
    "[基础信息]\n商品名: 魅动小V三代\n列表卖点: 可远程控制的跳蛋\n站内分类提示: toys | womenclasses\n性别提示: female\n价格: 官网未展示\n[详情正文]\n使用魅动APP实现远程互动控制和定制震动模式，智能可穿戴跳蛋。\n[来源链接] https://www.magicmotion.cn/p-vini.html",
  detailImageUrls: ["https://www.magicmotion.cn/images/index/pr_5.jpg"],
  specs: {
    price_source_status: "not_listed_on_magicmotion_cn",
  },
};

test("extractMagicMotionCnFemaleListItems parses women/shared product cards and filters male/accessory cards", () => {
  const html = `
    <div class="grid-item grid-sizer toys womenclasses">
      <a class="overlay-link" href="p-vini.html">
        <img src="images/index/pr_5.jpg" alt=""/>
        <span class="project-title">魅动小V三代</span>
        <span class="project-description">可远程控制的跳蛋</span>
      </a>
    </div>
    <div class="grid-item grid-sizer toys menclasses">
      <a class="overlay-link" href="p-solstice.html">
        <img src="images/index/pr_11.jpg" alt=""/>
        <span class="project-title">魅动墨月</span>
        <span class="project-description">前列腺智能app按摩器</span>
      </a>
    </div>
    <div class="grid-item grid-sizer toys menclasses womenclasses">
      <a class="overlay-link" href="p-equinox.html">
        <img src="images/index/pr_12.jpg" alt=""/>
        <span class="project-title">魅动黑客</span>
        <span class="project-description">后庭智能app控制吸盘按摩器</span>
      </a>
    </div>
    <div class="grid-item grid-sizer accessories">
      <a class="overlay-link" href="p-lube.html">
        <img src="images/index/pr_14.jpg" alt=""/>
        <span class="project-title">魅动润滑液</span>
        <span class="project-description">维他命E，健康护肤</span>
      </a>
    </div>
  `;

  assert.deepEqual(extractMagicMotionCnFemaleListItems(html), [
    {
      sourceUrl: "https://www.magicmotion.cn/p-vini.html",
      name: "魅动小V三代",
      subtitle: "可远程控制的跳蛋",
      coverImage: "https://www.magicmotion.cn/images/index/pr_5.jpg",
      genderHint: "female",
      categoryHints: ["grid-item", "grid-sizer", "toys", "womenclasses", "可远程控制的跳蛋", "magicmotion.cn"],
      listPosition: 1,
    },
    {
      sourceUrl: "https://www.magicmotion.cn/p-equinox.html",
      name: "魅动黑客",
      subtitle: "后庭智能app控制吸盘按摩器",
      coverImage: "https://www.magicmotion.cn/images/index/pr_12.jpg",
      genderHint: "unisex",
      categoryHints: ["grid-item", "grid-sizer", "toys", "menclasses", "womenclasses", "后庭智能app控制吸盘按摩器", "magicmotion.cn"],
      listPosition: 3,
    },
  ]);
});

test("shouldKeepMagicMotionFemaleSourceRow keeps female/shared rows and rejects male-only/accessory rows", () => {
  assert.equal(shouldKeepMagicMotionFemaleSourceRow(BASE_ROW), true);
  assert.equal(
    shouldKeepMagicMotionFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.magicmotion.cn/p-equinox.html",
      name: "魅动黑客",
      subtitle: "后庭智能app控制吸盘按摩器",
      genderHint: "unisex",
      categoryHints: ["toys", "menclasses", "womenclasses"],
    }),
    true,
  );
  assert.equal(
    shouldKeepMagicMotionFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.magicmotion.cn/p-solstice.html",
      name: "魅动墨月",
      subtitle: "前列腺智能app按摩器",
      categoryHints: ["toys", "menclasses"],
    }),
    false,
  );
  assert.equal(
    shouldKeepMagicMotionFemaleSourceRow({
      ...BASE_ROW,
      sourceUrl: "https://www.magicmotion.cn/p-lube.html",
      name: "魅动润滑液",
      subtitle: "维他命E，健康护肤",
      categoryHints: ["accessories"],
    }),
    false,
  );
});

test("buildMagicMotionFemaleRefreshPatch fills all female_recommender_toys fields for Vini", () => {
  const patch = buildMagicMotionFemaleRefreshPatch(BASE_ROW);

  assert.equal(patch.name, "魅动小V三代");
  assert.equal(patch.safeDisplayName, "魅动小V三代");
  assert.equal(patch.price, 1);
  assert.equal(patch.maxDb, 40);
  assert.equal(patch.waterproof, 7);
  assert.equal(patch.appearance, "high_disguise");
  assert.equal(patch.physicalForm, "internal");
  assert.equal(patch.motorType, "gentle");
  assert.equal(patch.gender, "female");
  assert.equal(patch.brand, "Magic Motion");
  assert.equal(patch.material, "亲肤硅胶");
  assert.equal(patch.link, BASE_ROW.sourceUrl);
  assert.equal(patch.imageUrl, BASE_ROW.coverImage);
  assert.equal(patch.rawDescription, BASE_ROW.rawDescription);
  assert.equal(patch.typeCode, "wearable_remote");
  assert.equal(patch.subtypeCode, "insertable_remote");
  assert.equal(patch.productTags.includes("远程遥控"), true);
  assert.equal(patch.recommendationFeatures.featureVersion, "recommendation-product-features-v1");
  assert.ok(
    Array.isArray(patch.recommendationFeatures.evidence) &&
      patch.recommendationFeatures.evidence.length > 0,
  );
});

test("buildMagicMotionFemaleRefreshPatch classifies Kegel, Awaken, Flamingo and Equinox", () => {
  const kegel = buildMagicMotionFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.magicmotion.cn/p-kegel-master-gen2.html",
    name: "凯格尔大师二代",
    subtitle: "智能凯格尔训练器- 进阶版",
    rawDescription: "凯格尔训练器，跟踪训练进度，也可享受凯格尔球带来的愉悦快感。",
  });
  const awaken = buildMagicMotionFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.magicmotion.cn/p-awaken.html",
    name: "魅动幻唇",
    subtitle: "柔软而强劲的口红式便携智能按摩器",
    rawDescription: "口红式便携智能按摩器，外部刺激。",
  });
  const flamingo = buildMagicMotionFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.magicmotion.cn/p-flamingo.html",
    name: "魅动火烈鸟",
    subtitle: "红点设计奖得主",
    rawDescription: "APP远程互动控制，适合情侣和追求快感的朋友。",
  });
  const equinox = buildMagicMotionFemaleRefreshPatch({
    ...BASE_ROW,
    sourceUrl: "https://www.magicmotion.cn/p-equinox.html",
    name: "魅动黑客",
    subtitle: "后庭智能app控制吸盘按摩器",
    rawDescription: "后庭智能APP控制吸盘按摩器。",
    genderHint: "unisex",
    categoryHints: ["toys", "menclasses", "womenclasses"],
  });

  assert.equal(kegel.typeCode, "insertable");
  assert.equal(kegel.subtypeCode, "gspot_insertable");
  assert.equal(awaken.typeCode, "external_vibe");
  assert.equal(awaken.subtypeCode, "bullet_vibe");
  assert.equal(flamingo.typeCode, "couples");
  assert.equal(flamingo.subtypeCode, "external_couples");
  assert.equal(equinox.typeCode, "wearable_remote");
  assert.equal(equinox.subtypeCode, "insertable_remote");
  assert.equal(equinox.gender, "unisex");
});

test("shouldRunMagicMotionFemaleRefreshScript only matches direct execution", () => {
  assert.equal(
    shouldRunMagicMotionFemaleRefreshScript(
      "file:///tmp/refresh-magicmotion-female-products-from-official.ts",
      "/tmp/refresh-magicmotion-female-products-from-official.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunMagicMotionFemaleRefreshScript(
      "file:///tmp/refresh-magicmotion-female-products-from-official.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(
    shouldRunMagicMotionFemaleRefreshScript("file:///tmp/refresh-magicmotion-female-products-from-official.ts"),
    false,
  );
});
