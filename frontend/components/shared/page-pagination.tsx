"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// One-based pages; unknown totals support API lists that expose only hasNext.
export function PagePagination({ page, pageCount, hasNext, onPageChange, className }: {
  page: number; pageCount?: number; hasNext?: boolean;
  onPageChange: (page: number) => void; className?: string;
}) {
  const { t } = useLanguage();
  return <nav aria-label={t("Page")} className={cn("flex items-center justify-between gap-3", className)}>
    <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{t("Previous")}</Button>
    <p className="text-muted-foreground type-body-sm">{t("Page")} {page}{pageCount !== undefined && <> {t("of")} {pageCount}</>}</p>
    <Button type="button" variant="outline" size="sm" disabled={pageCount !== undefined ? page >= pageCount : !hasNext} onClick={() => onPageChange(page + 1)}>{t("Next")}</Button>
  </nav>;
}
