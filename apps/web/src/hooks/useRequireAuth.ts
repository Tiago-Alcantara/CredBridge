"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getTokenRole } from "@/lib/api/auth-storage";

type UserRole = "pme" | "investor" | "partner" | "operator";

export function useRequireAuth(requiredRole?: UserRole) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    if (requiredRole) {
      const role = getTokenRole();
      if (role !== requiredRole) {
        // Authenticated but wrong role — send to their own dashboard
        if (role === "pme") router.replace("/pme/dashboard");
        else if (role === "investor") router.replace("/investor/dashboard");
        else if (role === "partner") router.replace("/partner/dashboard");
        else if (role === "operator") router.replace("/operator/dashboard");
        else router.replace("/login");
        return;
      }
    }

    setIsReady(true);
  }, [router, requiredRole]);

  return { isReady };
}
