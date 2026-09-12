"use client";

import { Languages } from "lucide-react";
import { useLanguage, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ inverse = false }: { inverse?: boolean }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("Switch language")}
      className={cn("flex items-center gap-1 rounded-lg border p-1", inverse ? "border-white/15 bg-white/5 text-white" : "bg-white")}
    >
      <Languages size={15} className={cn("ml-1", inverse ? "text-slate-400" : "text-slate-500")} aria-hidden="true" />
      {(["th", "en"] as Locale[]).map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-label={value === "th" ? t("Thai") : t("English")}
          aria-pressed={locale === value}
          onClick={() => setLocale(value)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9bc53d]",
            locale === value
              ? inverse ? "bg-[#c9f060] text-[#0d1720]" : "bg-[#20332a] text-white"
              : inverse ? "text-slate-300 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100",
          )}
        >
          {value === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}
