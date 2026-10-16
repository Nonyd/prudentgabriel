/** Coarse buckets only. The user-agent string itself is never stored. */
export type UaBuckets = { device: string; browser: string; os: string };

export function uaBuckets(userAgent: string | null | undefined): UaBuckets {
  const ua = userAgent ?? "";

  const tablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua);
  const mobile = !tablet && /mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(ua);
  const device = tablet ? "Tablet" : mobile ? "Mobile" : "Desktop";

  let browser = "Other";
  if (/edg(e|a|ios)?\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/ucbrowser/i.test(ua)) browser = "UC Browser";
  else if (/instagram/i.test(ua)) browser = "Instagram in-app";
  else if (/fban|fbav/i.test(ua)) browser = "Facebook in-app";
  else if (/tiktok|musical_ly|bytedancewebview/i.test(ua)) browser = "TikTok in-app";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/crios|chrome|chromium/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";

  let os = "Other";
  if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { device, browser, os };
}
