import assert from "node:assert/strict";
import test from "node:test";

type SelectContaminantToyIds = (rows: Array<{
  id: string;
  gender: string | null;
  physical_form: string | null;
  name: string;
  raw_description: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
}>) => string[];

test("selectContaminantToyIds selects adapter, connector, accessory, and machine rows but excludes clean and care products", async () => {
  const loadModule = new Function(
    "specifier",
    "return import(specifier);",
  ) as (specifier: string) => Promise<unknown>;
  let purgeModule: {
    selectContaminantToyIds?: SelectContaminantToyIds;
  } = {};

  try {
    purgeModule = (await loadModule("./purge-recommender-toy-contaminants.ts")) as {
      selectContaminantToyIds?: SelectContaminantToyIds;
    };
  } catch (error) {
    const maybeError = error as { code?: string; message?: string };
    const isMissingTargetModule =
      maybeError?.code === "ERR_MODULE_NOT_FOUND" &&
      maybeError?.message?.includes("purge-recommender-toy-contaminants.ts");

    if (!isMissingTargetModule) {
      throw error;
    }
  }

  assert.equal(typeof purgeModule.selectContaminantToyIds, "function");
  assert.deepEqual(
    purgeModule.selectContaminantToyIds?.([
      {
        id: "toy-adapter",
        gender: "unisex",
        physical_form: "external",
        name: "USB Bluetooth Adapter",
        raw_description: "用于连接远控穿戴设备与 app 的蓝牙适配器",
        product_tags: ["远控", "蓝牙", "适配器"],
        product_raw_description: null,
      },
      {
        id: "toy-machine",
        gender: "female",
        physical_form: "external",
        name: "LovenseSex Machine",
        raw_description: null,
        product_tags: null,
        product_raw_description: null,
      },
      {
        id: "toy-connector",
        gender: "unisex",
        physical_form: "external",
        name: "Magnetic Connector",
        raw_description: "用于连接主机与替换头的磁吸连接器配件",
        product_tags: ["连接器", "配件", "replacement"],
        product_raw_description: null,
      },
      {
        id: "toy-accessory",
        gender: "male",
        physical_form: "external",
        name: "TENGA FLIP 0(ZERO)异次元配件",
        raw_description: null,
        product_tags: null,
        product_raw_description: null,
      },
      {
        id: "toy-clean",
        gender: "female",
        physical_form: "external",
        name: "Womanizer Liberty",
        raw_description: "气脉冲吸感，外部刺激设备",
        product_tags: [],
        product_raw_description: null,
      },
      {
        id: "toy-machine-generic",
        gender: "female",
        physical_form: "external",
        name: "Spinel",
        raw_description: "应用程序控制、多附件抽插、震动与加热假阳具机器",
        product_tags: ["APP控制", "远程遥控"],
        product_raw_description: null,
      },
      {
        id: "toy-lube",
        gender: "male",
        physical_form: "external",
        name: "Water-Based Lubricant 100ml",
        raw_description: "人体润滑液，水基配方，亲肤易清洗",
        product_tags: ["润滑液", "水基"],
        product_raw_description: null,
      },
      {
        id: "toy-remote-legit",
        gender: "unisex",
        physical_form: "external",
        name: "Couple Link",
        raw_description: "情侣双人共玩，远控穿戴设计",
        product_tags: ["情侣", "双人", "远控", "穿戴"],
        product_raw_description: null,
      },
    ]),
    ["toy-adapter", "toy-machine", "toy-connector", "toy-accessory", "toy-machine-generic"],
  );
});
