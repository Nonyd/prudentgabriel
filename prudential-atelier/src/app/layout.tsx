import type { Metadata } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "@/styles/globals.css";
import { auth } from "@/auth";
import { getPublicAppUrl } from "@/lib/app-url";
import { LenisProvider } from "@/providers/LenisProvider";
import { RootProvider } from "@/providers/RootProvider";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const siteUrl = getPublicAppUrl();

const themeInitScript = `(function(){try{var r=localStorage.getItem("pg-theme");if(!r)return;var p=JSON.parse(r);if(p&&p.state&&p.state.isDark)document.documentElement.classList.add("dark");}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png",
  },
  title: {
    template: "%s | Prudent Gabriel",
    default: "Prudent Gabriel — Luxury Nigerian Fashion & Bespoke Couture",
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
    siteName: "Prudent Gabriel",
    title: "Prudent Gabriel — Luxury Nigerian Fashion",
    description:
      "Bespoke couture and ready-to-wear for the woman who commands every room. Lagos, Nigeria.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@prudent_gabriel",
    creator: "@prudent_gabriel",
    title: "Prudent Gabriel",
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
    <html lang="en" suppressHydrationWarning className={`${bodoni.variable} ${jost.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <RootProvider session={session}>
          <LenisProvider>{children}</LenisProvider>
        </RootProvider>
      </body>
    </html>
  );
}
