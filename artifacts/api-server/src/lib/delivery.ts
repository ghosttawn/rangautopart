export interface CheckoutContactAndAddress {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region?: string | null;
  country: string;
  deliveryNotes?: string | null;
}

export function normalizeCheckoutDetails<T extends CheckoutContactAndAddress>(
  input: T,
): T & { region: string } {
  return {
    ...input,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    region: input.region?.trim() ?? "",
    country: input.country.trim(),
    deliveryNotes: input.deliveryNotes?.trim() || undefined,
  };
}

export function hasCompleteDeliveryDetails(input: CheckoutContactAndAddress): boolean {
  return (
    input.name.length >= 2 &&
    input.phone.length >= 5 &&
    input.address.length >= 5 &&
    input.city.length >= 2 &&
    input.country.length >= 2
  );
}
