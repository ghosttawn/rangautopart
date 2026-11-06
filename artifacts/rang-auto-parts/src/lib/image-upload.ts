export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageFile(file: Pick<File, "type" | "size">): string | null {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size <= 0) {
    return "The selected image is empty.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image files must be 5 MB or smaller.";
  }
  return null;
}
