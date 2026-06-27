/**
 * Strip obvious PII before persistence to non-prod stores.
 * Heuristic only — not full redaction. Use for analytics/feedback/conversation exports.
 *
 * Ordering matters: URL → email → gid → order id → IBAN → credit card → IPv4 → phone → shop domain.
 * Run more-specific patterns before broader ones (e.g., IPv4 before phone — phone's
 * digit-with-separators rule would otherwise eat dotted IPs).
 */

const REGEX_URL = /https?:\/\/\S+/g
const REGEX_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const REGEX_SHOPIFY_GID = /gid:\/\/shopify\/[A-Za-z0-9]+\/\d+/g
const REGEX_ORDER_HASH = /#\d{3,}/g
const REGEX_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g
// Credit card: 13–19 digits in groups separated by space/hyphen, or 13–19 unbroken digits.
const REGEX_CREDIT_CARD = /\b(?:\d[ -]?){12,18}\d\b/g
const REGEX_PHONE = /\+?\d[\d\s().-]{7,}\d/g
const REGEX_IPV4 = /\b(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}\b/g
const REGEX_MYSHOPIFY = /\b[a-z0-9][a-z0-9-]*\.myshopify\.com\b/gi

export function redactPii(s: string): string {
  if (!s) return s
  return s
    .replace(REGEX_URL, '[url]')
    .replace(REGEX_EMAIL, '[email]')
    .replace(REGEX_SHOPIFY_GID, '[gid]')
    .replace(REGEX_ORDER_HASH, '[order-id]')
    .replace(REGEX_IBAN, '[iban]')
    .replace(REGEX_CREDIT_CARD, '[card]')
    .replace(REGEX_IPV4, '[ip]')
    .replace(REGEX_PHONE, '[phone]')
    .replace(REGEX_MYSHOPIFY, '[shop]')
}
