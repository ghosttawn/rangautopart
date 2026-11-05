const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

export function isSupportedCurrencyCode(currency: string): boolean {
  return supportedCurrencies.has(currency);
}
