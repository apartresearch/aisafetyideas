import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import markedKatex from 'marked-katex-extension';

marked.setOptions({ gfm: true, breaks: true });
marked.use(markedKatex({ throwOnError: false, output: 'mathml', nonStandard: false }));

/**
 * Render user-authored Markdown to SANITIZED HTML, server-side.
 * Lives under $lib/server so the heavy deps never ship to the browser.
 *
 * Sanitizer: `sanitize-html` (pure JS, htmlparser2). We deliberately do NOT use a
 * DOMPurify/jsdom stack here - jsdom's transitive deps break under Vercel's serverless
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
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'span',
      // MathML - produced by KaTeX's mathml output; no style attrs needed
      'math', 'semantics', 'annotation', 'annotation-xml',
      'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext', 'mspace', 'mpadded', 'mphantom',
      'menclose', 'mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup',
      'munder', 'mover', 'munderover', 'mmultiscripts', 'mtable', 'mtr', 'mtd',
      'mlabeledtr', 'mstyle', 'mfenced', 'mglyph', 'mprescripts', 'none'
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      code: ['class'], // marked emits class="language-xx" for fenced blocks
      th: ['align'],
      td: ['align'],
      span: ['class'],
      // MathML structural attrs - no style, no event attrs
      math: ['xmlns', 'display'],
      '*': [
        'mathvariant', 'displaystyle', 'scriptlevel',
        'stretchy', 'fence', 'separator', 'accent', 'accentunder',
        'columnalign', 'rowalign',
        'open', 'close', 'notation',
        'lspace', 'rspace',
        'width', 'height', 'depth', 'voffset',
        'dir', 'class', 'encoding'
      ]
    },
    // http/https/mailto only - javascript: and data: hrefs are dropped (link text kept)
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
