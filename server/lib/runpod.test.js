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

  it('extracts token from non-streaming message.content', () => {
    const chunk = JSON.stringify({ choices: [{ message: { content: 'resposta completa' }, finish_reason: 'stop' }] });
    expect(extractToken(chunk)).toBe('resposta completa');
  });

  it('extracts token from legacy completions text field', () => {
    const chunk = JSON.stringify({ choices: [{ text: 'legacy output' }] });
    expect(extractToken(chunk)).toBe('legacy output');
  });

  it('returns empty string for delta.content with empty string', () => {
    const chunk = JSON.stringify({ choices: [{ delta: { content: '' } }] });
    expect(extractToken(chunk)).toBe('');
  });

  it('returns undefined for null chunk', () => {
    expect(extractToken(null)).toBeUndefined();
  });

  it('returns undefined for undefined chunk', () => {
    expect(extractToken(undefined)).toBeUndefined();
  });
});
