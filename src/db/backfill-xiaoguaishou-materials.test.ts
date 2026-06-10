import assert from "node:assert/strict";
import test from "node:test";

import {
  inferXiaoguaishouMaterialFromRow,
  shouldRunXiaoguaishouMaterialBackfillScript,
} from "./backfill-xiaoguaishou-materials.ts";

test("inferXiaoguaishouMaterialFromRow prefers structured detail material over noisy Tmall 参数信息", () => {
  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "小怪兽派对魔吻女孩子爱玩吮吸玩具",
      raw_description:
        "[参数信息]\n材质: 不包含润滑液 是否含润滑液 电动（电池电源） 控制类型\n\n[图文提取]\n2. 内部构造/材质: LSR（液态硅胶），仿生舔舐结构",
      current_material: "硅胶",
    }),
    "液态硅胶",
  );
});

test("inferXiaoguaishouMaterialFromRow keeps meaningful silicone qualifiers from raw_description", () => {
  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "小怪兽嘬嘬zozo双口吮吸玩具",
      raw_description:
        "[图文提取]\n2. 内部构造/材质: 母婴级硅胶\n6. 技术卖点: APP远程遥控、母婴级硅胶材质",
      current_material: "硅胶",
    }),
    "母婴级硅胶",
  );

  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "小怪兽派对懈逅DOI辅助边do边吸",
      raw_description:
        "[参数信息]\n材质: 硅胶\n\n[图文提取]\n2. 内部构造/材质: 食品级液体硅胶\n6. 技术卖点: 食品级液体硅胶柔软亲肤",
      current_material: "硅胶",
    }),
    "食品级液体硅胶",
  );
});

test("inferXiaoguaishouMaterialFromRow combines antibacterial material with silicone when both are explicit", () => {
  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "小怪兽派对白夜魔吻抑菌HPV吮吸",
      raw_description:
        "[图文提取]\n2. 内部构造/材质: 15° LSR（液态硅胶）、Saniconcentrate™抗菌材料",
      current_material: "硅胶",
    }),
    "液态硅胶/Saniconcentrate抗菌材料",
  );

  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "小怪兽派对魔炮机智能远程遥控",
      raw_description:
        "[参数信息]\n材质: 硅胶\n\n[图文提取]\n2. 内部构造/材质: Saniconcentrate™抗菌材料，亲肤硅胶",
      current_material: "硅胶",
    }),
    "亲肤硅胶/Saniconcentrate抗菌材料",
  );
});

test("inferXiaoguaishouMaterialFromRow treats standalone antibacterial material as a supplement to current silicone base", () => {
  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "小怪兽派对2代白夜魔蛋女孩子爱玩抑菌",
      raw_description:
        "[参数信息]\n材质: 遥控跳蛋\n\n[图文提取]\n2. 内部构造/材质: 含Saniconcentrate™抗菌材料，表面形成微电场能量屏蔽层",
      current_material: "亲肤硅胶",
    }),
    "亲肤硅胶/Saniconcentrate抗菌材料",
  );
});

test("inferXiaoguaishouMaterialFromRow handles care goods and rejects invalid material lines", () => {
  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "【买1送1】小怪兽元気肽人体润滑液剂",
      raw_description: "[参数信息]\n材质: 硅胶\n\n[图文提取]\n2. 内部构造/材质: 未提及",
      current_material: "硅胶",
    }),
    "水基配方",
  );

  assert.equal(
    inferXiaoguaishouMaterialFromRow({
      name: "小怪兽派对白夜魔炮机抑菌HPV",
      raw_description:
        "[参数信息]\n材质: 否 是否含润滑液 电动（电池电源） 控制类型\n\n[图文提取]\n2. 内部构造/材质: 材质未明确标注；表面采用楞线/螺旋纹理构造；配可拆卸式吮吸头组件",
      current_material: "亲肤硅胶",
    }),
    "亲肤硅胶",
  );
});

test("shouldRunXiaoguaishouMaterialBackfillScript only matches direct execution", () => {
  assert.equal(
    shouldRunXiaoguaishouMaterialBackfillScript(
      "file:///tmp/backfill-xiaoguaishou-materials.ts",
      "/tmp/backfill-xiaoguaishou-materials.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunXiaoguaishouMaterialBackfillScript(
      "file:///tmp/backfill-xiaoguaishou-materials.ts",
      "/tmp/other.ts",
    ),
    false,
  );
  assert.equal(shouldRunXiaoguaishouMaterialBackfillScript("file:///tmp/backfill-xiaoguaishou-materials.ts"), false);
});
