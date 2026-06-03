import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalizeTmallItemUrl,
  matchTargetsToShopItems,
  normalizeProductTitle,
  titleMatchScore,
  type ShopItem,
  type TargetToy,
} from "./rematch-iroha-female-links-from-tmall-category.ts";

test("normalizes noisy iroha titles for matching", () => {
  assert.equal(normalizeProductTitle("iroha日本 小雪人 女性TENGA 女 强震动解压玩具"), "小雪人女性女强震动解压玩具");
});

test("scores close product titles higher than unrelated titles", () => {
  assert.ok(titleMatchScore("stick口红式", "iroha日本 口红 玩具女用品 具按摩棒静音TENGA") > 0.42);
  assert.ok(titleMatchScore("stick口红式", "iroha日本 调 女用品小雪人夫妻震动玩具TENGA进口强震静音") < 0.42);
});

test("matches targets to canonical Tmall item links", () => {
  const targets: TargetToy[] = [
    {
      toy_id: "toy-1",
      original_id: "product-1",
      name: "stick口红式",
      brand: "iroha",
      current_link: "https://detail.tmall.com/item.htm?id=old",
    },
  ];
  const shopItems: ShopItem[] = [
    {
      itemId: "593755653154",
      title: "iroha日本 口红 玩具女用品 具按摩棒静音TENGA",
      href: "https://detail.tmall.com/item.htm?spm=x&id=593755653154&pisk=y",
    },
  ];

  const [match] = matchTargetsToShopItems(targets, shopItems);

  assert.equal(match.next_link, "https://detail.tmall.com/item.htm?id=593755653154");
});

test("canonicalizeTmallItemUrl keeps only item id", () => {
  assert.equal(
    canonicalizeTmallItemUrl("//detail.tmall.com/item.htm?spm=x&id=123&pisk=y"),
    "https://detail.tmall.com/item.htm?id=123",
  );
});
