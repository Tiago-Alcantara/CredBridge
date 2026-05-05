"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setOnUnauthorized } from "@/lib/api/client";
import { useToast } from "@/providers/ToastProvider";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    setOnUnauthorized(() => {
      queryClient.clear();
      showToast("Sessão expirada. Faça login novamente.", "error");
      router.push("/login");
    });
    return () => setOnUnauthorized(null);
  }, [queryClient, router, showToast]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
