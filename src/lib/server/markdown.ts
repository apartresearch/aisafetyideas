import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

marked.setOptions({ gfm: true, breaks: true });

// Defense-in-depth: any link that opens a new tab must not reach window.opener (reverse-tabnabbing).
// Registered once at module load (DOMPurify is a singleton in isomorphic-dompurify).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Render user-authored Markdown to SANITIZED HTML, server-side.
 * Lives under $lib/server so the heavy deps never ship to the browser.
 * DOMPurify's default HTML profile strips <script>, on* handlers, and javascript:/data: URLs; on top of that we
 * forbid interactive form controls (phishing) and the style attribute (CSS clickjacking / UI-redressing).
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  const html = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'fieldset', 'style'],
    FORBID_ATTR: ['style']
  });
}
