/**
 * String manipulation utilities
 * @module utils/string
 */

/**
 * Normalize a string for comparison
 * @param {string} str - String to normalize
 * @returns {string} Normalized lowercase string with only alphanumeric characters
 */
export function normalizeString(str) {
  if (!str) {
    return '';
  }
  return str.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if two strings are equal (case-insensitive, normalized)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {boolean} True if strings are equal after normalization
 */
export function stringsEqual(str1, str2) {
  return normalizeString(str1) === normalizeString(str2);
}

/**
 * Check if str1 contains str2 (case-insensitive)
 * @param {string} str1 - String to search in
 * @param {string} str2 - String to search for
 * @returns {boolean} True if str1 contains str2
 */
export function stringContains(str1, str2) {
  if (!str1 || !str2) {
    return false;
  }
  return str1.toLowerCase().includes(str2.toLowerCase());
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  if (!str) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} [suffix='...'] - Suffix to add when truncated
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength, suffix = '...') {
  if (!str || str.length <= maxLength) {
    return str || '';
  }
  return str.slice(0, maxLength - suffix.length) + suffix;
}
