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
import { QuickAddHost } from "@/components/common/quick-add/QuickAddHost";
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
                <QuickAddHost />
              </CartSyncProvider>
            </CurrencyProvider>
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                className: "glass-toast",
                style: {
                  background: "var(--glass-1-fill)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-ui)",
                  fontSize: "13px",
                  fontWeight: 400,
                  borderRadius: "var(--glass-radius-panel)",
                  border: "1px solid var(--glass-edge)",
                  boxShadow: "var(--glass-highlight), var(--glass-shadow)",
                  backdropFilter: "blur(var(--glass-1-blur)) saturate(var(--glass-saturate))",
                },
                success: {
                  iconTheme: {
                    primary: "var(--choc-deep)",
                    secondary: "var(--ivory-deep)",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "var(--danger)",
                    secondary: "var(--ivory-deep)",
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
