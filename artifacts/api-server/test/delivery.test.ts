import assert from "node:assert/strict";
import test from "node:test";
import { SubmitOrderBody } from "@workspace/api-zod";
import {
  hasCompleteDeliveryDetails,
  isDeliveryAllowed,
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

test("checkout accepts countries whose valid addresses do not use a state or region", () => {
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
  assert.equal(isDeliveryAllowed([], normalized.country, normalized.region), true);
  assert.equal(isDeliveryAllowed(["Singapore"], normalized.country, normalized.region), true);
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

test("empty delivery rules accept international order requests for confirmation", () => {
  assert.equal(isDeliveryAllowed([], "Cameroon", "Littoral"), true);
  assert.equal(isDeliveryAllowed([], "Ghana", "Ashanti"), true);
});

test("configured country, region, and country-region rules match case-insensitively", () => {
  const rules = [" Ghana ", "Littoral", "Cameroon/Douala", "Nigeria:Abuja"];

  assert.equal(isDeliveryAllowed(rules, "GHANA", "Ashanti"), true);
  assert.equal(isDeliveryAllowed(rules, "Cameroon", "Littoral"), true);
  assert.equal(isDeliveryAllowed(rules, "cameroon", "douala"), true);
  assert.equal(isDeliveryAllowed(rules, "Nigeria", "ABUJA"), true);
  assert.equal(isDeliveryAllowed(rules, "Ghana", "Greater Accra"), true);
  assert.equal(isDeliveryAllowed(rules, "Senegal", "Dakar"), false);
});
