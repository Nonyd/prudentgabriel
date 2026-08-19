"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import type { Session } from "next-auth";
import { CurrencyProvider } from "@/providers/CurrencyProvider";
import { CartSyncProvider } from "@/providers/CartSyncProvider";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { LogoProvider } from "@/components/ui/LogoProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { AuthLinkInterceptor } from "@/components/auth/AuthLinkInterceptor";
import type { LogoSettings } from "@/lib/logo-settings";

interface RootProviderProps {
  children: React.ReactNode;
  session?: Session | null;
  logos: LogoSettings;
}

export function RootProvider({ children, session, logos }: RootProviderProps) {
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
        <LogoProvider logos={logos}>
          <QueryClientProvider client={queryClient}>
            <CurrencyProvider>
              <CartSyncProvider>
                <AuthLinkInterceptor />
                {children}
                <AuthModal />
              </CartSyncProvider>
            </CurrencyProvider>
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "var(--choc)",
                  color: "var(--cream)",
                  fontFamily: "var(--font-ui)",
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
        </LogoProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
