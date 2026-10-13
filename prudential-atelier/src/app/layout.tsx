import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import localFont from "next/font/local";
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

// The house fonts ship with the app (src/app/fonts, SIL OFL — licences beside them),
// so a build never depends on reaching Google Fonts. Latin variable files from
// Fontsource; the weight ranges cover every weight the site uses.
const cormorantGaramond = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-latin-wght-normal.woff2", weight: "300 700", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-wght-italic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
  fallback: ["Cormorant Garamond", "Georgia", "serif"],
});

const lora = localFont({
  src: [
    { path: "./fonts/lora-latin-wght-normal.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/lora-latin-wght-italic.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-lora",
  display: "swap",
  fallback: ["Lora", "Georgia", "serif"],
});

const jost = localFont({
  src: [{ path: "./fonts/jost-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-jost",
  display: "swap",
  fallback: ["Jost", "system-ui", "sans-serif"],
});

const siteUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const image = await houseShareImage();
  const home = PAGE_SEO_FALLBACKS.home;
  // Root metadata reaches every page, including not-found. It must not claim a
  // robots directive (it sat beside Next's `noindex` on 404s) or a canonical /
  // og:url of "/" (every page without its own claimed to be the homepage).
  // Pages set those themselves.
  const homeMeta = pageMetadata({
    title: home.title,
    description: home.description,
    path: "/",
    image,
  });
  const openGraph: NonNullable<Metadata["openGraph"]> = { ...homeMeta.openGraph };
  delete openGraph.url;
  return {
    metadataBase: new URL(siteUrl),
    description: homeMeta.description,
    openGraph,
    twitter: homeMeta.twitter,
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
          <SmoothScroll />
          {children}
          <CookieConsent />
        </RootProvider>
      </body>
    </html>
  );
}
