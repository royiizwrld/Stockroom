export const CURRENCIES = [
  { code: "KES", name: "Kenyan shilling" },
  { code: "USD", name: "US dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British pound" },
  { code: "UGX", name: "Ugandan shilling" },
  { code: "TZS", name: "Tanzanian shilling" },
  { code: "NGN", name: "Nigerian naira" },
  { code: "ZAR", name: "South African rand" },
  { code: "INR", name: "Indian rupee" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "AUD", name: "Australian dollar" },
  { code: "JPY", name: "Japanese yen" },
] as const;

export const DEFAULT_CURRENCY = "KES";
const KEY = "stockroom:currency";
let current: string = DEFAULT_CURRENCY;
const listeners = new Set<() => void>();

export const getCurrency = () => current;
export function setCurrency(code: string, persist = true) {
  if (!CURRENCIES.some((c) => c.code === code)) return;
  current = code;
  if (persist && typeof window !== "undefined") localStorage.setItem(KEY, code);
  listeners.forEach((l) => l());
}
/** Call from an effect after hydration. */
export function loadCurrency() {
  const stored = localStorage.getItem(KEY);
  if (stored && stored !== current) setCurrency(stored, false);
}
export function subscribeCurrency(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

let pricesHidden = false;
export const arePricesHidden = () => pricesHidden;
/** Masks every formatted amount, e.g. when the workspace hides prices from this member. */
export function setPricesHidden(v: boolean) {
  if (v === pricesHidden) return;
  pricesHidden = v;
  listeners.forEach((l) => l());
}

export function formatCurrency(n: number, code: string = current) {
  if (pricesHidden) return "Hidden";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}
