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
