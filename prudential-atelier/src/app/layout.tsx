import type { Metadata } from "next";
import { Cormorant_Garamond, Jost, Lora } from "next/font/google";
import "@/styles/globals.css";
import { auth } from "@/auth";
import { getPublicAppUrl } from "@/lib/app-url";
import { getLogoSettings } from "@/lib/logos";
import { SmoothScroll } from "@/components/public/SmoothScroll";
import { RootProvider } from "@/providers/RootProvider";

const themeInitScript = `(function(){try{var t=localStorage.getItem("pg-theme");var theme="light";if(t==="dark"||t==="light")theme=t;else if(t){try{var p=JSON.parse(t);if(p&&p.state&&p.state.isDark)theme="dark";}catch(e){}}document.documentElement.setAttribute("data-theme",theme);}catch(e){}})();`;

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
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
  const logos = await getLogoSettings();

  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${lora.variable} ${jost.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <RootProvider session={session} logos={logos}>
          <SmoothScroll>{children}</SmoothScroll>
        </RootProvider>
      </body>
    </html>
  );
}
