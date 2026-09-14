import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { Cormorant_Garamond, Jost, Lora } from "next/font/google";
import "@/styles/globals.css";
import { getPublicAppUrl } from "@/lib/app-url";
import { getLogoSettings } from "@/lib/logos";
import { RootProvider } from "@/providers/RootProvider";
import { CookieConsent } from "@/components/gdpr/CookieConsent";
import { houseShareImage, pageMetadata } from "@/lib/seo";
import { PAGE_SEO_FALLBACKS } from "@/lib/seo-copy";

const SmoothScroll = nextDynamic(
  () => import("@/components/public/SmoothScroll").then((m) => ({ default: m.SmoothScroll })),
  { ssr: true },
);

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

export async function generateMetadata(): Promise<Metadata> {
  const image = await houseShareImage();
  const home = PAGE_SEO_FALLBACKS.home;
  return {
    metadataBase: new URL(siteUrl),
    ...pageMetadata({
      title: home.title,
      description: home.description,
      path: "/",
      image,
    }),
    title: {
      default: home.title,
      template: "%s",
    },
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <RootProvider logos={logos}>
          <SmoothScroll>{children}</SmoothScroll>
          <CookieConsent />
        </RootProvider>
      </body>
    </html>
  );
}
