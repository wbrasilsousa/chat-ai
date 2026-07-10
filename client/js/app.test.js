import { describe, it, expect } from 'vitest';
import { formatMarkdown } from './markdown.js';

describe('formatMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(formatMarkdown('')).toBe('');
  });

  it('escapes HTML in plain text', () => {
    const result = formatMarkdown('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('converts inline code with backticks', () => {
    const result = formatMarkdown('use `code` here');
    expect(result).toContain('<code>code</code>');
  });

  it('converts code block with language', () => {
    const result = formatMarkdown('```js\nconsole.log(1)\n```');
    expect(result).toContain('<pre><code class="language-js">');
    expect(result).toContain('console.log(1)');
  });

  it('sanitizes malicious language in code block', () => {
    const result = formatMarkdown('```" onfocus="alert(1)\ncode\n```');
    expect(result).not.toContain('language-"');
    expect(result).toContain('language-text');
    expect(result).toContain('" onfocus="alert(1)');
  });

  it('converts bold text', () => {
    const result = formatMarkdown('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('converts italic text', () => {
    const result = formatMarkdown('*italic*');
    expect(result).toContain('<em>italic</em>');
  });

  it('converts newlines to <br>', () => {
    const result = formatMarkdown('line1\nline2');
    expect(result).toContain('<br>');
  });

  it('handles text without markdown', () => {
    const result = formatMarkdown('hello world');
    expect(result).toBe('hello world');
  });
});
