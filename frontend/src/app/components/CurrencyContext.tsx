import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiFetch } from "../data/api";

export type CurrencyCode = "PHP" | "USD" | "EUR" | "GBP";

interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
  // Units of this currency per 1 PHP (the base).
  rateFromPhp: number;
}

export const CURRENCIES: Record<CurrencyCode, Omit<CurrencyMeta, "rateFromPhp">> = {
  PHP: { code: "PHP", symbol: "₱", label: "Philippine Peso", locale: "en-PH" },
  USD: { code: "USD", symbol: "$", label: "US Dollar",       locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", label: "Euro",             locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", label: "British Pound",    locale: "en-GB" },
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /** Format a PHP-base amount in the currently selected currency. */
  format: (amountInPhp: number) => string;
  /** Convert a PHP-base amount to the current currency value (number). */
  convert: (amountInPhp: number) => number;
  meta: CurrencyMeta;
  ratesUpdatedAt: Date;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>("PHP");
  
  // Real-time rates state, seeded with robust fallbacks
  const [rates, setRates] = useState<Record<CurrencyCode, number>>({
    PHP: 1,
    USD: 0.0175,
    EUR: 0.0162,
    GBP: 0.0138,
  });
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    const fetchLiveRates = async () => {
      try {
        const json = await apiFetch("/finances/exchange-rates");
        if (json && json.success && json.rates) {
          setRates(json.rates);
          if (json.updatedAt) {
            setRatesUpdatedAt(new Date(json.updatedAt));
          }
        }
      } catch (e) {
        console.warn("Failed to fetch live exchange rates from backend, using robust offline rates:", e);
      }
    };

    fetchLiveRates();
    
    // Set a recurring timer to poll every 5 minutes while active
    const timer = setInterval(fetchLiveRates, 300000);
    return () => clearInterval(timer);
  }, []);

  const rate = rates[currency] ?? 1.0;
  const meta: CurrencyMeta = {
    ...CURRENCIES[currency],
    rateFromPhp: rate,
  };

  const convert = (amountInPhp: number) => amountInPhp * rate;

  const format = (amountInPhp: number) => {
    const value = convert(amountInPhp);
    const formatted = new Intl.NumberFormat(meta.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${meta.symbol}${formatted}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, convert, meta, ratesUpdatedAt }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
