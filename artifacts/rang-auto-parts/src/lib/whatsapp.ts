export interface WhatsAppInquiryForm {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  deliveryNotes?: string;
}

export interface WhatsAppInquiryItem {
  name: string;
  sku?: string;
  quantity: number;
  lineTotal: string;
}

export interface WhatsAppMessageInput {
  form?: WhatsAppInquiryForm;
  items?: WhatsAppInquiryItem[];
  subtotal?: string;
  delivery?: string;
  total?: string;
  orderReference?: string;
  orderStatus?: string;
}

function clean(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function isValidWhatsAppNumber(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

export function buildWhatsAppMessage(input: WhatsAppMessageInput): string {
  const lines = [
    "Hello RANG Auto Parts,",
    "",
    input.orderReference
      ? "I am following up about an order I already submitted through the RANG storefront. This message does not create a new order."
      : "I would like to check availability and delivery for these parts. This is an order inquiry only; no order has been submitted or confirmed.",
  ];

  if (input.orderReference) {
    lines.push("", `Order reference: ${clean(input.orderReference)}`);
    if (input.orderStatus) lines.push(`Current status: ${clean(input.orderStatus)}`);
  }

  const customerLines = [
    ["Name", input.form?.name],
    ["Email", input.form?.email],
    ["Phone", input.form?.phone],
  ].filter(([, value]) => clean(value as string | undefined));
  if (customerLines.length) {
    lines.push("", "Customer details");
    for (const [label, value] of customerLines) {
      lines.push(`${label}: ${clean(value as string)}`);
    }
  }

  const destinationLines = [
    ["Address", input.form?.address],
    ["City", input.form?.city],
    ["State / region", input.form?.region],
    ["Country", input.form?.country],
  ].filter(([, value]) => clean(value as string | undefined));
  if (destinationLines.length) {
    lines.push("", "Delivery destination");
    for (const [label, value] of destinationLines) {
      lines.push(`${label}: ${clean(value as string)}`);
    }
  }

  const notes = clean(input.form?.deliveryNotes);
  if (notes) lines.push(`Delivery notes: ${notes}`);

  if (input.items?.length) {
    lines.push("", "Parts requested");
    for (const item of input.items) {
      const sku = clean(item.sku);
      lines.push(
        `- ${clean(item.name)}${sku ? ` (SKU ${sku})` : ""} × ${item.quantity} — ${clean(item.lineTotal)}`,
      );
    }
  }

  const summaryLabel = input.orderReference ? "Submitted order" : "Estimated order";
  if (input.subtotal) lines.push("", `${summaryLabel} subtotal: ${clean(input.subtotal)}`);
  if (input.delivery) lines.push(`Delivery estimate: ${clean(input.delivery)}`);
  if (input.total) lines.push(`${summaryLabel} total: ${clean(input.total)}`);
  lines.push("", "Please confirm fitment, availability, and delivery arrangements. Thank you.");

  return lines.join("\n");
}

export function buildWhatsAppChatUrl(
  phoneNumber: string,
  message: string,
): string | null {
  if (!isValidWhatsAppNumber(phoneNumber)) return null;
  return `https://wa.me/${phoneNumber.slice(1)}?text=${encodeURIComponent(message)}`;
}
