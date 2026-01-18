/**
 * Drug Approval Service
 * Handles admin approval/rejection of drug reviews
 * @module services/admin/DrugApprovalService
 */

import { PendingReviewStore } from './PendingReviewStore.js';

/**
 * Default drug classes for dropdown
 */
export const DRUG_CLASSES = [
  'TNF inhibitor',
  'IL-17 inhibitor',
  'IL-23 inhibitor',
  'IL-12/23 inhibitor',
  'JAK inhibitor',
  'TYK2 inhibitor',
  'PDE4 inhibitor',
  'A3 adenosine receptor agonist',
  'DMARD',
  'Immunosuppressant',
  'Corticosteroid',
  'Biologic (other)',
  'Non-biologic (other)',
  'Investigational drug',
  'Unknown',
];

/**
 * Storage key for approved drugs
 */
const APPROVED_DRUGS_KEY = 'clinical_trial_approved_drugs';

/**
 * Drug Approval Service
 */
export class DrugApprovalService {
  /**
   * Get all approved drugs from storage
   * @returns {Object} Drug name → class mapping
   */
  static getApprovedDrugs() {
    try {
      const data = localStorage.getItem(APPROVED_DRUGS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error reading approved drugs:', error);
      return {};
    }
  }

  /**
   * Add a drug to approved list
   * @param {string} drugName - Drug name to add
   * @param {Object} drugInfo - Drug information
   * @returns {boolean} Success
   */
  static addApprovedDrug(drugName, drugInfo) {
    try {
      const drugs = this.getApprovedDrugs();
      const normalizedName = drugName.toLowerCase().trim();
      
      drugs[normalizedName] = {
        originalName: drugName,
        class: drugInfo.class,
        isBiologic: drugInfo.isBiologic || false,
        approvedAt: new Date().toISOString(),
        approvedBy: drugInfo.approvedBy || 'admin',
        aiSuggested: drugInfo.aiSuggested || false,
      };

      localStorage.setItem(APPROVED_DRUGS_KEY, JSON.stringify(drugs));
      return true;
    } catch (error) {
      console.error('Error adding approved drug:', error);
      return false;
    }
  }

  /**
   * Check if a drug has been approved
   * @param {string} drugName - Drug name to check
   * @returns {Object|null} Drug info or null
   */
  static getApprovedDrug(drugName) {
    const drugs = this.getApprovedDrugs();
    return drugs[drugName.toLowerCase().trim()] || null;
  }

  /**
   * Approve a pending review
   * @param {string} reviewId - Review ID to approve
   * @param {Object} approvalData - Approval details
   * @returns {Object} Result with success status
   */
  static approveReview(reviewId, approvalData) {
    const review = PendingReviewStore.getReviewById(reviewId);
    
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.status !== 'pending') {
      return { success: false, error: 'Review already processed' };
    }

    // Add drug to approved list
    const drugClass = approvalData.drugClass || 
                      approvalData.aiSuggestion?.class || 
                      review.aiSuggestion?.class || 
                      'Unknown';

    const drugAdded = this.addApprovedDrug(review.drugName, {
      class: drugClass,
      isBiologic: approvalData.isBiologic || false,
      approvedBy: approvalData.adminId || 'admin',
      aiSuggested: !!review.aiSuggestion,
    });

    if (!drugAdded) {
      return { success: false, error: 'Failed to add drug to approved list' };
    }

    // Update review status
    const updatedReview = PendingReviewStore.updateReviewStatus(reviewId, 'approved', {
      action: 'approved',
      drugClass,
      timestamp: new Date().toISOString(),
      adminId: approvalData.adminId || 'admin',
    });

    return {
      success: true,
      review: updatedReview,
      drugInfo: {
        name: review.drugName,
        class: drugClass,
      },
    };
  }

  /**
   * Reject a pending review
   * @param {string} reviewId - Review ID to reject
   * @param {Object} rejectionData - Rejection details
   * @returns {Object} Result with success status
   */
  static rejectReview(reviewId, rejectionData = {}) {
    const review = PendingReviewStore.getReviewById(reviewId);
    
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.status !== 'pending') {
      return { success: false, error: 'Review already processed' };
    }

    const updatedReview = PendingReviewStore.updateReviewStatus(reviewId, 'rejected', {
      action: 'rejected',
      reason: rejectionData.reason || 'Admin rejected',
      timestamp: new Date().toISOString(),
      adminId: rejectionData.adminId || 'admin',
    });

    return {
      success: true,
      review: updatedReview,
    };
  }

  /**
   * Get all pending reviews with enriched data
   * @returns {Array} Pending reviews with additional context
   */
  static getPendingReviewsWithContext() {
    const reviews = PendingReviewStore.getPendingReviews();
    
    return reviews.map(review => ({
      ...review,
      suggestedClass: review.aiSuggestion?.class || 'Unknown',
      suggestedConfidence: review.aiSuggestion?.confidence || null,
      suggestedReasoning: review.aiSuggestion?.reasoning || null,
      availableClasses: DRUG_CLASSES,
    }));
  }

  /**
   * Get dashboard statistics
   * @returns {Object} Dashboard stats
   */
  static getDashboardStats() {
    const reviewStats = PendingReviewStore.getStats();
    const approvedDrugs = Object.keys(this.getApprovedDrugs()).length;

    return {
      ...reviewStats,
      approvedDrugsInDatabase: approvedDrugs,
    };
  }

  /**
   * Clear all approved drugs (for testing)
   */
  static clearApprovedDrugs() {
    localStorage.removeItem(APPROVED_DRUGS_KEY);
  }
}

export default DrugApprovalService;
