import { describe, it, expect } from 'vitest';
import { arraysOverlap, unique, groupBy, chunk } from '../../utils/array.js';

describe('Array Utils', () => {
  describe('arraysOverlap', () => {
    it('should return true when arrays have common elements', () => {
      expect(arraysOverlap([1, 2, 3], [3, 4, 5])).toBe(true);
      expect(arraysOverlap(['a', 'b'], ['B', 'c'])).toBe(true); // case-insensitive
    });

    it('should return false when arrays have no common elements', () => {
      expect(arraysOverlap([1, 2], [3, 4])).toBe(false);
      expect(arraysOverlap(['a', 'b'], ['c', 'd'])).toBe(false);
    });

    it('should handle single values as arrays', () => {
      expect(arraysOverlap('test', ['test', 'other'])).toBe(true);
      expect(arraysOverlap(['test'], 'test')).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(arraysOverlap(null, [1, 2])).toBe(false);
      expect(arraysOverlap([1, 2], null)).toBe(false);
    });

    it('should use custom comparison function', () => {
      const compareFn = (a, b) => a.id === b.id;
      expect(
        arraysOverlap([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], compareFn)
      ).toBe(true);
    });
  });

  describe('unique', () => {
    it('should remove duplicate values', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    it('should use key function for objects', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 1 }];
      expect(unique(arr, (item) => item.id)).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should return empty array for invalid input', () => {
      expect(unique(null)).toEqual([]);
      expect(unique('not an array')).toEqual([]);
    });
  });

  describe('groupBy', () => {
    it('should group items by key function', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = groupBy(items, (item) => item.type);
      expect(result).toEqual({
        a: [
          { type: 'a', value: 1 },
          { type: 'a', value: 3 },
        ],
        b: [{ type: 'b', value: 2 }],
      });
    });

    it('should group items by property name', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
      ];
      expect(groupBy(items, 'type')).toEqual({
        a: [{ type: 'a', value: 1 }],
        b: [{ type: 'b', value: 2 }],
      });
    });

    it('should return empty object for invalid input', () => {
      expect(groupBy(null, 'type')).toEqual({});
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([1, 2, 3, 4], 2)).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it('should return single chunk for small arrays', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it('should return empty array for invalid input', () => {
      expect(chunk(null, 2)).toEqual([]);
      expect(chunk([1, 2], 0)).toEqual([]);
      expect(chunk([1, 2], -1)).toEqual([]);
    });
  });
});
