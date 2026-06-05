"use client";

import type { ReceivableStatus } from "@/types/index";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Lang = "pt" | "en";

interface StatusBadgeProps {
  status: ReceivableStatus;
  lang?: Lang;
}

const statusConfig: Record<ReceivableStatus, { badgeClass: string; stringKey: string }> = {
  pending: { badgeClass: "badge pending", stringKey: "status_pending" },
  validated: { badgeClass: "badge validated", stringKey: "status_validated" },
  tokenized: { badgeClass: "badge validated", stringKey: "status_tokenized" },
  assignment_pending: { badgeClass: "badge pending", stringKey: "status_assignment_pending" },
  active: { badgeClass: "badge active", stringKey: "status_active" },
  settled: { badgeClass: "badge settled", stringKey: "status_settled" },
  defaulted: { badgeClass: "badge defaulted", stringKey: "status_defaulted" },
  rejected: { badgeClass: "badge defaulted", stringKey: "status_rejected" },
};

export function StatusBadge({ status, lang = "pt" }: StatusBadgeProps) {
  const { t } = useTranslation(lang);
  const config = (status && statusConfig[status]) || {
    badgeClass: "badge neutral",
    stringKey: "status_unknown"
  };
  const { badgeClass, stringKey } = config;

  return (
    <span className={badgeClass}>
      {t(stringKey as Parameters<typeof t>[0])}
    </span>
  );
}
