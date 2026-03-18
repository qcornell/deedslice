/**
 * Multi-Currency Support — Display-only currency formatting.
 *
 * The Hedera engine always operates in token units.
 * Currency is purely for display purposes in the dashboard UI.
 * The ds_org_settings table has a `currency` field (defaults to "USD").
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "Dubai Dirham", locale: "ar-AE", decimals: 2 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG", decimals: 2 },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE", decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG", decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN", decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR", decimals: 2 },
];

const currencyMap = new Map<string, CurrencyConfig>(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
);

/**
 * Get currency config by code. Falls back to USD if unknown.
 */
export function getCurrencyConfig(code: string): CurrencyConfig {
  return currencyMap.get(code) || SUPPORTED_CURRENCIES[0];
}

/**
 * Format an amount with proper currency symbol and locale.
 *
 * Uses Intl.NumberFormat for locale-aware formatting.
 * Falls back to simple string formatting if Intl is unavailable.
 */
export function formatCurrency(amount: number, currencyCode: string = "USD"): string {
  const config = getCurrencyConfig(currencyCode);
  try {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.code,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    }).format(amount);
  } catch {
    // Fallback for environments where Intl doesn't support the currency
    return `${config.symbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    })}`;
  }
}
