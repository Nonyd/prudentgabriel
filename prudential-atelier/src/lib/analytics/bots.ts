const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|facebot|whatsapp|telegram|preview|lighthouse|pagespeed|pingdom|gtmetrix|headlesschrome|phantomjs|python-requests|curl|wget|go-http-client|httpie|scrapy|semrush|ahrefs|dotbot|petalbot|bytespider|gptbot|claudebot|anthropic|perplexity|applebot|yandex/i;

export function isKnownBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  if (!ua) return true;
  return BOT_UA.test(ua);
}
