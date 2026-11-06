import assert from "node:assert/strict";
import test from "node:test";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, imageSignatureMatches } from "../src/lib/image-validation.ts";

test("image upload validation accepts only expected image MIME types", () => {
  assert.deepEqual([...IMAGE_TYPES].sort(), ["image/jpeg", "image/png", "image/webp"]);
  assert.equal(IMAGE_MAX_BYTES, 5 * 1024 * 1024);
});

test("image signature validation rejects mismatched content and corrupted headers", () => {
  assert.equal(
    imageSignatureMatches("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    true,
  );
  assert.equal(
    imageSignatureMatches("image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    true,
  );
  assert.equal(
    imageSignatureMatches("image/webp", Buffer.from("RIFF0000WEBP")),
    true,
  );
  assert.equal(imageSignatureMatches("image/png", Buffer.from("not an image")), false);
  assert.equal(imageSignatureMatches("image/gif", Buffer.from("GIF89a")), false);
});
