import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ gfm: true, breaks: true });

/**
 * Render user-authored Markdown to SANITIZED HTML, server-side.
 * Lives under $lib/server so the heavy deps never ship to the browser.
 *
 * Sanitizer: `sanitize-html` (pure JS, htmlparser2). We deliberately do NOT use a
 * DOMPurify/jsdom stack here — jsdom's transitive deps break under Vercel's serverless
 * bundler (ERR_REQUIRE_ESM from html-encoding-sniffer → @exodus/bytes), which 500'd every
 * markdown-rendering route in production. `sanitize-html` has no DOM dependency and runs
 * identically locally and in the function.
 *
 * Posture (allowlist): drop <script>/<style> and their text, strip all on* handlers, allow
 * only http/https/mailto URLs (so javascript:/data: links are neutralized), forbid interactive
 * form controls (phishing) and the style attribute (CSS clickjacking / UI-redressing). Any link
 * that opens a new tab gets rel="noopener noreferrer" (reverse-tabnabbing defense).
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  const html = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'blockquote',
      'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre', 'sup', 'sub',
      'a', 'img',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      code: ['class'], // marked emits class="language-xx" for fenced blocks
      th: ['align'],
      td: ['align']
    },
    // http/https/mailto only — javascript: and data: hrefs are dropped (link text kept)
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    // style attr is not in any allowlist above, so it is already stripped; being explicit is cheap
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target) attribs.rel = 'noopener noreferrer';
        return { tagName, attribs };
      }
    }
  });
}
