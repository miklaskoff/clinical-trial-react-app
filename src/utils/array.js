/**
 * Array manipulation utilities
 * @module utils/array
 */

/**
 * Check if two arrays have any overlapping elements
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @param {Function} [compareFn] - Optional comparison function
 * @returns {boolean} True if arrays have overlapping elements
 */
export function arraysOverlap(arr1, arr2, compareFn = null) {
  if (!arr1 || !arr2) {
    return false;
  }

  const normalizedArr1 = Array.isArray(arr1) ? arr1 : [arr1];
  const normalizedArr2 = Array.isArray(arr2) ? arr2 : [arr2];

  if (compareFn) {
    return normalizedArr1.some((item1) =>
      normalizedArr2.some((item2) => compareFn(item1, item2))
    );
  }

  const set2 = new Set(normalizedArr2.map((item) => String(item).toLowerCase()));
  return normalizedArr1.some((item) => set2.has(String(item).toLowerCase()));
}

/**
 * Remove duplicates from array
 * @param {Array} arr - Array to deduplicate
 * @param {Function} [keyFn] - Optional function to extract comparison key
 * @returns {Array} Array with duplicates removed
 */
export function unique(arr, keyFn = null) {
  if (!arr || !Array.isArray(arr)) {
    return [];
  }

  if (keyFn) {
    const seen = new Set();
    return arr.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return [...new Set(arr)];
}

/**
 * Group array items by a key
 * @param {Array} arr - Array to group
 * @param {Function|string} keyFn - Function or property name to extract key
 * @returns {Object} Object with items grouped by key
 */
export function groupBy(arr, keyFn) {
  if (!arr || !Array.isArray(arr)) {
    return {};
  }

  const getKey = typeof keyFn === 'function' ? keyFn : (item) => item[keyFn];

  return arr.reduce((groups, item) => {
    const key = getKey(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Chunk array into smaller arrays
 * @param {Array} arr - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array[]} Array of chunks
 */
export function chunk(arr, size) {
  if (!arr || !Array.isArray(arr) || size <= 0) {
    return [];
  }

  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
