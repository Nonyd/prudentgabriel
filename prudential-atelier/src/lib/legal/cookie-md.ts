/** Cookie Policy. Revision "nd-1", 15 October 2026. Checked against what the code sets. */
export const COOKIE_MD = `## What this policy covers

Cookies are small files a website stores in your browser. Sites also use similar browser storage ("local storage" and "session storage"). This policy lists everything prudentgabriel.com stores in your browser, why, and how you control it. It is part of our [Privacy Policy](/privacy-policy).

We use **no advertising cookies** and load no advertising or social-media trackers (no Google Analytics, no Meta Pixel). We will not add any without asking you first.

## Your choice

When you first visit, our banner asks you to choose:

{{cookie_banner_notice}}

- **Essential only** keeps the site working: signing in, your bag, your currency and an open chat. Nothing else is stored.
- **Accept all** also allows anonymous visit counting and campaign tags (see Analytics below).

You can change your mind at any time with the **Cookie settings** link in the footer. Your choice is stored in your browser under **{{cookie_consent_key}}** (version {{cookie_consent_version}}), so we do not ask again on every page.

## Essential

These are needed for the site to work and are not used to track you. The law does not require your consent for them, but we still list them here.

- **Sign-in** (Auth.js session cookies, named **authjs.session-token** or **__Secure-authjs.session-token**, with a security token **authjs.csrf-token** and **authjs.callback-url**). Keep you signed in and protect forms. They hold a signed login token, never your password, and last up to 30 days or until you sign out. Signing in with Google also sets short-lived security cookies for the sign-in step.
- **Your bag** (**{{cookie_cart_key}}**, local storage). Holds the pieces in your bag, including any measurements you typed for a made-to-measure piece, until you check out or empty it.
- **Your currency** (**{{cookie_currency_key}}**, local storage). Naira, dollars or pounds, with the rate shown, so the price you see is the price at checkout.
- **Live chat** (**pg_chat**, cookie). Set only if you start a chat. A random code that reopens your conversation on this browser; it holds no name or message and cannot be read by page scripts. It lasts up to 30 days{{#chat_retention_days}}, and never longer than conversations are kept ({{chat_retention_days}} days){{/chat_retention_days}}.
- **Referral** (**pa_ref_code**, cookie). Set only if you arrive through a friend's referral link, for 30 days, so the friend receives their referral points when you order.
- **Security check** (Cloudflare Turnstile). Our consultation enquiry form runs a check from Cloudflare that tells people from automated spam. It may store a short-lived token in your browser to do so.
- **Cookie choice** (**{{cookie_consent_key}}**, local storage). Remembers your choice on the banner.
- **Small preferences** (local or session storage): **pa-wishlist** (pieces you saved), **pa-recently-viewed** (pieces you looked at), **pa-recent-searches** (your recent searches), **pg-theme** (light or dark), **pg:size-guide-unit** (centimetres or inches), whether you found a review helpful, **pg_chat_greeting** (that you closed the chat greeting, this tab only), **pg_chunk_reload_at** (the time the page last reloaded itself after a site update, this tab only) and **atelier-occasion-details** (carries what you typed about your occasion into the enquiry form, this tab only). They stay in your browser and are not sent to us, except as part of a request you make.
- {{#impersonation_minutes}}**House staff only.** When a senior administrator views the site as a client to help them, a cookie (**pg_admin_impersonate**) lasts {{impersonation_minutes}} minutes, and a role-preview cookie (**pg_admin_preview_role**) lasts one hour. Clients never receive these.{{/impersonation_minutes}}

## Analytics (only with your consent)

If you choose **Accept all**:

- We count page visits and "add to bag" actions. The count is anonymous: we store totals per page and day, with no IP address, no device identifier and no profile of you.
- If you arrived from a campaign link (for example one with utm_source in the address), we keep its tags, the site you came from and the page you landed on in session storage (**pa-visit-attribution**) for that browser tab only. If you place an order or book in the same visit, those tags are saved with it so we know which post led to it. Closing the tab clears them.

If you choose **Essential only**, none of this happens. Withdrawing consent through Cookie settings stops it and clears the stored tags.

## Third-party content

- **Google Maps.** The map on our contact page loads only when you click to show it. Google may then set its own cookies under its privacy policy.
- **Payment providers.** When you pay by card, the payment provider (Paystack, Flutterwave, Monnify or Stripe) may set cookies in its own payment window to process the payment and prevent fraud.
- **Cloudflare.** Our site is delivered through Cloudflare, which may set strictly necessary security cookies to protect the site from attacks.

## Controlling storage in your browser

You can also block or delete cookies and site storage in your browser settings. If you block essential storage, the bag, currency and sign-in will not work. Clearing site data resets your banner choice, and we will ask again.

## Contact

Questions about this policy: [{{privacy_email}}](mailto:{{privacy_email}}).
`;
