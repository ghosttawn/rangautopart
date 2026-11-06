import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWhatsAppContactNumber } from "../src/lib/whatsapp-contact.ts";

test("WhatsApp contact number accepts and normalizes international formatting", () => {
  assert.equal(
    normalizeWhatsAppContactNumber("+237 (690) 123-456"),
    "+237690123456",
  );
  assert.equal(normalizeWhatsAppContactNumber(null), null);
  assert.equal(normalizeWhatsAppContactNumber("   "), null);
});

test("WhatsApp contact number rejects local-only, invalid, and out-of-range values", () => {
  for (const value of ["690123456", "+0123456789", "+1234567", "+1234567890123456", "+237abc12345"]) {
    assert.throws(() => normalizeWhatsAppContactNumber(value), /international WhatsApp number/);
  }
});
