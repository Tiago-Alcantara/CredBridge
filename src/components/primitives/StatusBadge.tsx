"use client";

import type { ReceivableStatus } from "@/types/index";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Lang = "pt" | "en";

interface StatusBadgeProps {
  status: ReceivableStatus;
  lang?: Lang;
}

const statusConfig: Record<ReceivableStatus, { badgeClass: string; stringKey: string }> = {
  pending:   { badgeClass: "badge pending",   stringKey: "status_pending" },
  active:    { badgeClass: "badge active",     stringKey: "status_active" },
  completed: { badgeClass: "badge completed",  stringKey: "status_completed" },
  defaulted: { badgeClass: "badge defaulted",  stringKey: "status_defaulted" },
};

export function StatusBadge({ status, lang = "pt" }: StatusBadgeProps) {
  const { t } = useTranslation(lang);
  const { badgeClass, stringKey } = statusConfig[status];

  return (
    <span className={badgeClass}>
      {t(stringKey as Parameters<typeof t>[0])}
    </span>
  );
}
