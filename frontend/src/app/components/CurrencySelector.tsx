import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { CURRENCIES, CurrencyCode, useCurrency } from "./CurrencyContext";

const ORDER: CurrencyCode[] = ["PHP", "USD", "EUR", "GBP"];

export function CurrencySelector() {
  const { currency, setCurrency, meta } = useCurrency();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-[var(--glass-border)] text-white hover:bg-white/10 transition-all"
        title="Display currency"
      >
        <span className="size-6 rounded-full bg-[var(--action-blue)]/20 border border-[var(--action-blue)]/40 flex items-center justify-center text-[var(--action-blue)] text-xs">
          {meta.symbol}
        </span>
        <span className="text-xs">{meta.code}</span>
        <ChevronDown size={14} className="text-[var(--cool-gray)]" />
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, right: coords.right, zIndex: 9999 }}
          className="w-56 rounded-lg bg-[var(--deep-slate)] border border-[var(--glass-border)] shadow-xl p-1"
        >
          <div className="px-3 py-2 text-xs text-[var(--cool-gray)]">Display currency</div>
          {ORDER.map((code) => {
            const c = CURRENCIES[code];
            const active = code === currency;
            return (
              <button
                key={code}
                onClick={() => {
                  setCurrency(code);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-all text-left"
              >
                <span className="size-7 rounded-full bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/30 flex items-center justify-center text-[var(--action-blue)] text-sm">
                  {c.symbol}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{c.code}</div>
                  <div className="text-xs text-[var(--cool-gray)] truncate">{c.label}</div>
                </div>
                {active && <Check size={14} className="text-[var(--mint-green)]" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
