/**
 * Array manipulation utilities
 * @module utils/array
 */

/**
 * Check if two arrays have any overlapping elements
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @param {Function|boolean} [compareFn] - Optional comparison function or boolean for partial matching
 * @returns {boolean} True if arrays have overlapping elements
 */
export function arraysOverlap(arr1, arr2, compareFn = null) {
  if (!arr1 || !arr2) {
    return false;
  }

  const normalizedArr1 = Array.isArray(arr1) ? arr1 : [arr1];
  const normalizedArr2 = Array.isArray(arr2) ? arr2 : [arr2];

  // Handle boolean parameter for partial matching
  const allowPartialMatch = compareFn === true;
  const hasCustomCompareFn = typeof compareFn === 'function';

  if (hasCustomCompareFn) {
    return normalizedArr1.some((item1) =>
      normalizedArr2.some((item2) => compareFn(item1, item2))
    );
  }

  // Exact match check
  const set1 = new Set(normalizedArr1.map((item) => String(item).toLowerCase().trim()));
  const set2 = new Set(normalizedArr2.map((item) => String(item).toLowerCase().trim()));
  
  for (const item of set1) {
    if (set2.has(item)) {
      return true;
    }
  }

  // Partial match check for medical compound terms
  if (allowPartialMatch) {
    for (const item1 of set1) {
      for (const item2 of set2) {
        // Check if either term contains the other
        // e.g., "malignant tumors" contains "tumor"
        if (item1.includes(item2) || item2.includes(item1)) {
          return true;
        }
        
        // Check for word-level overlap for compound terms
        // e.g., "malignant tumors" and "tumor" share "tumor" word
        const words1 = item1.split(/\s+/);
        const words2 = item2.split(/\s+/);
        
        for (const word1 of words1) {
          // Only match significant words (length > 3) to avoid false positives
          if (word1.length > 3 && words2.includes(word1)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
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
