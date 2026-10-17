/**
 * The /faqs page: every answer, written once, in a small typed format the page
 * renders (paragraphs, bullet lists, links) and flattens to plain text for the
 * FAQPage JSON-LD. Live figures come in through `facts`; a sentence whose
 * figure is empty is left out rather than printed with a blank.
 *
 * Every answer must stay true to how the site works. When a rule changes in
 * the code, change it here too.
 */

export type FaqLink = { href: string; label: string };
export type FaqInline = string | FaqLink;
export type FaqBlock = { kind: "p"; parts: FaqInline[] } | { kind: "ul"; items: FaqInline[][] };

export type FaqEntry = {
  /** Stable anchor, from the question. */
  id: string;
  q: string;
  a: FaqBlock[];
  /** The visible answer as plain text, for JSON-LD and search. */
  plain: string;
};

export type FaqSection = {
  id: string;
  title: string;
  intro?: string;
  items: FaqEntry[];
};

export type FaqConsultationFees = {
  physicalPrudent: number;
  physicalTeam: number;
  virtualPrudent: number;
  virtualTeam: number;
};

export type FaqFacts = {
  /** resolveLegalTokens() output; any value may be empty. */
  tokens: Record<string, string>;
  email: string;
  addressLines: string[];
  hours: string[];
  consultationFees: FaqConsultationFees | null;
  bonusPoints: { review: number; newsletter: number; styleProfile: number; birthday: number };
  tiers: { silver: number; gold: number; platinum: number } | null;
};

export const FAQ_DEFAULT_EMAIL = "hello@prudentgabriel.com";

/* ── Authoring helpers ─────────────────────────────────────────────── */

type Part = FaqInline | null | undefined | false;

const link = (href: string, label: string): FaqLink => ({ href, label });

function hasText(parts: FaqInline[]): boolean {
  return parts.some((part) => (typeof part === "string" ? part.trim() : part.label.trim()));
}

function p(...parts: Part[]): FaqBlock | null {
  const kept = parts.filter((part): part is FaqInline => Boolean(part));
  return hasText(kept) ? { kind: "p", parts: kept } : null;
}

function ul(...items: (Part[] | null | false)[]): FaqBlock | null {
  const kept = items
    .filter((item): item is Part[] => Array.isArray(item))
    .map((item) => item.filter((part): part is FaqInline => Boolean(part)))
    .filter(hasText);
  return kept.length ? { kind: "ul", items: kept } : null;
}

/** `fn(value)` when the value is present, otherwise nothing. */
function when(value: string | number | null | undefined, fn: (v: string) => string): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v || v === "0") return null;
  return fn(v);
}

function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function count(n: number): string {
  return Math.round(n).toLocaleString("en-NG");
}

function inlineText(parts: FaqInline[]): string {
  return parts
    .map((part) => (typeof part === "string" ? part : part.label))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(text: string): string {
  return /[.!?:)]$/.test(text) ? text : `${text}.`;
}

