import { Body, Head, Html, Img, Preview, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { EMAIL_LOGO_PX } from "@/lib/customer-email";
import {
  EMAIL_ATELIER_LOGO_HEIGHT,
  EMAIL_ATELIER_LOGO_WIDTH,
  emailAtelierLogoDarkUrl,
  emailAtelierLogoWhiteUrl,
  emailHouseName,
  emailLogoDarkUrl,
  emailLogoWhiteUrl,
  type EmailBrand,
} from "@/lib/email-branding";
import { currentEmailScope } from "./email-brand";
import EmailFooter from "./EmailFooter";
import {
  EMAIL_CHOC,
  EMAIL_GOLD,
  EMAIL_WIDTH,
  FONT_BODY,
  FONT_DISPLAY,
  familyBodyPad,
  familyCardBg,
  familyPageBg,
  type EmailFamily,
} from "./email-tokens";

function logoBox(w: number, h: number) {
  return {
    width: `${w}px`,
    height: `${h}px`,
    maxWidth: `${w}px`,
    maxHeight: `${h}px`,
    display: "block" as const,
    margin: "0 auto",
    border: 0,
    outline: "none",
  };
}

type EmailLayoutProps = {
  children: ReactNode;
  previewText?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  family?: EmailFamily;
  /** Defaults to the brand set by the renderer (see `renderInEmailScope`). */
  brand?: EmailBrand;
  /** Marketing only. Pass the placeholder; outbox replaces it per recipient. */
  unsubscribeUrl?: string;
};

export default function EmailLayout({
  children,
  previewText,
  logoUrl,
  logoDarkUrl,
  family = "transactional",
  brand: brandProp,
  unsubscribeUrl,
}: EmailLayoutProps) {
  const { brand: contextBrand, signOff } = currentEmailScope();
  const brand = brandProp ?? contextBrand;
  const atelier = brand === "atelier";
  const houseName = emailHouseName(brand);
  const logoW = atelier ? EMAIL_ATELIER_LOGO_WIDTH : EMAIL_LOGO_PX;
  const logoH = atelier ? EMAIL_ATELIER_LOGO_HEIGHT : EMAIL_LOGO_PX;
  const onChoc = logoUrl ?? (atelier ? emailAtelierLogoWhiteUrl : emailLogoWhiteUrl);
  const onLight = logoDarkUrl ?? (atelier ? emailAtelierLogoDarkUrl : emailLogoDarkUrl);
  // No light-on-dark atelier mark: put the dark wordmark on a light band instead of hiding it.
  const lightHeader = !onChoc && Boolean(onLight);
  const headerLogo = onChoc || onLight;
  const darkLogo = lightHeader ? "" : onLight;
  const headerBg = lightHeader ? "#FFFdf9" : EMAIL_CHOC;
  // The atelier wordmark already spells the house; repeating it underneath is noise.
  const showHouseLine = !atelier || !headerLogo;
  const pageBg = familyPageBg(family);
  const cardBg = familyCardBg(family);
  const pad = familyBodyPad(family);
  const showUnsub = family === "marketing";

  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Head styles: webfonts + dark-mode logo swap. Body <style> is not used. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  .logo-on-choc { display: none !important; }
  .logo-on-invert { display: block !important; width: ${logoW}px !important; height: ${logoH}px !important; max-width: ${logoW}px !important; max-height: ${logoH}px !important; }
}
[data-ogsc] .logo-on-choc { display: none !important; }
[data-ogsc] .logo-on-invert { display: block !important; width: ${logoW}px !important; height: ${logoH}px !important; max-width: ${logoW}px !important; max-height: ${logoH}px !important; }
            `.trim(),
          }}
        />
        {/* react-email Head, not a Next page — webfonts are for mail clients. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap"
        />
      </Head>
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body style={{ margin: 0, padding: 0, backgroundColor: pageBg, fontFamily: FONT_BODY }}>
        <table
          width="100%"
          border={0}
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ backgroundColor: pageBg, margin: 0, padding: 0, width: "100%" }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 12px" }}>
                <table
                  width={EMAIL_WIDTH}
                  border={0}
                  cellPadding={0}
                  cellSpacing={0}
                  role="presentation"
                  style={{
                    width: "100%",
                    maxWidth: EMAIL_WIDTH,
                    backgroundColor: cardBg,
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        {...({ bgcolor: headerBg } as Record<string, string>)}
                        style={{
                          backgroundColor: headerBg,
                          padding: family === "marketing" ? "28px 24px 24px" : "24px 24px 20px",
                          textAlign: "center",
                        }}
                      >
                        {headerLogo ? (
                          <table
                            align="center"
                            border={0}
                            cellPadding={0}
                            cellSpacing={0}
                            role="presentation"
                            style={{ margin: "0 auto" }}
                          >
                            <tbody>
                              <tr>
                                <td
                                  width={logoW}
                                  height={logoH}
                                  align="center"
                                  style={{
                                    width: `${logoW}px`,
                                    height: `${logoH}px`,
                                    lineHeight: 0,
                                    fontSize: 0,
                                  }}
                                >
                                  <Img
                                    className={lightHeader ? undefined : "logo-on-choc"}
                                    src={headerLogo}
                                    alt={houseName}
                                    width={logoW}
                                    height={logoH}
                                    style={logoBox(logoW, logoH)}
                                  />
                                  {darkLogo && darkLogo !== headerLogo ? (
                                    <Img
                                      className="logo-on-invert"
                                      src={darkLogo}
                                      alt={houseName}
                                      width={logoW}
                                      height={logoH}
                                      style={{ ...logoBox(logoW, logoH), display: "none" }}
                                    />
                                  ) : null}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ) : null}
                        {showHouseLine ? (
                        <Text
                          style={{
                            margin: headerLogo ? "14px 0 0" : 0,
                            fontFamily: FONT_DISPLAY,
                            fontSize: 11,
                            letterSpacing: "0.28em",
                            textTransform: "uppercase",
                            color: EMAIL_GOLD,
                            lineHeight: "16px",
                          }}
                        >
                          {houseName}
                        </Text>
                        ) : null}
                        {family === "relationship" ? (
                          <table
                            border={0}
                            cellPadding={0}
                            cellSpacing={0}
                            role="presentation"
                            align="center"
                            style={{ margin: "16px auto 0" }}
                          >
                            <tbody>
                              <tr>
                                <td
                                  height={1}
                                  width={48}
                                  style={{ backgroundColor: EMAIL_GOLD, fontSize: 0, lineHeight: 0 }}
                                >
                                  &nbsp;
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ) : null}
                      </td>
                    </tr>
                    {family === "transactional" ? (
                      <tr>
                        <td
                          height={3}
                          style={{ backgroundColor: EMAIL_GOLD, fontSize: 0, lineHeight: 0, height: 3 }}
                        >
                          &nbsp;
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td
                        style={{
                          padding: pad,
                          backgroundColor: cardBg,
                          fontFamily: FONT_BODY,
                        }}
                      >
                        {children}
                        {signOff ? (
                          <Text
                            style={{
                              margin: "28px 0 0",
                              fontFamily: FONT_BODY,
                              fontSize: 15,
                              lineHeight: "24px",
                              color: "#2C241C",
                            }}
                          >
                            {signOff.line}
                            <br />
                            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: EMAIL_CHOC }}>
                              {signOff.team}
                            </span>
                          </Text>
                        ) : null}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: 0 }}>
                        <EmailFooter
                          family={showUnsub ? "marketing" : family}
                          houseName={houseName}
                          unsubscribeUrl={unsubscribeUrl}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
