const INTERNATIONAL_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizeWhatsAppContactNumber(
  value: string | null | undefined,
): string | null {
  if (value == null || value.trim() === "") return null;

  const normalized = value.trim().replace(/[\s().-]/g, "");
  if (!INTERNATIONAL_PHONE_PATTERN.test(normalized)) {
    throw new Error(
      "Enter a valid international WhatsApp number, including its country code (for example, +237 6XX XXX XXX).",
    );
  }
  return normalized;
}