export function faqPlainText(blocks: FaqBlock[]): string {
  return blocks
    .map((block) =>
      block.kind === "p" ? inlineText(block.parts) : block.items.map((item) => sentence(inlineText(item))).join(" "),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
}

type Draft = { q: string; a: FaqBlock[] };

function qa(q: string, ...blocks: (FaqBlock | null)[]): Draft {
  return { q, a: blocks.filter((b): b is FaqBlock => Boolean(b)) };
}

/* ── The page ──────────────────────────────────────────────────────── */

export function buildFaq(facts: FaqFacts): FaqSection[] {
  const t = facts.tokens;
  const email = facts.email.trim() || FAQ_DEFAULT_EMAIL;
  const mail = link(`mailto:${email}`, email);
  const address = facts.addressLines.filter(Boolean).join(", ");
  const hours = facts.hours.filter(Boolean).join("; ");

  const production = t.production_time?.trim() ?? "";
  const customLead = t.custom_lead_time_days?.trim() ?? "";
  const returnDays = t.return_window_days?.trim() || "7";
  const faultHours = t.post_delivery_fault_hours?.trim() ?? "";
  const fabricHours = t.fabric_promise_hours?.trim() ?? "";
  const warrantyDays = t.alteration_warranty_days?.trim() ?? "";
  const validityDays = t.invoice_validity_days?.trim() ?? "";
  const lagosRates = t.shipping_lagos?.trim() ?? "";
  const methods = t.shipping_methods?.trim() ?? "";
  const ddu = t.shipping_ddu?.trim() ?? "";
  const uncollectedDays = t.shipping_uncollected_days?.trim() ?? "";
  const perTen = t.points_per_ten?.trim() ?? "";
  const spendUnit = t.points_spend_unit?.trim() ?? "";
  const atelierPer100 = t.points_atelier_per_hundred?.trim() ?? "";
  const pointRate = t.points_rate?.trim() ?? "";
  const referral = t.points_referral?.trim() ?? "";
  const expiry = t.points_expiry_months?.trim() ?? "";
  const minRedeem = t.points_min_redemption?.trim() ?? "";
  const fees = facts.consultationFees;
  const bonus = facts.bonusPoints;

  const sections: { id: string; title: string; intro?: string; items: Draft[] }[] = [
    {
      id: "ordering",
      title: "Ordering & made to order",
      intro: "How a piece goes from your basket to our cutting table.",
      items: [
        qa(
          "Is everything made to order?",
          p(
            "Yes. Prudent Gabriel holds no finished stock: every piece is cut, sewn and finished for you in our Lagos atelier once you have ordered. It means a short wait, and a piece that was made for you rather than taken from a shelf.",
          ),
        ),
        qa(
          "How long will my order take?",
          p(
            when(production, (v) => `Ready-to-wear is made in ${v}, and then shipped. `),
            "Some pieces show their own making time on the product page; where one does, that figure is the one that applies. ",
            when(customLead, (v) => `A made-to-measure piece from the shop takes about ${v} days to make. `),
          ),
          p(
            "Delivery time comes on top of the making time. See ",
            link("#delivery", "Delivery & collection"),
            " below, or our ",
            link("/shipping-policy", "Shipping Policy"),
            ".",
          ),
        ),
        qa(
          "Do I need an account to order?",
          p(
            "No. You can check out as a guest. When your payment succeeds we open an account for that email address (if there isn't one already) and send you a welcome email with a link to choose your password. The link works once and lasts seven days; after that, Forgot password does the same job.",
          ),
        ),
        qa(
          "Can I change or cancel my order after paying?",
          p(
            "Write to us at ",
            mail,
            " as soon as you can, with your order number. Because work on a made-to-order piece begins soon after payment, we will tell you honestly what can still be changed. Once a made-to-measure piece has been cut it cannot be cancelled for a change of mind; the ",
            link("/terms-and-conditions", "Terms & Conditions"),
            " set out the detail.",
          ),
        ),
        qa(
          "What if the fabric for my piece runs out?",
          p(
            fabricHours
              ? `If the fabric for your piece becomes unavailable, we will offer you an alternative or a refund within ${fabricHours} hours.`
              : "If the fabric for your piece becomes unavailable, we will offer you an alternative or a refund.",
          ),
        ),
        qa(
          "Can I use a discount code?",
          p(
            "Yes, when we have given you one. Enter it at checkout and it applies if its conditions are met (dates, minimum spend or particular pieces, for example). Prudent Points are separate and are used at checkout too; see ",
            link("#points", "Prudent Points"),
            ".",
          ),
        ),
      ],
    },
    {
      id: "sizing",
      title: "Sizing & fit",
      intro: "Our size chart, and how to choose between two sizes.",
      items: [
        qa(
          "What sizes do you make?",
          p(
            "Standard sizes run from UK 6 to UK 22, cut to the Prudent Gabriel house size chart: bust, waist, hip and length for each size. If you are outside the chart, or between two sizes by more than a little, made to measure is usually the better choice.",
          ),
        ),
        qa(
          "Where can I find the size chart?",
          p(
            "Every product page has a size guide, with a switch between centimetres and inches. The full chart, how to measure yourself, and our kids' and bridal notes are on the ",
            link("/size-guide", "Size guide"),
            " page.",
          ),
        ),
        qa(
          "I'm between two sizes. Which should I choose?",
          p(
            "Take the larger. A piece can be taken in neatly; it cannot always be let out. If you would rather it fit you exactly, choose made to measure where the piece offers it.",
          ),
        ),
        qa(
          "How should I take my measurements?",
          p(
            "Measure over the underwear you will wear with the piece, with a soft tape held snug but not tight: bust at the fullest point, waist at the narrowest, hip at the fullest. The ",
            link("/size-guide", "Size guide"),
            " walks through each one. If anything is unclear, ask us before you order and we will help.",
          ),
        ),
      ],
    },
    {
      id: "made-to-measure",
      title: "Made to measure",
      intro: "Shop pieces cut to your own measurements.",
      items: [
        qa(
          "Can a shop piece be made to my measurements?",
          p(
            "Many can. On the product page, choose made to measure and enter your bust, waist, hip and the other measurements the piece asks for, in centimetres or inches. We cut the piece to those numbers.",
          ),
          p(when(customLead, (v) => `A made-to-measure shop piece takes about ${v} days to make, before shipping.`)),
        ),
        qa(
          "Does made to measure cost more?",
          p(
            "Not by default. Most pieces carry no made-to-measure surcharge; where one does, the product page shows it before you add the piece to your bag.",
          ),
        ),
        qa(
          "Do I have to enter my measurements every time?",
          p(
            "No. When you are signed in you can reuse measurements saved to your profile, and the measurements from a paid order are saved there for next time. You can see them in ",
            link("/account", "your account"),
            ".",
          ),
        ),
        qa(
          "Can I return a made-to-measure piece?",
          p(
            "Not for a change of mind: a piece cut to your bust, waist and hip cannot be worn by anyone else. If it arrives faulty, or we got something wrong, we will put it right; see ",
            link("#returns", "Returns, exchanges & refunds"),
            ".",
          ),
        ),
      ],
    },
    {
      id: "payments",
      title: "Payments & currencies",
      items: [
        qa(
          "Which currencies can I pay in?",
          p(
            "Our prices are set in Nigerian naira. You can also view and pay in US dollars or British pounds: we convert from naira and lock the rate when you check out, so the amount you see at checkout is the amount you are charged.",
          ),
        ),
        qa(
          "How can I pay?",
          ul(
            ["By card through Paystack or Flutterwave, and through Stripe when you pay in US dollars or pounds"],
            ["Through Monnify, for naira payments"],
            ["By bank transfer, uploading your receipt at checkout"],
          ),
          p("The options shown at checkout depend on your currency."),
        ),
        qa(
          "How does paying by bank transfer work?",
          p(
            "Make the transfer, then upload a photo or PDF of the receipt (up to 5 MB) at checkout. Our team checks it against our account, usually within two to four hours on business days. Your order counts as paid once the transfer is confirmed, and you will hear from us by email.",
          ),
        ),
        qa(
          "Will my bank charge me extra?",
          p(
            "It may. If you pay with a card issued outside Nigeria, any international or foreign-exchange fee your bank adds is between you and your bank, and is not something we can see or refund.",
          ),
        ),
      ],
    },
    {
      id: "delivery",
      title: "Delivery & collection",
      intro: "Lagos courier, collection from the atelier, and the rest of Nigeria.",
      items: [
        qa(
          "How much does delivery in Lagos cost?",
          p(
            "Lagos deliveries go by courier at a flat rate, shown at checkout before you pay. ",
            when(lagosRates, (v) => `Today's rates: ${v}.`),
          ),
          p(when(methods, (v) => `Delivery options currently offered: ${v}.`)),
        ),
        qa(
          "Can I collect my order from the atelier?",
          p(
            "Yes. Choose collection at checkout. When your piece is ready we email you a collection code; bring the code and a matching ID to ",
            address ? `${address}. ` : "our Ajah atelier. ",
            when(hours, (v) => `We are open ${v}. `),
          ),
          p(
            "We keep your piece safe for you. ",
            when(uncollectedDays, (v) => `If it is still waiting after ${v} days we send you a reminder. `),
            "Write to us if you need a different arrangement.",
          ),
        ),
        qa(
          "Do you deliver outside Lagos?",
          p(
            "Yes, across Nigeria (usually by GIG). Because each piece is made to order, we normally confirm the courier and the cost once your piece is packed, and the delivery charge is paid before we dispatch it.",
          ),
        ),
        qa(
          "How do I track my order?",
          ul(
            [
              "Shop orders: follow the status in ",
              link("/account", "your account"),
              ", and we email you the carrier's tracking number once there is one",
            ],
            [
              "Atelier and bridal commissions: use the ",
              link("/track", "tracking page"),
              " with your order reference and email address",
            ],
          ),
        ),
        qa(
          "When will my order arrive?",
          p(
            "Add the delivery time to the making time. ",
            when(production, (v) => `Ready-to-wear is made in ${v}; `),
            "delivery begins once your piece leaves the atelier. Your order emails tell you when it ships.",
          ),
        ),
      ],
    },
    {
      id: "international",
      title: "International orders & duties",
      items: [
        qa(
          "Do you ship internationally?",
          p(
            "Yes, worldwide, usually by DHL. Once your piece is packed we confirm the courier and the cost with you, and the shipping is paid before dispatch.",
          ),
        ),
        qa(
          "Will I pay import duties or taxes?",
          p(
            "Possibly. International orders are sent DDU (delivered duty unpaid). ",
            ddu ||
              "International orders may attract import duties and taxes on arrival, payable by the recipient. These are set by your country's customs authority and are not included in the price.",
          ),
        ),
        qa(
          "Can I pay in dollars or pounds?",
          p(
            "Yes. Choose US dollars or British pounds and we convert from our naira price at a rate locked when you check out. See ",
            link("#payments", "Payments & currencies"),
            ".",
          ),
        ),
        qa(
          "Can I order made to measure from abroad?",
          p(
            "Yes. Enter your measurements on the product page exactly as you would in Lagos. For a bespoke or bridal commission you can also consult virtually, and if you cannot come to fittings we fit the piece on a model close to your size; see ",
            link("#bespoke", "Bespoke & bridal"),
            ".",
          ),
        ),
      ],
    },
    {
      id: "returns",
      title: "Returns, exchanges & refunds",
      intro: "What can come back, what cannot, and what we do when we get it wrong.",
      items: [
        qa(
          "Can I return a piece?",
          p(
            `A standard-size piece may be returned within ${returnDays} days of delivery for an exchange or a credit to your account. It must be unworn, unwashed and unaltered, with its tags. Write to `,
            mail,
            " with your order number and we will arrange it.",
          ),
          p("A change-of-mind return is not refunded in cash. Full details are in our ", link("/returns-policy", "Returns Policy"), "."),
        ),
        qa(
          "What can't be returned?",
          ul(
            ["Made-to-measure shop pieces"],
            ["Atelier (bespoke) commissions"],
            ["Bridal gowns and bridal commissions"],
          ),
          p(
            "Each is cut to your body, so none can be returned for a change of mind. They are still covered if they arrive faulty or if we fail to meet our agreement with you.",
          ),
        ),
        qa(
          "My piece arrived faulty or damaged. What should I do?",
          p(
            faultHours
              ? `Write to us within ${faultHours} hours of delivery, with photographs, at `
              : "Write to us as soon as it arrives, with photographs, at ",
            mail,
            ". We will repair or remake it, or refund you where we cannot offer a reasonable solution.",
          ),
        ),
        qa(
          "When do you give a cash refund?",
          p(
            "When Prudent Gabriel fails to meet the agreement: a piece we could not make, one that did not arrive in good, usable condition, or one not delivered by the agreed date, where we cannot put it right.",
          ),
        ),
        qa(
          "What happens if I paid with Prudent Points?",
          p(
            "If we accept a return or cancel an order paid with points, the points go back to your balance. Points are never paid out as cash.",
          ),
        ),
      ],
    },
    {
      id: "bespoke",
      title: "Bespoke & bridal commissions",
      intro: "Couture made for one person, from first sketch to final fitting.",
      items: [
        qa(
          "How do I start a bespoke or bridal commission?",
          p(
            "Every commission begins with a consultation, and consultations are by invitation. Send us an enquiry on the ",
            link("/consultation", "consultation page"),
            ". If we can take your commission, we email you a personal link to book your consultation.",
          ),
        ),
        qa(
          "What will you ask in the enquiry?",
          ul(
            ["The occasion, and the date you need the piece"],
            ["How many outfits you would like"],
            ["Where you are based"],
            ["Whether you can come to fittings in person"],
            ["Your colour palette, and any inspiration pictures"],
          ),
        ),
        qa(
          "What happens after the consultation?",
          p(
            "We send you a quotation. ",
            when(validityDays, (v) => `It is valid for ${v} days unless it states another date. `),
            "Production begins once the deposit on the quotation is recorded (commonly 70%, and always stated on the quotation). The balance is due before delivery or collection. You may pay in parts, with a minimum of ₦10,000 per payment unless you are paying the full balance.",
          ),
        ),
        qa(
          "What are the stages of a commission?",
          p("There are thirteen, and you can follow each one on the ", link("/track", "tracking page"), ":"),
          ul(
            ["Consultation booking"],
            ["Consultation session"],
            ["Invoice issuance"],
            ["Consultation fee"],
            ["Sketching & concept"],
            ["Fabric sourcing"],
            ["Design approval"],
            ["Tailoring"],
            ["First fitting"],
            ["Alterations"],
            ["Beading & finishing"],
            ["Final fitting"],
            ["Delivery or collection"],
          ),
          p("You approve the design and the final fitting yourself, through a link we send you."),
        ),
        qa(
          "I can't attend fittings in person. Can you still make my piece?",
          p(
            "Yes. Tell us in your enquiry. We fit the piece on a model of a size close to yours, and you approve the design and the final fitting through links we send you.",
          ),
        ),
        qa(
          "How early should I begin a bridal gown?",
          p(
            "As early as you can. Four to six months before the wedding is a comfortable time to start, because a bridal commission includes fittings and hand finishing. If your event is within 30 days, your enquiry is flagged for a call: an express commission may be possible, and is agreed by phone.",
          ),
        ),
        qa(
          "What if the piece needs adjusting after I receive it?",
          p(
            warrantyDays
              ? `After you confirm receipt, you have ${warrantyDays} days of complimentary alterations for fit and workmanship. `
              : "After you confirm receipt, alterations for fit and workmanship are complimentary within the window stated on your invoice. ",
            "A change you ask for later, or damage, is chargeable.",
          ),
        ),
        qa(
          "Do you make occasion wear for children?",
          p(
            "Yes, through Prudential Kids. Shop the ",
            link("/kids", "kids' collection"),
            ", or commission a bespoke piece through the atelier for a birthday, dedication, flower girl or traditional ceremony.",
          ),
        ),
      ],
    },
    {
      id: "consultations",
      title: "Consultations",
      items: [
        qa(
          "What kinds of consultation are there?",
          fees
            ? ul(
                [`In person with Mrs. Prudent and the creative team, up to 90 minutes: ${naira(fees.physicalPrudent)}`],
                [`In person with the creative team, 60 minutes: ${naira(fees.physicalTeam)}`],
                [`Virtual with Mrs. Prudent, 60 minutes: ${naira(fees.virtualPrudent)}`],
                [`Virtual with the creative team, 45 minutes: ${naira(fees.virtualTeam)}`],
              )
            : ul(
                ["In person with Mrs. Prudent and the creative team, up to 90 minutes"],
                ["In person with the creative team, 60 minutes"],
                ["Virtual with Mrs. Prudent, 60 minutes"],
                ["Virtual with the creative team, 45 minutes"],
              ),
          p(
            "In-person consultations are held at our Ajah atelier. Fees are set in naira; you can pay in US dollars or pounds at the rate locked when you book.",
          ),
        ),
        qa(
          "How do I choose a date?",
          p(
            "Your booking link asks you to propose three dates, each at least three days away. We confirm one against Mrs. Prudent's diary, usually within 24 to 48 hours.",
          ),
        ),
        qa(
          "Is the consultation fee refundable?",
          p(
            "The fee is non-refundable and is not credited towards the commission. It is returned only if we cancel and cannot offer you another date.",
          ),
        ),
        qa(
          "Can I cancel or reschedule my consultation?",
          p(
            "To cancel, use ",
            link("/account", "your account"),
            " at least 48 hours before the consultation. To reschedule, write to ",
            mail,
            " at least 48 hours before.",
          ),
        ),
      ],
    },
    {
      id: "points",
      title: "Prudent Points & referrals",
      intro: "Our loyalty programme, in plain numbers.",
      items: [
        qa(
          "How do I earn Prudent Points?",
          p(
            perTen && spendUnit
              ? `You earn ${perTen} ${perTen === "1" ? "point" : "points"} for every ₦${spendUnit} you spend in cash on shop orders. `
              : "You earn points on what you spend in cash on shop orders. ",
            atelierPer100 ? `Atelier commissions earn ${atelierPer100} points for every ₦100 you pay. ` : "",
          ),
          p("There are bonus points too:"),
          ul(
            bonus.review > 0 ? [`${count(bonus.review)} points for a product review`] : null,
            bonus.newsletter > 0 ? [`${count(bonus.newsletter)} points for joining the newsletter`] : null,
            bonus.styleProfile > 0 ? [`${count(bonus.styleProfile)} points for completing your style profile`] : null,
            bonus.birthday > 0
              ? [`${count(bonus.birthday)} points on your birthday, once a year, if you add your birthday to your account`]
              : null,
            referral ? [`${referral} points when a friend you referred has their first shop order paid`] : null,
          ),
        ),
        qa(
          "What are my points worth, and how do I use them?",
          p(
            when(pointRate, (v) => `Each point is worth ₦${v}. `),
            when(minRedeem, (v) => `You can redeem once you have at least ${v} points, `) ??
              "You can redeem your points ",
            "at checkout against the price of your pieces. Points cannot pay for shipping.",
          ),
        ),
        qa(
          "Do points expire?",
          p(
            expiry
              ? `Yes. Each credit of points expires ${expiry} months after it was added, and we send you a reminder before it does.`
              : "Points can expire; we send you a reminder before they do.",
          ),
        ),
        qa(
          "How do referrals work?",
          p(
            "Share your referral link from ",
            link("/account", "your account"),
            ". ",
            referral
              ? `When your friend's first shop order is paid, you receive ${referral} points.`
              : "When your friend's first shop order is paid, you receive referral points.",
          ),
        ),
        qa(
          "What are the tiers?",
          facts.tiers
            ? p(
                `Your tier follows what you pay us in a calendar year: Bronze for every client, Silver from ₦${count(facts.tiers.silver)}, Gold from ₦${count(facts.tiers.gold)} and Platinum from ₦${count(facts.tiers.platinum)}. A tier you reach lasts for the rest of that year and all of the next. You can see yours, and its perks, in your account.`,
              )
            : p("Your tier (Bronze, Silver, Gold or Platinum) follows what you pay us in a calendar year. You can see yours in your account."),
        ),
      ],
    },
    {
      id: "account",
      title: "Your account & privacy",
      items: [
        qa(
          "I checked out as a guest. Do I have an account?",
          p(
            "Yes. Paying opens an account for your email address, and we send a welcome email with a link to choose your password. The link works once, for seven days; after that, use Forgot password on the sign-in page.",
          ),
        ),
        qa(
          "Why can't I see an earlier order or consultation in my account?",
          p(
            "New accounts confirm their email address through a link we send, which lasts 24 hours. Until you confirm it, anything filed under that email before you signed up (guest orders, consultations, commissions and chats) stays out of your account. Once confirmed, it all appears. If the link has expired, you can ask for a new one.",
          ),
        ),
        qa(
          "Can I sign in with Google?",
          p("Where the Google button appears on the sign-in page, yes. Otherwise use your email and password."),
        ),
        qa(
          "How do I get a copy of my data, or delete my account?",
          p(
            "From your ",
            link("/account", "account settings"),
            ", or write to us at ",
            mail,
            ". Our ",
            link("/privacy-policy", "Privacy Policy"),
            " explains what we keep and why.",
          ),
        ),
        qa(
          "Will you send me marketing emails?",
          p(
            "Only if you opt in. Every marketing email has a one-click unsubscribe link. Emails about your orders, consultations and commissions are sent regardless, because they are part of the service.",
          ),
        ),
      ],
    },
    {
      id: "care",
      title: "Care & contact",
      items: [
        qa(
          "How should I care for my piece?",
          p(
            "The fabric and care details are in each product description. When in doubt, dry clean, or ask us and we will tell you what the fabric needs. Beaded and embellished pieces are best stored flat or on a padded hanger, away from direct sun.",
          ),
        ),
        qa(
          "How can I reach you?",
          p(
            "Email ",
            mail,
            ", use the live chat on the site while we are open (when we are closed, we reply by email), or use the form on our ",
            link("/contact", "contact page"),
            ".",
          ),
        ),
        qa(
          "Where is the atelier, and when is it open?",
          p(address ? `${address}. ` : "Ajah, Lagos. ", when(hours, (v) => `${v}.`)),
          p("Consultations are by invitation and appointment; for anything else, write before you visit so we are ready for you."),
        ),
      ],
    },
  ];

  const used = new Set<string>();
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    intro: section.intro,
    items: section.items
      .filter((draft) => draft.a.length > 0)
      .map((draft) => {
        let id = `q-${slug(draft.q)}`;
        for (let n = 2; used.has(id); n++) id = `q-${slug(draft.q)}-${n}`;
        used.add(id);
        return { id, q: draft.q, a: draft.a, plain: faqPlainText(draft.a) };
      }),
  }));
}
