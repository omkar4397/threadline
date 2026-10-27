import { describe, expect, it } from "vitest";
import { findCategoryByName, formatMoney, parseAmount, totalOf, totalsByCategory } from "./expenses";

describe("parseAmount", () => {
  it("accepts plain, grouped and symbol-prefixed amounts", () => {
    expect(parseAmount("1500")).toBe(1500);
    expect(parseAmount("1,25,000.50")).toBe(125000.5);
    expect(parseAmount("₹ 900")).toBe(900);
  });

  it("rejects zero, empty and over-precise amounts", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("10.555")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
  });
});

describe("totals", () => {
  it("adds amounts without floating-point drift", () => {
    expect(totalOf([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
  });

  it("groups by category, largest first, with unknown or missing categories as Uncategorised", () => {
    const categories = [
      { id: "fabric", name: "Fabric purchase" },
      { id: "print", name: "Printing & manufacturing" },
    ];
    const result = totalsByCategory(
      [
        { amount: 1000, category_id: "fabric" },
        { amount: 500, category_id: "fabric" },
        { amount: 2000, category_id: "print" },
        { amount: 50, category_id: null },
        { amount: 25, category_id: "deleted" },
      ],
      categories,
    );
    expect(result).toEqual([
      { key: "print", name: "Printing & manufacturing", total: 2000, count: 1 },
      { key: "fabric", name: "Fabric purchase", total: 1500, count: 2 },
      { key: "none", name: "Uncategorised", total: 75, count: 2 },
    ]);
  });
});

describe("findCategoryByName", () => {
  it("matches regardless of case and spaces", () => {
    const cats = [{ name: "Courier & shipping" }];
    expect(findCategoryByName(cats, "  courier & SHIPPING ")).toBe(cats[0]);
    expect(findCategoryByName(cats, "Embroidery")).toBeUndefined();
  });
});

describe("formatMoney", () => {
  it("drops decimals for whole amounts and always shows two otherwise", () => {
    expect(formatMoney(150000)).toBe("₹1,50,000");
    expect(formatMoney(66450.5)).toBe("₹66,450.50");
  });
});
