/**
 * @file Pending Terms Review Component
 * @description Admin component for reviewing and approving unknown conditions/treatments
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * PendingTermsReview - Review and approve/reject unknown terms
 */
const PendingTermsReview = ({ backendClient }) => {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState({});
  const [synonymInputs, setSynonymInputs] = useState({});

  const fetchPendingTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await backendClient.getPendingTerms();
      setTerms(data.terms || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [backendClient]);

  useEffect(() => {
    fetchPendingTerms();
  }, [fetchPendingTerms]);

  const handleApprove = async (id) => {
    setProcessing(prev => ({ ...prev, [id]: true }));
    try {
      const synonyms = synonymInputs[id] 
        ? synonymInputs[id].split(',').map(s => s.trim()).filter(Boolean)
        : [];
      await backendClient.approvePendingTerm(id, synonyms);
      // Remove from list
      setTerms(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(`Failed to approve: ${err.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleReject = async (id) => {
    setProcessing(prev => ({ ...prev, [id]: true }));
    try {
      await backendClient.rejectPendingTerm(id, 'Rejected by admin');
      // Remove from list
      setTerms(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(`Failed to reject: ${err.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="pending-terms-loading">
        <div className="loading-spinner"></div>
        <p>Loading pending terms...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pending-terms-error">
        <p>Error: {error}</p>
        <button onClick={fetchPendingTerms}>Retry</button>
      </div>
    );
  }

  return (
    <div className="pending-terms-review" data-testid="pending-terms-review">
      <h2>Pending Terms for Review</h2>
      <p className="section-description">
        These are unknown conditions and treatments submitted by users. 
        Review and approve them to add to autocomplete suggestions.
      </p>

      {terms.length === 0 ? (
        <div className="no-pending-terms">
          <p>No pending terms to review. 🎉</p>
        </div>
      ) : (
        <div className="terms-list">
          {terms.map(term => (
            <div 
              key={term.id} 
              className="term-card"
              data-testid={`term-card-${term.id}`}
            >
              <div className="term-header">
                <span className={`term-type term-type-${term.type}`}>
                  {term.type.toUpperCase()}
                </span>
                <span className="term-value">{term.term}</span>
              </div>
              
              {term.context && (
                <p className="term-context">Context: {term.context}</p>
              )}
              
              <p className="term-submitted">
                Submitted: {new Date(term.submitted_at).toLocaleString()}
              </p>

              <div className="synonyms-input">
                <label htmlFor={`synonyms-${term.id}`}>
                  Synonyms (comma-separated):
                </label>
                <input
                  id={`synonyms-${term.id}`}
                  type="text"
                  placeholder="e.g., NSCLC, non-small cell, adenocarcinoma"
                  value={synonymInputs[term.id] || ''}
                  onChange={(e) => setSynonymInputs(prev => ({
                    ...prev,
                    [term.id]: e.target.value
                  }))}
                  disabled={processing[term.id]}
                />
              </div>

              <div className="term-actions">
                <button
                  className="approve-btn"
                  onClick={() => handleApprove(term.id)}
                  disabled={processing[term.id]}
                >
                  {processing[term.id] ? 'Processing...' : 'Approve'}
                </button>
                <button
                  className="reject-btn"
                  onClick={() => handleReject(term.id)}
                  disabled={processing[term.id]}
                >
                  {processing[term.id] ? 'Processing...' : 'Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .pending-terms-review {
          padding: 20px;
        }
        
        .pending-terms-review h2 {
          margin-bottom: 10px;
          color: #333;
        }
        
        .section-description {
          color: #666;
          margin-bottom: 20px;
        }
        
        .terms-list {
          display: grid;
          gap: 16px;
        }
        
        .term-card {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .term-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .term-type {
          font-size: 11px;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .term-type-condition {
          background: #e3f2fd;
          color: #1565c0;
        }
        
        .term-type-treatment {
          background: #e8f5e9;
          color: #2e7d32;
        }
        
        .term-value {
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }
        
        .term-context,
        .term-submitted {
          font-size: 13px;
          color: #666;
          margin: 4px 0;
        }
        
        .synonyms-input {
          margin: 12px 0;
        }
        
        .synonyms-input label {
          display: block;
          font-size: 13px;
          color: #555;
          margin-bottom: 4px;
        }
        
        .synonyms-input input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .term-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        
        .approve-btn,
        .reject-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .approve-btn {
          background: #4caf50;
          color: white;
        }
        
        .approve-btn:hover:not(:disabled) {
          background: #43a047;
        }
        
        .reject-btn {
          background: #f44336;
          color: white;
        }
        
        .reject-btn:hover:not(:disabled) {
          background: #e53935;
        }
        
        .approve-btn:disabled,
        .reject-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .no-pending-terms {
          text-align: center;
          padding: 40px;
          background: #f5f5f5;
          border-radius: 8px;
          color: #666;
        }
        
        .pending-terms-loading,
        .pending-terms-error {
          text-align: center;
          padding: 40px;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PendingTermsReview;
