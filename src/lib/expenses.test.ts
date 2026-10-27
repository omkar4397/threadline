import { describe, expect, it } from "vitest";
import {
  filterExpenses,
  findCategoryByName,
  formatMoney,
  monthlyTotals,
  parseAmount,
  payeeKey,
  toCsv,
  totalOf,
  totalsBy,
  totalsByCategory,
} from "./expenses";

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


const e = (amount: number, spent_on: string, extra: Partial<{ category_id: string | null; vendor_id: string | null; designer_id: string | null; project_id: string }> = {}) => ({
  amount,
  spent_on,
  category_id: null,
  vendor_id: null,
  designer_id: null,
  project_id: "p1",
  ...extra,
});

describe("filterExpenses", () => {
  const cats = [{ id: "fabric" }];
  const list = [
    e(100, "2026-09-30", { category_id: "fabric", vendor_id: "v1" }),
    e(200, "2026-10-05", { category_id: "fabric", designer_id: "d1", project_id: "p2" }),
    e(300, "2026-10-20", { category_id: "gone" }),
  ];

  it("filters by inclusive date range", () => {
    expect(filterExpenses(list, { from: "2026-10-01", to: "2026-10-20" }, cats).map((x) => x.amount)).toEqual([200, 300]);
  });

  it("filters by category, treating deleted categories as uncategorised", () => {
    expect(filterExpenses(list, { category: "fabric" }, cats).map((x) => x.amount)).toEqual([100, 200]);
    expect(filterExpenses(list, { category: "none" }, cats).map((x) => x.amount)).toEqual([300]);
  });

  it("filters by payee and project", () => {
    expect(filterExpenses(list, { payee: "d:d1" }, cats).map((x) => x.amount)).toEqual([200]);
    expect(filterExpenses(list, { payee: "none" }, cats).map((x) => x.amount)).toEqual([300]);
    expect(filterExpenses(list, { projectIds: ["p2"] }, cats).map((x) => x.amount)).toEqual([200]);
  });
});

describe("grouping", () => {
  it("keys payees by vendor, designer or none", () => {
    expect(payeeKey({ vendor_id: "v", designer_id: null })).toBe("v:v");
    expect(payeeKey({ vendor_id: null, designer_id: "d" })).toBe("d:d");
    expect(payeeKey({ vendor_id: null, designer_id: null })).toBe("none");
  });

  it("totals by any key, largest first", () => {
    expect(totalsBy([e(5, "2026-01-01"), e(10, "2026-01-02", { project_id: "p2" }), e(1, "2026-01-03")], (x) => x.project_id)).toEqual([
      { key: "p2", total: 10, count: 1 },
      { key: "p1", total: 6, count: 2 },
    ]);
  });

  it("fills empty months across a year boundary", () => {
    expect(monthlyTotals([e(10, "2026-11-03"), e(5, "2027-01-20")], "2026-11", "2027-01")).toEqual([
      { month: "2026-11", total: 10, count: 1 },
      { month: "2026-12", total: 0, count: 0 },
      { month: "2027-01", total: 5, count: 1 },
    ]);
  });
});

describe("toCsv", () => {
  it("quotes cells and neutralises spreadsheet formulas", () => {
    expect(toCsv([["Name", "Amount"], ['=HYPERLINK("x")', 12.5], ['Say "hi"', -3]])).toBe(
      '"Name","Amount"\r\n"\'=HYPERLINK(""x"")","12.5"\r\n"Say ""hi""","-3"',
    );
  });
});
