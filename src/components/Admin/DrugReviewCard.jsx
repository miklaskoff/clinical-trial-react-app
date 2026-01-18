import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Individual drug review card component
 */
function DrugReviewCard({ review, drugClasses, onApprove, onReject }) {
  const [selectedClass, setSelectedClass] = useState(
    review.suggestedClass || drugClasses[0]
  );
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const handleApprove = () => {
    onApprove(review.id, selectedClass);
  };

  const handleReject = () => {
    if (showRejectConfirm) {
      onReject(review.id, 'Admin rejected');
      setShowRejectConfirm(false);
    } else {
      setShowRejectConfirm(true);
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  const getConfidenceColor = (confidence) => {
    if (!confidence) return 'gray';
    if (confidence >= 0.85) return 'green';
    if (confidence >= 0.7) return 'orange';
    return 'red';
  };

  return (
    <div className="review-card" data-testid={`review-card-${review.id}`}>
      <div className="review-header">
        <h3 className="drug-name">{review.drugName}</h3>
        <span className={`match-method ${review.matchMethod}`}>
          {review.matchMethod === 'ai_fallback' ? 'AI Match' : 'Direct Match'}
        </span>
      </div>

      <div className="review-details">
        <div className="detail-row">
          <span className="label">Trial:</span>
          <span className="value">{review.trialId}</span>
        </div>
        <div className="detail-row">
          <span className="label">Criterion:</span>
          <span className="value">{review.criterionId}</span>
        </div>
        <div className="detail-row">
          <span className="label">Patient ID:</span>
          <span className="value">{review.patientId}</span>
        </div>
        <div className="detail-row">
          <span className="label">Submitted:</span>
          <span className="value">{formatDate(review.createdAt)}</span>
        </div>
      </div>

      {/* AI Suggestion Section */}
      {review.aiSuggestion && (
        <div className="ai-suggestion">
          <h4>AI Suggestion</h4>
          <div className="suggestion-content">
            <div className="suggestion-class">
              <span className="label">Suggested Class:</span>
              <span className="value">{review.suggestedClass}</span>
            </div>
            {review.suggestedConfidence && (
              <div className="suggestion-confidence">
                <span className="label">Confidence:</span>
                <span 
                  className="value"
                  style={{ color: getConfidenceColor(review.suggestedConfidence) }}
                >
                  {(review.suggestedConfidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {review.suggestedReasoning && (
              <div className="suggestion-reasoning">
                <span className="label">Reasoning:</span>
                <p className="value">{review.suggestedReasoning}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions Section */}
      <div className="review-actions">
        <div className="class-selector">
          <label htmlFor={`class-select-${review.id}`}>Drug Class:</label>
          <select
            id={`class-select-${review.id}`}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            data-testid="class-dropdown"
          >
            {drugClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        <div className="action-buttons">
          <button
            className="btn-approve"
            onClick={handleApprove}
            data-testid="approve-button"
          >
            Approve
          </button>
          
          <button
            className={`btn-reject ${showRejectConfirm ? 'confirm' : ''}`}
            onClick={handleReject}
            data-testid="reject-button"
          >
            {showRejectConfirm ? 'Confirm Reject' : 'Reject'}
          </button>

          {showRejectConfirm && (
            <button
              className="btn-cancel"
              onClick={() => setShowRejectConfirm(false)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

DrugReviewCard.propTypes = {
  review: PropTypes.shape({
    id: PropTypes.string.isRequired,
    drugName: PropTypes.string.isRequired,
    trialId: PropTypes.string.isRequired,
    criterionId: PropTypes.string.isRequired,
    patientId: PropTypes.string,
    matchMethod: PropTypes.string,
    createdAt: PropTypes.string.isRequired,
    suggestedClass: PropTypes.string,
    suggestedConfidence: PropTypes.number,
    suggestedReasoning: PropTypes.string,
    aiSuggestion: PropTypes.object,
  }).isRequired,
  drugClasses: PropTypes.arrayOf(PropTypes.string).isRequired,
  onApprove: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
};

export default DrugReviewCard;
