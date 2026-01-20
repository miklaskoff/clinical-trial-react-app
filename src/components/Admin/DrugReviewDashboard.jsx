import React, { useState, useEffect } from 'react';
import { DrugApprovalService, DRUG_CLASSES } from '../../services/admin/DrugApprovalService.js';
import DrugReviewCard from './DrugReviewCard.jsx';
import PendingTermsReview from './PendingTermsReview.jsx';
import ApiKeySettings from './ApiKeySettings.jsx';
import { backendClient } from '../../services/api/backendClient.js';
import './DrugReviewDashboard.css';

/**
 * Admin Dashboard for reviewing pending drug classifications and terms
 */
function DrugReviewDashboard() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('drugs'); // 'drugs' or 'terms'

  // Load reviews on mount
  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = () => {
    setLoading(true);
    try {
      const pendingReviews = DrugApprovalService.getPendingReviewsWithContext();
      const dashboardStats = DrugApprovalService.getDashboardStats();
      setReviews(pendingReviews);
      setStats(dashboardStats);
    } catch (error) {
      console.error('Error loading reviews:', error);
      setMessage({ type: 'error', text: 'Failed to load reviews' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (reviewId, drugClass) => {
    const result = DrugApprovalService.approveReview(reviewId, { drugClass });
    
    if (result.success) {
      setMessage({ 
        type: 'success', 
        text: `Approved "${result.drugInfo.name}" as "${result.drugInfo.class}"` 
      });
      loadReviews(); // Refresh list
    } else {
      setMessage({ type: 'error', text: result.error });
    }

    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReject = (reviewId, reason) => {
    const result = DrugApprovalService.rejectReview(reviewId, { reason });
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Review rejected' });
      loadReviews();
    } else {
      setMessage({ type: 'error', text: result.error });
    }

    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="admin-dashboard" data-testid="admin-dashboard">
        <div className="loading">Loading reviews...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard" data-testid="admin-dashboard">
      <header className="admin-header">
        <h1>Admin Review Dashboard</h1>
        <p>Review and approve drug classifications and unknown terms</p>
      </header>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'drugs' ? 'active' : ''}`}
          onClick={() => setActiveTab('drugs')}
        >
          Drug Reviews ({stats.pending || 0})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => setActiveTab('terms')}
        >
          Pending Terms
        </button>
        <button 
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'drugs' ? (
        <>
          {/* Stats Section */}
          <section className="stats-section">
            <div className="stat-card">
              <span className="stat-value">{stats.pending || 0}</span>
              <span className="stat-label">Pending</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.approved || 0}</span>
              <span className="stat-label">Approved</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.rejected || 0}</span>
              <span className="stat-label">Rejected</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.approvedDrugsInDatabase || 0}</span>
              <span className="stat-label">Drugs in DB</span>
            </div>
          </section>

          {/* Message Alert */}
      {message && (
        <div className={`alert alert-${message.type}`} role="alert">
          {message.text}
        </div>
      )}

      {/* Reviews List */}
      <section className="reviews-section">
        <h2>Pending Reviews ({reviews.length})</h2>
        
        {reviews.length === 0 ? (
          <div className="no-reviews">
            <p>No pending reviews at this time.</p>
            <p>New reviews will appear here when patients enter unknown drugs.</p>
          </div>
        ) : (
          <div className="reviews-list">
            {reviews.map(review => (
              <DrugReviewCard
                key={review.id}
                review={review}
                drugClasses={DRUG_CLASSES}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </section>

      {/* Refresh Button */}
      <div className="actions">
        <button 
          className="btn-refresh" 
          onClick={loadReviews}
          data-testid="refresh-button"
        >
          Refresh Reviews
        </button>
      </div>
        </>
      ) : activeTab === 'terms' ? (
        <PendingTermsReview backendClient={backendClient} />
      ) : (
        <ApiKeySettings />
      )}
    </div>
  );
}

export default DrugReviewDashboard;
