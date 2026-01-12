import { describe, it, expect } from 'vitest';
import {
  normalizeString,
  stringsEqual,
  stringContains,
  capitalize,
  truncate,
} from '../../utils/string.js';

describe('String Utils', () => {
  describe('normalizeString', () => {
    it('should return empty string for null/undefined', () => {
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
    });

    it('should lowercase and remove non-alphanumeric chars', () => {
      expect(normalizeString('Hello World!')).toBe('helloworld');
      expect(normalizeString('Test-123')).toBe('test123');
      expect(normalizeString('  spaces  ')).toBe('spaces');
    });

    it('should convert numbers to string', () => {
      expect(normalizeString(123)).toBe('123');
    });
  });

  describe('stringsEqual', () => {
    it('should return true for equal strings (case-insensitive)', () => {
      expect(stringsEqual('Hello', 'hello')).toBe(true);
      expect(stringsEqual('Test-123', 'test123')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(stringsEqual('Hello', 'World')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(stringsEqual(null, null)).toBe(true);
      expect(stringsEqual(null, 'test')).toBe(false);
    });
  });

  describe('stringContains', () => {
    it('should return true when string contains substring', () => {
      expect(stringContains('Hello World', 'world')).toBe(true);
      expect(stringContains('Testing', 'TEST')).toBe(true);
    });

    it('should return false when string does not contain substring', () => {
      expect(stringContains('Hello', 'World')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(stringContains(null, 'test')).toBe(false);
      expect(stringContains('test', null)).toBe(false);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
      expect(capitalize(null)).toBe('');
    });

    it('should keep rest of string unchanged', () => {
      expect(capitalize('hELLO')).toBe('HELLO');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should use custom suffix', () => {
      expect(truncate('Hello World', 9, '…')).toBe('Hello Wo…');
    });

    it('should handle null/undefined', () => {
      expect(truncate(null, 10)).toBe('');
      expect(truncate(undefined, 10)).toBe('');
    });
  });
});
