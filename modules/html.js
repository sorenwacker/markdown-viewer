// Escape text before interpolating it into an innerHTML template string, so
// file names/paths containing HTML metacharacters cannot break markup or inject
// nodes.
export function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sanitize rendered markdown HTML before inserting it into the DOM. The HTML
// comes from marked (no built-in sanitizer) and may contain raw HTML from an
// untrusted markdown file. DOMPurify is loaded as a vendored script in
// renderer.html.
//
// The default DOMPurify URI allow-list permits http(s), data: (on images), and
// relative URLs but not file:. This viewer rewrites relative image sources to
// absolute file:// URLs (see resolveImageSrc in main.js), so file: is added to
// the allow-list to let local embedded images load.
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|file|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

export function sanitizeHtml(html) {
  return window.DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP });
}
