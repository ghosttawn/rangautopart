import assert from "node:assert/strict";
import test from "node:test";
import { SubmitOrderBody } from "@workspace/api-zod";
import {
  hasCompleteDeliveryDetails,
  normalizeCheckoutDetails,
} from "../src/lib/delivery.ts";

test("checkout trims international address fields before validation", () => {
  const normalized = normalizeCheckoutDetails({
    name: "  Ama Mensah ",
    email: "  AMA@example.com ",
    phone: " +233 20 123 4567 ",
    address: "  12 Market Road ",
    city: " Kumasi ",
    region: " Ashanti ",
    country: " Ghana ",
  });

  assert.equal(normalized.email, "ama@example.com");
  assert.equal(normalized.country, "Ghana");
  assert.equal(hasCompleteDeliveryDetails(normalized), true);
});

test("checkout accepts international countries without requiring a state or region", () => {
  const checkout = {
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    name: "Mei Lin",
    email: "mei@example.com",
    phone: "+65 6123 4567",
    address: "12 Orchard Road",
    city: "Singapore",
    country: "Singapore",
  };
  assert.equal(SubmitOrderBody.parse({ ...checkout, region: "" }).region, "");
  assert.equal(SubmitOrderBody.parse(checkout).region, undefined);

  const normalized = normalizeCheckoutDetails({
    name: "  Mei Lin ",
    email: "  mei@example.com ",
    phone: " +65 6123 4567 ",
    address: "  12 Orchard Road ",
    city: " Singapore ",
    region: " ",
    country: " Singapore ",
  });

  assert.equal(normalized.region, "");
  assert.equal(hasCompleteDeliveryDetails(normalized), true);
});

test("checkout rejects address fields that become too short after trimming", () => {
  const normalized = normalizeCheckoutDetails({
    name: " A ",
    email: "a@example.com",
    phone: " 123 ",
    address: "  Rd ",
    city: " X ",
    region: " Y ",
    country: " Z ",
  });

  assert.equal(hasCompleteDeliveryDetails(normalized), false);
});

test("valid destinations in different countries are not restricted by country", () => {
  for (const country of ["Cameroon", "United States", "United Kingdom", "France", "Japan"]) {
    const checkout = SubmitOrderBody.parse({
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      name: "Alex Morgan",
      email: "alex@example.com",
      phone: "+1 202 555 0100",
      address: "12 Market Street",
      city: "Central",
      country,
    });
    assert.equal(hasCompleteDeliveryDetails(normalizeCheckoutDetails(checkout)), true, country);
  }
});
