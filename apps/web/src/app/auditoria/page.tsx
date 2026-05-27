import type { Metadata } from "next";
import { AuditContractsPage } from "@/components/audit/AuditContractsPage";

export const metadata: Metadata = {
  title: "Auditoria de contratos | CredBridge",
  description: "Trilha publica de auditoria para notas, contas e contratos CredBridge.",
};

export default function AuditoriaPage() {
  return <AuditContractsPage />;
}
