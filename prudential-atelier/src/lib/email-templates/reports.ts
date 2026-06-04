const WRAPPER = (title: string, body: string, ctaHref?: string, ctaLabel?: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#F0E8DD;font-family:Montserrat,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#F7F2EC;border:1px solid #D4BBAC;padding:32px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#98755B;">Prudential Atelier</p>
      <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:24px;color:#442913;">${title}</h1>
      ${body}
      ${
        ctaHref && ctaLabel
          ? `<p style="margin-top:28px;"><a href="${ctaHref}" style="display:inline-block;background:#5C3422;color:#E2D1C2;padding:12px 24px;text-decoration:none;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">${ctaLabel}</a></p>`
          : ""
      }
    </div>
  </div>
</body>
</html>`;

export function reportEmailHtml(title: string, sections: { heading: string; html: string }[], appUrl: string) {
  const body = sections
    .map(
      (s) => `
    <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #D4BBAC;">
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:18px;color:#442913;">${s.heading}</h2>
      <div style="font-size:14px;line-height:1.6;color:#5C3422;">${s.html}</div>
    </div>`,
    )
    .join("");

  return WRAPPER(title, body, `${appUrl}/admin/reports`, "View full report");
}

export function eventReminderEmailHtml(params: {
  firstName: string;
  eventLabel: string;
  weeksAway: number;
  appUrl: string;
}) {
  const body = `
    <p style="font-size:14px;line-height:1.6;color:#5C3422;">
      Hi ${params.firstName}, your <strong>${params.eventLabel}</strong> is about ${params.weeksAway} week${params.weeksAway !== 1 ? "s" : ""} away.
      Whether you need a bespoke piece or something from our collection, we'd love to dress you for the occasion.
    </p>`;
  return WRAPPER(`${params.eventLabel} is coming up`, body, `${params.appUrl}/consultation`, "Book a Consultation");
}

export function restockEmailHtml(productName: string, size: string, shopUrl: string) {
  const body = `<p style="font-size:14px;color:#5C3422;"><strong>${productName}</strong> in size ${size} is back in stock.</p>`;
  return WRAPPER("Back in stock", body, shopUrl, "Shop Now");
}
