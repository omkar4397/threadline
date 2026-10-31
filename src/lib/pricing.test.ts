import { describe, expect, it } from "vitest";
import { convert, currencyOptions, formatCurrency, parseCurrencyApi, parseExchangeRateApi, PINNED_CURRENCIES } from "./fx";
import { foreignCurrencies, formatQuantity, lineFigures, pricingSummary } from "./pricing";

const line = (quantity: number, unit: "metre" | "piece" | "design" | "flat", vendor: number, client: number, currency = "INR") => ({
  quantity,
  unit,
  vendor_rate: vendor,
  client_rate: client,
  client_currency: currency,
});

describe("rate parsing", () => {
  it("inverts ExchangeRate-API rates (per INR) into INR per unit", () => {
    const rates = parseExchangeRateApi({ result: "success", base_code: "INR", rates: { INR: 1, USD: 0.0119, SAR: 0.04464, BAD: 0 } });
    expect(rates?.USD).toBeCloseTo(84.03, 2);
    expect(rates?.SAR).toBeCloseTo(22.4, 2);
    expect(rates).not.toHaveProperty("INR");
    expect(rates).not.toHaveProperty("BAD");
  });

  it("rejects error responses and the wrong base currency", () => {
    expect(parseExchangeRateApi({ result: "error", "error-type": "unsupported-code" })).toBeNull();
    expect(parseExchangeRateApi({ result: "success", base_code: "USD", rates: { INR: 84 } })).toBeNull();
    expect(parseExchangeRateApi("nope")).toBeNull();
  });

  it("reads the backup source, keeping only three-letter codes", () => {
    const rates = parseCurrencyApi({ date: "2026-10-31", inr: { usd: 0.0119, sar: 0.04464, "1inch": 0.03, btc: 0.0000001 } });
    expect(Object.keys(rates ?? {}).sort()).toEqual(["BTC", "SAR", "USD"]);
    expect(rates?.USD).toBeCloseTo(84.03, 2);
  });
});

describe("currencies", () => {
  it("lists pinned currencies first, then the rest alphabetically, without duplicates", () => {
    const options = currencyOptions(["ZAR", "USD", "CAD", "SAR", "xx"]);
    expect(options.slice(0, PINNED_CURRENCIES.length)).toEqual(PINNED_CURRENCIES);
    expect(options.slice(PINNED_CURRENCIES.length)).toEqual(["CAD", "ZAR"]);
  });

  it("converts through INR in both directions", () => {
    const rates = { SAR: 22.4, USD: 84 };
    expect(convert(100, "SAR", "INR", rates)).toBeCloseTo(2240);
    expect(convert(2240, "INR", "SAR", rates)).toBeCloseTo(100);
    expect(convert(84, "USD", "SAR", rates)).toBeCloseTo(315);
    expect(convert(1, "JPY", "INR", rates)).toBeNull();
  });

  it("formats whole and fractional amounts", () => {
    expect(formatCurrency(1500, "INR")).toBe("₹1,500");
    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
    expect(formatCurrency(1200, "SAR")).toMatch(/SAR\s?1,200/);
  });
});

describe("lineFigures", () => {
  it("multiplies rates by quantity and measures margin against the client price", () => {
    expect(lineFigures(line(40, "metre", 500, 600), {})).toEqual({ vendorTotal: 20000, clientTotal: 24000, clientInr: 24000, margin: 4000, marginPct: 4000 / 24000 });
  });

  it("converts foreign client prices with the given rate", () => {
    const f = lineFigures(line(3, "design", 4000, 250, "SAR"), { SAR: 22.4 });
    expect(f.clientTotal).toBe(750);
    expect(f.clientInr).toBe(16800);
    expect(f.margin).toBe(4800);
  });

  it("treats flat amounts as a quantity of one", () => {
    expect(lineFigures(line(5, "flat", 800, 1500), {}).vendorTotal).toBe(800);
  });

  it("reports unknown currencies without guessing", () => {
    expect(lineFigures(line(1, "piece", 100, 10, "XYZ"), {})).toMatchObject({ clientInr: null, margin: null, marginPct: null });
  });
});

describe("pricingSummary", () => {
  const rates = { SAR: 22.4, USD: 84 };
  const lines = [line(40, "metre", 950, 1150), line(40, "metre", 500, 600), line(3, "design", 4000, 250, "SAR"), line(1, "flat", 800, 20, "USD")];

  it("totals per currency, in INR, and adds the consulting fee to earnings", () => {
    const s = pricingSummary(lines, { amount: 500, currency: "SAR" }, rates);
    expect(s.clientByCurrency).toEqual([
      { currency: "INR", total: 70000 },
      { currency: "SAR", total: 750 },
      { currency: "USD", total: 20 },
    ]);
    expect(s.clientInr).toBe(70000 + 16800 + 1680);
    expect(s.vendorTotal).toBe(38000 + 20000 + 12000 + 800);
    expect(s.serviceMargin).toBe(s.clientInr - s.vendorTotal);
    expect(s.fee).toEqual({ amount: 500, currency: "SAR", inr: 11200 });
    expect(s.earned).toBe(s.serviceMargin + 11200);
    expect(s.earnedPct).toBeCloseTo(s.earned / (s.clientInr + 11200));
    expect(s.missingRates).toEqual([]);
  });

  it("leaves out and reports amounts in currencies without a rate", () => {
    const s = pricingSummary(lines, { amount: 100, currency: "EUR" }, { SAR: 22.4 });
    expect(s.missingRates).toEqual(["EUR", "USD"]);
    expect(s.clientInr).toBe(70000 + 16800);
    expect(s.fee?.inr).toBeNull();
  });

  it("has no percentages when nothing is quoted yet", () => {
    const s = pricingSummary([], null, rates);
    expect(s.servicePct).toBeNull();
    expect(s.earnedPct).toBeNull();
    expect(s.earned).toBe(0);
  });
});

describe("helpers", () => {
  it("lists the foreign currencies a project needs rates for", () => {
    expect(foreignCurrencies([line(1, "piece", 1, 1, "SAR"), line(1, "piece", 1, 1, "INR")], { amount: 10, currency: "USD" })).toEqual(["SAR", "USD"]);
    expect(foreignCurrencies([], { amount: null, currency: "USD" })).toEqual([]);
  });

  it("formats quantities with their unit", () => {
    expect(formatQuantity(40, "metre")).toBe("40 metres");
    expect(formatQuantity(1, "design")).toBe("1 design");
    expect(formatQuantity(2.5, "kg")).toBe("2.5 kg");
    expect(formatQuantity(1, "flat")).toBe("Flat");
  });
});
