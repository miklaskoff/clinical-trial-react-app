import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PendingReviewStore } from '../../../services/admin/PendingReviewStore.js';

describe('PendingReviewStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    PendingReviewStore.clearAllReviews();
  });

  afterEach(() => {
    PendingReviewStore.clearAllReviews();
  });

  describe('addReview', () => {
    it('should add a new review to storage', () => {
      const reviewData = {
        drugName: 'testdrug',
        patientId: 'patient123',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
        matchMethod: 'direct_unverified',
      };

      const review = PendingReviewStore.addReview(reviewData);

      expect(review).toBeDefined();
      expect(review.id).toMatch(/^review_/);
      expect(review.drugName).toBe('testdrug');
      expect(review.status).toBe('pending');
      expect(review.createdAt).toBeDefined();
    });

    it('should not add duplicate reviews', () => {
      const reviewData = {
        drugName: 'testdrug',
        patientId: 'patient123',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      };

      PendingReviewStore.addReview(reviewData);
      PendingReviewStore.addReview(reviewData); // Duplicate

      const reviews = PendingReviewStore.getPendingReviews();
      expect(reviews.length).toBe(1);
    });

    it('should add reviews with different drugs', () => {
      PendingReviewStore.addReview({
        drugName: 'drug1',
        patientId: 'patient123',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      PendingReviewStore.addReview({
        drugName: 'drug2',
        patientId: 'patient123',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      const reviews = PendingReviewStore.getPendingReviews();
      expect(reviews.length).toBe(2);
    });
  });

  describe('getPendingReviews', () => {
    it('should return only pending reviews', () => {
      const review1 = PendingReviewStore.addReview({
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

      // Mark one as approved
      PendingReviewStore.updateReviewStatus(review1.id, 'approved');

      const pending = PendingReviewStore.getPendingReviews();
      expect(pending.length).toBe(1);
      expect(pending[0].drugName).toBe('drug2');
    });
  });

  describe('getReviewById', () => {
    it('should return review by ID', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'testdrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      const found = PendingReviewStore.getReviewById(review.id);
      expect(found).toBeDefined();
      expect(found.drugName).toBe('testdrug');
    });

    it('should return null for non-existent ID', () => {
      const found = PendingReviewStore.getReviewById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('updateReviewStatus', () => {
    it('should update review status to approved', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'testdrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      const updated = PendingReviewStore.updateReviewStatus(review.id, 'approved', {
        action: 'approved',
        drugClass: 'TNF inhibitor',
      });

      expect(updated.status).toBe('approved');
      expect(updated.adminAction.action).toBe('approved');
    });

    it('should update review status to rejected', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'testdrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      const updated = PendingReviewStore.updateReviewStatus(review.id, 'rejected');

      expect(updated.status).toBe('rejected');
    });
  });

  describe('removeReview', () => {
    it('should remove review from storage', () => {
      const review = PendingReviewStore.addReview({
        drugName: 'testdrug',
        patientId: 'p1',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      const removed = PendingReviewStore.removeReview(review.id);
      expect(removed).toBe(true);

      const found = PendingReviewStore.getReviewById(review.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent review', () => {
      const removed = PendingReviewStore.removeReview('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
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

      const r3 = PendingReviewStore.addReview({
        drugName: 'drug3',
        patientId: 'p3',
        trialId: 'NCT001',
        criterionId: 'PTH_001',
      });

      PendingReviewStore.updateReviewStatus(r1.id, 'approved');
      PendingReviewStore.updateReviewStatus(r3.id, 'rejected');

      const stats = PendingReviewStore.getStats();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
    });
  });
});
