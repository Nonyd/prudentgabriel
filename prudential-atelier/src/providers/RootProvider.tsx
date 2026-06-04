"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import type { Session } from "next-auth";
import { CurrencyProvider } from "@/providers/CurrencyProvider";
import { CartSyncProvider } from "@/providers/CartSyncProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

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
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <CurrencyProvider>
            <CartSyncProvider>{children}</CartSyncProvider>
          </CurrencyProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "var(--choc)",
                color: "var(--cream)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                borderRadius: "var(--radius-md)",
                border: "var(--border)",
              },
              success: {
                iconTheme: {
                  primary: "var(--lightbr)",
                  secondary: "var(--cream)",
                },
              },
              error: {
                iconTheme: {
                  primary: "var(--danger)",
                  secondary: "var(--cream)",
                },
              },
            }}
          />
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
