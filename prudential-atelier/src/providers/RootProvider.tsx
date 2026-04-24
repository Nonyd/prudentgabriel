"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import type { Session } from "next-auth";
import { CurrencyProvider } from "@/providers/CurrencyProvider";
import { CartSyncProvider } from "@/providers/CartSyncProvider";

interface RootProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function RootProvider({ children, session }: RootProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider session={session ?? undefined}>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
          <CartSyncProvider>{children}</CartSyncProvider>
        </CurrencyProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "var(--charcoal)",
              color: "var(--ivory)",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            },
            success: {
              iconTheme: {
                primary: "var(--gold)",
                secondary: "var(--charcoal)",
              },
            },
            error: {
              iconTheme: {
                primary: "var(--error)",
                secondary: "var(--ivory)",
              },
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
