import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompetitorCreateData,
  buildCompetitorUpdateData,
  findCompetitorRegistryConfig,
} from "./competitor-registry.ts";

test("findCompetitorRegistryConfig resolves known aliases", () => {
  assert.equal(findCompetitorRegistryConfig("kumocoom")?.canonicalName, "KUMOCOOM");
  assert.equal(findCompetitorRegistryConfig("hellonancy")?.canonicalName, "Hello Nancy");
  assert.equal(findCompetitorRegistryConfig("Kiiroo")?.canonicalName, "Kiiroo");
});

test("buildCompetitorCreateData exposes domain and metadata fields", () => {
  const config = findCompetitorRegistryConfig("Magic Motion");
  assert.ok(config);
  assert.deepEqual(buildCompetitorCreateData(config!), {
    name: "Magic Motion",
    domain: "us.magicmotion.shop",
    country: "中国",
    founded_date: "2016",
    description:
      "Magic Motion 是智能情趣科技品牌，覆盖女性向、穿戴式与远程互动类玩具产品。",
    focus: "Female",
    philosophy: [
      "以智能互联和可穿戴体验切入亲密健康场景。",
      "强调女性友好、隐私设计和稳定的 App 连接能力。",
      "通过更低门槛的智能体验，把情趣科技带入日常使用场景。",
    ],
    major_user_group_profile:
      "【核心人口】25-40 岁女性为主，兼顾异地情侣和科技偏好用户。\n【心理特征】追求科技感、易用性和私密体验，乐于尝试 App 控制与远程互动功能。\n【核心痛点】希望获得更稳定的远程控制、更轻松的入门体验，以及兼顾静音与便携的产品。",
    is_domestic: true,
  });
});

test("buildCompetitorUpdateData only fills missing metadata", () => {
  const config = findCompetitorRegistryConfig("Arcwave");
  assert.ok(config);

  assert.deepEqual(
    buildCompetitorUpdateData(
      {
        id: "competitor-1",
        name: "Arcwave",
        domain: null,
        country: null,
        founded_date: null,
        description: null,
        is_domestic: null,
        focus: null,
        philosophy: null,
        major_user_group_profile: null,
      },
      config!,
    ),
    {
      domain: "www.arcwave.com",
      country: "德国",
      founded_date: "2020",
      description: "Arcwave 是男性向高端情趣科技品牌，聚焦男士快感设备与空气脉冲体验。",
      focus: "Male",
      philosophy: [
        "将男性快感设备做成技术型、高端化、设计导向的消费电子产品。",
        "以空气脉冲、CleanTech 硅胶与智能静音等卖点区分传统男用设备。",
        "强调清洁、收纳和长期使用体验，而不只是即时刺激。",
      ],
      major_user_group_profile:
        "【核心人口】25-45 岁、中高消费能力的男性用户为主，也覆盖为伴侣选购的情侣用户。\n【心理特征】偏好科技感、结构创新与高端外观，不希望产品显得廉价或羞耻化。\n【核心痛点】传统男用设备同质化严重，清洁麻烦、材料廉价、品牌调性不足。",
      is_domestic: false,
    },
  );
});
