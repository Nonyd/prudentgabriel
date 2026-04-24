import type { Metadata } from "next";
import { Cormorant_Garamond, Cormorant_SC, DM_Sans } from "next/font/google";
import "@/styles/globals.css";
import { auth } from "@/auth";
import { getPublicAppUrl } from "@/lib/app-url";
import { LenisProvider } from "@/providers/LenisProvider";
import { RootProvider } from "@/providers/RootProvider";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

const cormorantSC = Cormorant_SC({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-cormorant-sc",
  display: "swap",
});

const siteUrl = getPublicAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | Prudential Atelier",
    default: "Prudential Atelier — Luxury Nigerian Fashion & Bespoke Couture",
  },
  description:
    "Bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Luxury Nigerian fashion for the modern woman — bridal, evening, formal, and casual wear. Ships worldwide.",
  keywords: [
    "Nigerian fashion",
    "bespoke couture Nigeria",
    "luxury bridal Lagos",
    "Prudent Gabriel",
    "Prudential Atelier",
    "Nigerian designer",
    "African fashion",
  ],
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: siteUrl,
    siteName: "Prudential Atelier",
    title: "Prudential Atelier — Luxury Nigerian Fashion",
    description:
      "Bespoke couture and ready-to-wear for the woman who commands every room. Lagos, Nigeria.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@prudent_gabriel",
    creator: "@prudent_gabriel",
    title: "Prudential Atelier",
    description: "Where culture meets couture. Every stitch is a story.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${cormorantSC.variable}`}>
      <body className="min-h-screen">
        <RootProvider session={session}>
          <LenisProvider>{children}</LenisProvider>
        </RootProvider>
      </body>
    </html>
  );
}
