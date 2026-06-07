import { describe, it, expect } from 'vitest';
import { normalizeTranscript } from './transcript-normalize';

describe('normalizeTranscript', () => {
  it('returns empty string for falsy / whitespace-only input', () => {
    expect(normalizeTranscript('')).toBe('');
    expect(normalizeTranscript('   ')).toBe('');
    expect(normalizeTranscript('\n\t')).toBe('');
  });

  it('capitalizes first letter and adds period for plain statement', () => {
    expect(normalizeTranscript('holidays this is my first time to speak'))
      .toBe('Holidays this is my first time to speak.');
  });

  it('adds question mark when sentence starts with question word', () => {
    expect(normalizeTranscript('where are you from')).toBe('Where are you from?');
    expect(normalizeTranscript('how about tomorrow')).toBe('How about tomorrow?');
  });

  it('keeps existing punctuation untouched', () => {
    expect(normalizeTranscript('Holidays, this is my first time to speak.'))
      .toBe('Holidays, this is my first time to speak.');
  });

  it('preserves contractions without breaking sentence', () => {
    expect(normalizeTranscript("it's been a while")).toBe("It's been a while.");
  });

  it('keeps mid-sentence comma and adds trailing period', () => {
    expect(normalizeTranscript("well, that's interesting"))
      .toBe("Well, that's interesting.");
  });

  it('collapses extra whitespace', () => {
    expect(normalizeTranscript('hello   everyone')).toBe('Hello everyone.');
    expect(normalizeTranscript('  hello\n\tworld  ')).toBe('Hello world.');
  });

  it('splits multi-sentence input and capitalizes each sentence', () => {
    expect(normalizeTranscript('hello everyone. how are you'))
      .toBe('Hello everyone. How are you?');
  });

  it('does not append punctuation when input already ends with !', () => {
    expect(normalizeTranscript('thanks a lot!')).toBe('Thanks a lot!');
  });

  it('handles leading apostrophe-starting word safely', () => {
    expect(normalizeTranscript("'cause i said so")).toBe("'cause i said so.");
  });
});
