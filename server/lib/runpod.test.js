import { describe, it, expect } from 'vitest';
import { extractToken } from './runpod.js';

describe('extractToken', () => {
  it('returns undefined for empty chunk', () => {
    expect(extractToken('')).toBeUndefined();
  });

  it('returns null for [DONE]', () => {
    expect(extractToken('[DONE]')).toBeNull();
  });

  it('extracts token from OpenAI format delta.content', () => {
    const chunk = JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] });
    expect(extractToken(chunk)).toBe('Hello');
  });

  it('extracts token from RunPod output format', () => {
    const chunk = JSON.stringify({ output: 'world' });
    expect(extractToken(chunk)).toBe('world');
  });

  it('extracts token from response field', () => {
    const chunk = JSON.stringify({ response: 'foo' });
    expect(extractToken(chunk)).toBe('foo');
  });

  it('returns undefined for invalid JSON', () => {
    expect(extractToken('not json')).toBeUndefined();
  });

  it('returns undefined for JSON without known fields', () => {
    const chunk = JSON.stringify({ unknown: 'data' });
    expect(extractToken(chunk)).toBeUndefined();
  });
});
