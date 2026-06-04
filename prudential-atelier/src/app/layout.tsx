import type { Metadata } from "next";
import { Cormorant, Montserrat } from "next/font/google";
import "@/styles/globals.css";
import { auth } from "@/auth";
import { getPublicAppUrl } from "@/lib/app-url";
import { SmoothScroll } from "@/components/public/SmoothScroll";
import { RootProvider } from "@/providers/RootProvider";

const cormorant = Cormorant({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

const siteUrl = getPublicAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | Prudential Atelier",
    default: "Prudential Atelier — Luxury Fashion & Bespoke Couture",
  },
  description:
    "Bespoke couture and ready-to-wear by Mrs. Prudent Gabriel-Okopi. Luxury Nigerian fashion — bridal, evening, and everyday elegance.",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: siteUrl,
    siteName: "Prudential Atelier",
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
    <html lang="en" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <RootProvider session={session}>
          <SmoothScroll>{children}</SmoothScroll>
        </RootProvider>
      </body>
    </html>
  );
}
