import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedCurrencyCode } from "../src/lib/currency.ts";

test("accepts supported currencies without confusing XAF and XOF", () => {
  assert.equal(isSupportedCurrencyCode("XAF"), true);
  assert.equal(isSupportedCurrencyCode("XOF"), true);
  assert.equal(isSupportedCurrencyCode("USD"), true);
  assert.equal(isSupportedCurrencyCode("ZZZ"), false);
  assert.equal(isSupportedCurrencyCode("xaf"), false);
});
