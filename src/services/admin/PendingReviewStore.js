/**
 * Pending Review Store
 * LocalStorage-based store for pending drug reviews
 * @module services/admin/PendingReviewStore
 */

const STORAGE_KEY = 'clinical_trial_pending_reviews';

/**
 * @typedef {Object} ReviewItem
 * @property {string} id - Unique review ID
 * @property {string} drugName - Drug name from patient
 * @property {string} patientId - Patient identifier
 * @property {string} trialId - Trial NCT ID
 * @property {string} criterionId - Criterion ID
 * @property {string} matchMethod - How match was made (direct_unverified, ai_fallback)
 * @property {Object|null} aiSuggestion - AI suggestion if available
 * @property {'pending'|'approved'|'rejected'} status - Review status
 * @property {string} createdAt - ISO timestamp
 * @property {Object|null} adminAction - Admin action details
 */

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Pending Review Store - manages pending drug reviews in localStorage
 */
export class PendingReviewStore {
  /**
   * Get all reviews from storage
   * @returns {ReviewItem[]} All reviews
   */
  static getAllReviews() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading pending reviews:', error);
      return [];
    }
  }

  /**
   * Get only pending reviews
   * @returns {ReviewItem[]} Pending reviews
   */
  static getPendingReviews() {
    return this.getAllReviews().filter(r => r.status === 'pending');
  }

  /**
   * Get reviews by status
   * @param {'pending'|'approved'|'rejected'} status - Status to filter by
   * @returns {ReviewItem[]} Filtered reviews
   */
  static getReviewsByStatus(status) {
    return this.getAllReviews().filter(r => r.status === status);
  }

  /**
   * Get a specific review by ID
   * @param {string} id - Review ID
   * @returns {ReviewItem|null} Review or null
   */
  static getReviewById(id) {
    return this.getAllReviews().find(r => r.id === id) || null;
  }

  /**
   * Add a new review
   * @param {Object} reviewData - Review data
   * @returns {ReviewItem} Created review
   */
  static addReview(reviewData) {
    const reviews = this.getAllReviews();
    
    // Check if duplicate exists (same drug, trial, patient)
    const exists = reviews.some(
      r => r.drugName === reviewData.drugName &&
           r.trialId === reviewData.trialId &&
           r.patientId === reviewData.patientId &&
           r.status === 'pending'
    );

    if (exists) {
      console.log('Duplicate review already exists, skipping');
      return reviews.find(
        r => r.drugName === reviewData.drugName &&
             r.trialId === reviewData.trialId &&
             r.patientId === reviewData.patientId &&
             r.status === 'pending'
      );
    }

    const newReview = {
      id: generateId(),
      drugName: reviewData.drugName,
      patientId: reviewData.patientId || 'unknown',
      trialId: reviewData.trialId || reviewData.nctId,
      criterionId: reviewData.criterionId,
      matchMethod: reviewData.matchMethod || 'unknown',
      aiSuggestion: reviewData.aiSuggestion || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      adminAction: null,
    };

    reviews.push(newReview);
    this.#saveReviews(reviews);
    
    return newReview;
  }

  /**
   * Update a review's status
   * @param {string} id - Review ID
   * @param {'pending'|'approved'|'rejected'} status - New status
   * @param {Object} [adminAction] - Admin action details
   * @returns {ReviewItem|null} Updated review or null
   */
  static updateReviewStatus(id, status, adminAction = null) {
    const reviews = this.getAllReviews();
    const index = reviews.findIndex(r => r.id === id);
    
    if (index === -1) {
      return null;
    }

    reviews[index] = {
      ...reviews[index],
      status,
      adminAction: adminAction || {
        action: status,
        timestamp: new Date().toISOString(),
      },
    };

    this.#saveReviews(reviews);
    return reviews[index];
  }

  /**
   * Remove a review
   * @param {string} id - Review ID
   * @returns {boolean} Whether removal was successful
   */
  static removeReview(id) {
    const reviews = this.getAllReviews();
    const filteredReviews = reviews.filter(r => r.id !== id);
    
    if (filteredReviews.length === reviews.length) {
      return false; // Nothing removed
    }

    this.#saveReviews(filteredReviews);
    return true;
  }

  /**
   * Clear all reviews (for testing)
   */
  static clearAllReviews() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get review statistics
   * @returns {Object} Stats object
   */
  static getStats() {
    const reviews = this.getAllReviews();
    return {
      total: reviews.length,
      pending: reviews.filter(r => r.status === 'pending').length,
      approved: reviews.filter(r => r.status === 'approved').length,
      rejected: reviews.filter(r => r.status === 'rejected').length,
    };
  }

  /**
   * Save reviews to storage
   * @param {ReviewItem[]} reviews - Reviews to save
   */
  static #saveReviews(reviews) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    } catch (error) {
      console.error('Error saving pending reviews:', error);
    }
  }
}

export default PendingReviewStore;
