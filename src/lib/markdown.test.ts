import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './server/markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('**bold** and [link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://example.com"');
  });
  it('strips <script>', () => {
    const html = renderMarkdown('hi <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
  it('strips event handlers and javascript: urls', () => {
    const html = renderMarkdown('<a href="javascript:alert(1)" onclick="x()">x</a>');
    expect(html).not.toContain('onclick');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });
  it('strips onerror on a SURVIVING <img> (the real boundary case)', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).toContain('<img');                 // the element survives DOMPurify's html profile…
    expect(html.toLowerCase()).not.toContain('onerror'); // …but the handler attribute is stripped
  });
  it('strips form controls (phishing) and the style attribute (clickjacking)', () => {
    const f = renderMarkdown('<form action="https://evil"><input name="x"></form>');
    expect(f.toLowerCase()).not.toContain('<form');
    expect(f.toLowerCase()).not.toContain('<input');
    const s = renderMarkdown('<a href="https://x" style="position:fixed;inset:0">x</a>');
    expect(s).not.toContain('style=');
  });
  it('neutralizes data:text/html links', () => {
    const html = renderMarkdown('[x](data:text/html,<script>alert(1)</script>)');
    expect(html.toLowerCase()).not.toContain('data:text/html');
  });
  it('empty/nullish → empty string', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});

describe('renderMarkdown — LaTeX/MathML', () => {
  it('renders inline math ($E = mc^2$) as MathML', () => {
    const html = renderMarkdown('$E = mc^2$');
    expect(html).toContain('<math');
    // KaTeX expands mc^2 into individual mi/mn elements; check key content is present
    expect(html).toContain('<mi>m</mi>');
    expect(html).toContain('<mi>c</mi>');
    // Must not leave the raw dollar-sign syntax in the output
    expect(html).not.toContain('$E = mc^2$');
  });

  it('renders display/block math ($$...$$) with display="block"', () => {
    const html = renderMarkdown('$$\\int_0^1 x\\,dx$$');
    expect(html).toContain('<math');
    expect(html).toContain('display="block"');
  });

  it('security: onerror alongside math is still stripped', () => {
    const html = renderMarkdown('$x$ <img src=x onerror=alert(1)>');
    // Math renders
    expect(html).toContain('<math');
    // XSS attribute is stripped
    expect(html.toLowerCase()).not.toContain('onerror');
  });

  it('security: javascript: URL is still neutralized when math is present', () => {
    const html = renderMarkdown('$y=x$ [link](javascript:alert(1))');
    expect(html).toContain('<math');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });

  it('security: <script> is still stripped when math is present', () => {
    const html = renderMarkdown('$z^2$ <script>alert(1)</script>');
    expect(html).toContain('<math');
    expect(html).not.toContain('<script>');
  });

  it('security: style attribute is not injected by KaTeX error span', () => {
    // KaTeX error path wraps in <span class="katex-error" style="color:#cc0000">
    // The style must be stripped by sanitize-html
    const html = renderMarkdown('$\\frac{1}{$');
    expect(html).not.toContain('style=');
    // Does not throw — returns a string (throwOnError:false)
    expect(typeof html).toBe('string');
  });

  it('malformed math does not throw and returns a string', () => {
    expect(() => renderMarkdown('$\\frac{1}{$')).not.toThrow();
    expect(typeof renderMarkdown('$\\frac{1}{$')).toBe('string');
  });

  it('plain markdown without math still renders correctly', () => {
    const html = renderMarkdown('## Heading\n\n**bold** _italic_');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });
});
