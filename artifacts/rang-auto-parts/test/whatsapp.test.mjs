import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWhatsAppChatUrl,
  buildWhatsAppMessage,
  isValidWhatsAppNumber,
} from "../src/lib/whatsapp.ts";
import { validateImageFile } from "../src/lib/image-upload.ts";

test("WhatsApp number must be a valid international E.164 number", () => {
  assert.equal(isValidWhatsAppNumber("+237690123456"), true);
  assert.equal(isValidWhatsAppNumber("+12025550100"), true);
  assert.equal(isValidWhatsAppNumber("690123456"), false);
  assert.equal(isValidWhatsAppNumber("+0123456789"), false);
  assert.equal(isValidWhatsAppNumber("+237abc12345"), false);
});

test("checkout inquiry includes entered customer, destination, parts, and estimate", () => {
  const message = buildWhatsAppMessage({
    form: {
      name: "  Alex   Morgan ",
      email: "alex@example.com",
      phone: "+1 202 555 0100",
      address: "12 Market Street",
      city: "Accra",
      region: "Greater Accra",
      country: "Ghana",
      deliveryNotes: "Call on arrival",
    },
    items: [{ name: "LED headlight kit", sku: "RANG-LED-1", quantity: 2, lineTotal: "XAF 24,000" }],
    subtotal: "XAF 24,000",
    delivery: "XAF 2,000",
    total: "XAF 26,000",
  });

  assert.match(message, /order inquiry only/i);
  assert.match(message, /no order has been submitted or confirmed/i);
  assert.match(message, /Name: Alex Morgan/);
  assert.match(message, /Country: Ghana/);
  assert.match(message, /LED headlight kit \(SKU RANG-LED-1\) × 2/);
  assert.match(message, /XAF 26,000/);
  assert.doesNotMatch(message, /password|card number|payment details/i);
});

test("submitted-order follow-up includes its reference without creating another order", () => {
  const message = buildWhatsAppMessage({
    orderReference: "RANG-2026-00123",
    orderStatus: "pending",
    total: "XAF 26,000",
  });
  assert.match(message, /RANG-2026-00123/);
  assert.match(message, /already submitted/i);
  assert.match(message, /does not create a new order/i);
});

test("WhatsApp link uses official click-to-chat format and encoded text", () => {
  const url = buildWhatsAppChatUrl("+237690123456", "Hello RANG\nParts × 2");
  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://wa.me");
  assert.equal(parsed.pathname, "/237690123456");
  assert.equal(parsed.searchParams.get("text"), "Hello RANG\nParts × 2");
  assert.equal(buildWhatsAppChatUrl("690123456", "hello"), null);
});

test("image uploads reject empty, oversized, and unsupported files before posting", () => {
  assert.equal(validateImageFile({ type: "image/jpeg", size: 1 }), null);
  assert.match(validateImageFile({ type: "image/gif", size: 1 }) ?? "", /JPEG, PNG, or WebP/);
  assert.match(validateImageFile({ type: "image/png", size: 0 }) ?? "", /empty/);
  assert.match(validateImageFile({ type: "image/webp", size: 5 * 1024 * 1024 + 1 }) ?? "", /5 MB/);
});
