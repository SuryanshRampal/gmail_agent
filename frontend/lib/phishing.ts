export type LinkRisk = "low_risk" | "suspicious";
export type ContentScan = { riskLevel: "low_risk" | "needs_attention" | "high_risk"; links: Array<{ url: string; risk: LinkRisk }>; suspiciousLinks: string[]; reasons: string[] };

const HREF_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const SHORTENERS = new Set(["bit.ly", "t.co", "tinyurl.com", "goo.gl", "is.gd", "ow.ly", "rb.gy", "cutt.ly"]);

function suspicious(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return Boolean(parsed.username || parsed.password || host.startsWith("xn--") || host.split(".").some((part) => part.startsWith("xn--")) || SHORTENERS.has(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /(?:login|verify|validation|password|credential|payment|wallet|security-check)/i.test(`${host}${parsed.pathname}`));
  } catch {
    return true;
  }
}

export function scanEmailContent(html = "", text = ""): ContentScan {
  const found = new Set<string>();
  for (const match of html.matchAll(HREF_RE)) found.add(match[1]);
  for (const match of text.matchAll(URL_RE)) found.add(match[0].replace(/[.,;:!?)]}]+$/, ""));
  const links = [...found].map((url) => ({ url, risk: suspicious(url) ? "suspicious" as const : "low_risk" as const }));
  const suspiciousLinks = links.filter((link) => link.risk === "suspicious").map((link) => link.url);
  const content = `${text}\n${html.replace(/<[^>]*>/g, " ")}`.slice(0, 12000);
  const reasons: string[] = [];
  if (suspiciousLinks.length) reasons.push(`${suspiciousLinks.length} link${suspiciousLinks.length === 1 ? "" : "s"} has an unusual or potentially unsafe destination.`);
  if (/\b(?:verify your account|unusual activity|account suspended|urgent action|act now|last warning)\b/i.test(content)) reasons.push("The message uses urgency or account-security language.");
  if (/\b(?:password|one[- ]time password|otp|verification code|bank details|card details|login credentials)\b/i.test(content)) reasons.push("The message appears to request credentials or payment information.");
  const contentSignals = reasons.length - (suspiciousLinks.length ? 1 : 0);
  const highRisk = suspiciousLinks.length >= 2 || (suspiciousLinks.length >= 1 && contentSignals >= 1);
  return { riskLevel: highRisk ? "high_risk" : reasons.length ? "needs_attention" : "low_risk", links, suspiciousLinks, reasons };
}
