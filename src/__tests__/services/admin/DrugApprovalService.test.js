import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrugApprovalService, DRUG_CLASSES } from '../../../services/admin/DrugApprovalService.js';
import { PendingReviewStore } from '../../../services/admin/PendingReviewStore.js';

describe('DrugApprovalService', () => {
  beforeEach(() => {
    // Clear storage before each test
    PendingReviewStore.clearAllReviews();
    DrugApprovalService.clearApprovedDrugs();
  });

  afterEach(() => {
    PendingReviewStore.clearAllReviews();
    DrugApprovalService.clearApprovedDrugs();
  });

  describe('DRUG_CLASSES', () => {
    it('should export drug classes array', () => {
      expect(DRUG_CLASSES).toBeDefined();
      expect(Array.isArray(DRUG_CLASSES)).toBe(true);
      expect(DRUG_CLASSES.length).toBeGreaterThan(5);
      expect(DRUG_CLASSES).toContain('TNF inhibitor');
      expect(DRUG_CLASSES).toContain('IL-17 inhibitor');
    });
  });

  describe('addApprovedDrug', () => {
    it('should add a drug to approved list', () => {
      const result = DrugApprovalService.addApprovedDrug('testdrug', {
        class: 'TNF inhibitor',
        isBiologic: true,
      });

      expect(result).toBe(true);

      const drug = DrugApprovalService.getApprovedDrug('testdrug');
      expect(drug).toBeDefined();
      expect(drug.class).toBe('TNF inhibitor');
      expect(drug.isBiologic).toBe(true);
    });

    it('should normalize drug name to lowercase', () => {
      DrugApprovalService.addApprovedDrug('TestDrug', {
        class: 'TNF inhibitor',
      });

      const drug = DrugApprovalService.getApprovedDrug('testdrug');
      expect(drug).toBeDefined();
      expect(drug.originalName).toBe('TestDrug');
    });
  });

  describe('approveReview', () => {
    it('should approve a pending review and add drug to database', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'newdrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
        aiSuggestion: {
          class: 'IL-17 inhibitor',
          confidence: 0.85,
        },
      });

      const result = DrugApprovalService.approveReview(review.id, {
        drugClass: 'IL-17 inhibitor',
      });

      expect(result.success).toBe(true);
      expect(result.drugInfo.name).toBe('newdrug');
      expect(result.drugInfo.class).toBe('IL-17 inhibitor');

      // Check drug was added
      const approvedDrug = DrugApprovalService.getApprovedDrug('newdrug');
      expect(approvedDrug).toBeDefined();
      expect(approvedDrug.class).toBe('IL-17 inhibitor');

      // Check review was marked as approved
      const updatedReview = PendingReviewStore.getReviewById(review.id);
      expect(updatedReview.status).toBe('approved');
    });

    it('should return error for non-existent review', () => {
      const result = DrugApprovalService.approveReview('nonexistent', {
        drugClass: 'TNF inhibitor',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Review not found');
    });

    it('should return error for already processed review', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'drug1',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      // Approve once
      DrugApprovalService.approveReview(review.id, { drugClass: 'TNF inhibitor' });

      // Try to approve again
      const result = DrugApprovalService.approveReview(review.id, { drugClass: 'TNF inhibitor' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Review already processed');
    });

    it('should use AI suggestion class if no drugClass provided', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'aidrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
        aiSuggestion: {
          class: 'JAK inhibitor',
          confidence: 0.88,
        },
      });

      const result = DrugApprovalService.approveReview(review.id, {});

      expect(result.success).toBe(true);
      expect(result.drugInfo.class).toBe('JAK inhibitor');
    });
  });

  describe('rejectReview', () => {
    it('should reject a pending review', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'baddrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      const result = DrugApprovalService.rejectReview(review.id, {
        reason: 'Not a valid drug',
      });

      expect(result.success).toBe(true);

      const updatedReview = PendingReviewStore.getReviewById(review.id);
      expect(updatedReview.status).toBe('rejected');
      expect(updatedReview.adminAction.reason).toBe('Not a valid drug');
    });

    it('should return error for non-existent review', () => {
      const result = DrugApprovalService.rejectReview('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Review not found');
    });
  });

  describe('getPendingReviewsWithContext', () => {
    it('should return enriched review data', () => {
      PendingReviewStore.addReview({
        drugName: 'contextdrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
        aiSuggestion: {
          class: 'TYK2 inhibitor',
          confidence: 0.82,
          reasoning: 'Based on mechanism',
        },
      });

      const reviews = DrugApprovalService.getPendingReviewsWithContext();

      expect(reviews.length).toBe(1);
      expect(reviews[0].suggestedClass).toBe('TYK2 inhibitor');
      expect(reviews[0].suggestedConfidence).toBe(0.82);
      expect(reviews[0].suggestedReasoning).toBe('Based on mechanism');
      expect(reviews[0].availableClasses).toEqual(DRUG_CLASSES);
    });
  });

  describe('getDashboardStats', () => {
    it('should return combined statistics', () => {
      // Add some reviews
      const r1 = PendingReviewStore.addReview({
        drugName: 'drug1',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      PendingReviewStore.addReview({
        drugName: 'drug2',
        patientId: 'p2',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      // Approve one (adds to approved drugs)
      DrugApprovalService.approveReview(r1.id, { drugClass: 'TNF inhibitor' });

      // Add another approved drug directly
      DrugApprovalService.addApprovedDrug('anotherdrug', { class: 'IL-23 inhibitor' });

      const stats = DrugApprovalService.getDashboardStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.approvedDrugsInDatabase).toBe(2);
    });
  });
});
