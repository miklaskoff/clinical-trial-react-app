/**
 * @file Backend API Client
 * @description Client for communicating with the Express backend API
 */

/**
 * Backend API Client
 * Handles all communication with the Express backend
 */
export class BackendClient {
  /**
   * @param {string} [baseUrl='http://localhost:3001'] - Backend API base URL
   */
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.authToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Make an authenticated request
   * @private
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    return response;
  }

  /**
   * Check if backend is available
   * @returns {Promise<boolean>}
   */
  async isBackendAvailable() {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Health check
   * @returns {Promise<{status: string, timestamp: string}>}
   */
  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/api/health`);
    
    if (!response.ok) {
      throw new Error('Health check failed');
    }

    return response.json();
  }

  // ============================================
  // MATCHING API
  // ============================================

  /**
   * Match a patient against trial criteria
   * @param {Object} params
   * @param {string} params.trialId - Trial NCT ID
   * @param {Object} params.patientData - Patient data
   * @param {string} params.criterionText - Criterion text to evaluate
   * @returns {Promise<{match: boolean, confidence: number, reasoning: string}>}
   */
  async match({ trialId, patientData, criterionText }) {
    const response = await this._request('/api/match', {
      method: 'POST',
      body: JSON.stringify({ trialId, patientData, criterionText })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Match request failed' }));
      throw new Error(error.error || 'Match request failed');
    }

    return response.json();
  }

  /**
   * Batch match multiple criteria
   * @param {Object} params
   * @param {string} params.trialId - Trial NCT ID
   * @param {Object} params.patientData - Patient data
   * @param {string[]} params.criteria - Array of criterion texts
   * @returns {Promise<{results: Array}>}
   */
  async batchMatch({ trialId, patientData, criteria }) {
    const response = await this._request('/api/match/batch', {
      method: 'POST',
      body: JSON.stringify({ trialId, patientData, criteria })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Batch match failed' }));
      throw new Error(error.error || 'Batch match failed');
    }

    return response.json();
  }

  // ============================================
  // FOLLOW-UP API
  // ============================================

  /**
   * Generate follow-up questions for a drug
   * @param {string} drugName - Drug name to generate questions for
   * @returns {Promise<{drugName: string, drugClass: string, questions: Array, source: string}>}
   */
  async generateFollowUps(drugName) {
    try {
      const response = await this._request('/api/followups/generate', {
        method: 'POST',
        body: JSON.stringify({ drugName })
      });

      if (!response.ok) {
        return {
          drugName,
          drugClass: 'unknown',
          questions: [],
          error: 'Failed to generate follow-ups'
        };
      }

      return response.json();
    } catch (error) {
      return {
        drugName,
        drugClass: 'unknown',
        questions: [],
        error: error.message
      };
    }
  }

  // ============================================
  // ADMIN API
  // ============================================

  /**
   * Login to admin panel
   * @param {string} password - Admin password
   * @returns {Promise<{token: string, expiresAt: string}>}
   */
  async adminLogin(password) {
    const response = await this._request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.authToken = data.token;
    this.tokenExpiresAt = data.expiresAt;
    return data;
  }

  /**
   * Logout from admin panel
   */
  async adminLogout() {
    if (!this.authToken) return;

    try {
      await this._request('/api/admin/logout', {
        method: 'POST'
      });
    } finally {
      this.authToken = null;
      this.tokenExpiresAt = null;
    }
  }

  /**
   * Get list of approved drugs
   * @returns {Promise<{drugs: Array}>}
   */
  async getApprovedDrugs() {
    const response = await this._request('/api/admin/drugs');

    if (!response.ok) {
      throw new Error('Failed to fetch approved drugs');
    }

    return response.json();
  }

  /**
   * Add an approved drug
   * @param {Object} params
   * @param {string} params.drugName - Drug name
   * @param {string} params.drugClass - Drug class
   * @returns {Promise<{message: string, drug: Object}>}
   */
  async addApprovedDrug({ drugName, drugClass }) {
    const response = await this._request('/api/admin/drugs', {
      method: 'POST',
      body: JSON.stringify({ drugName, drugClass })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to add drug' }));
      throw new Error(error.error || 'Failed to add drug');
    }

    return response.json();
  }

  /**
   * Delete an approved drug
   * @param {string} drugName - Drug name to delete
   */
  async deleteApprovedDrug(drugName) {
    const response = await this._request(`/api/admin/drugs/${encodeURIComponent(drugName)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete drug');
    }

    return response.json();
  }

  /**
   * Get pending reviews
   * @returns {Promise<{pending: Array}>}
   */
  async getPendingReviews() {
    const response = await this._request('/api/admin/pending');

    if (!response.ok) {
      throw new Error('Failed to fetch pending reviews');
    }

    return response.json();
  }

  /**
   * Approve a pending review
   * @param {number} id - Pending review ID
   */
  async approvePendingReview(id) {
    const response = await this._request(`/api/admin/pending/${id}/approve`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to approve review');
    }

    return response.json();
  }

  /**
   * Reject a pending review
   * @param {number} id - Pending review ID
   */
  async rejectPendingReview(id) {
    const response = await this._request(`/api/admin/pending/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to reject review');
    }

    return response.json();
  }

  /**
   * Get admin statistics
   * @returns {Promise<{stats: {approvedDrugs: number, pendingReviews: number, cachedFollowups: number}}>}
   */
  async getAdminStats() {
    const response = await this._request('/api/admin/stats');

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }

    return response.json();
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    if (!this.authToken) return false;
    if (!this.tokenExpiresAt) return true;
    return new Date(this.tokenExpiresAt) > new Date();
  }
}

// Default instance
export const backendClient = new BackendClient();

export default BackendClient;
