/**
 * sanitize.js
 * Single responsibility: Strips <script> tags and inline on* event handlers.
 */

/**
 * Sanitizes input HTML string by removing all <script> elements and inline on* event attributes.
 * @param {string} rawHtml - The raw HTML string.
 * @returns {string} Sanitized HTML string.
 */
export function sanitizeHtml(rawHtml) {
  if (typeof rawHtml !== 'string') {
    return '';
  }

  // 1. Remove <script> tags and any content between them (case-insensitive, multiline)
  let cleaned = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Also remove any orphaned or self-closing <script ... /> tags
  cleaned = cleaned.replace(/<script\b[^>]*\/?>/gi, '');

  // 3. Remove inline on* handlers (e.g. onclick="...", onerror='...', onload=...)
  cleaned = cleaned.replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 4. Remove javascript: pseudo-protocols in href or src attributes
  cleaned = cleaned.replace(/\s+(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');

  return cleaned;
}
