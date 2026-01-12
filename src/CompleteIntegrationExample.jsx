/**
 * COMPLETE INTEGRATION EXAMPLE
 * Clinical Trial Eligibility System
 * 
 * This file demonstrates the full workflow from patient questionnaire
 * to eligibility matching and reporting.
 */

import React, { useState } from 'react';
import ClinicalTrialEligibilityQuestionnaire from './ClinicalTrialEligibilityQuestionnaire';
import { ClinicalTrialMatcher, MatchReportGenerator } from './ClinicalTrialMatcher';

// ==============================================================================
// MAIN INTEGRATION COMPONENT
// ==============================================================================

const ClinicalTrialMatchingSystem = () => {
  const [stage, setStage] = useState('questionnaire'); // 'questionnaire', 'matching', 'results'
  const [patientResponse, setPatientResponse] = useState(null);
  const [matchResults, setMatchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle questionnaire submission
   */
  const handleQuestionnaireSubmit = async (response) => {
    console.log('📝 Patient Response Received:', response);
    
    setPatientResponse(response);
    setStage('matching');
    setIsLoading(true);
    setError(null);

    try {
      // Initialize matcher
      const matcher = new ClinicalTrialMatcher();
      
      // Run matching algorithm
      console.log('🔍 Starting trial matching...');
      const results = await matcher.matchPatient(response);
      
      console.log('✅ Matching complete!');
      console.log(`   Eligible: ${results.eligibleTrials.length}`);
      console.log(`   Ineligible: ${results.ineligibleTrials.length}`);
      console.log(`   Needs Review: ${results.needsReviewTrials.length}`);
      
      setMatchResults(results);
      setStage('results');
    } catch (err) {
      console.error('❌ Matching error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset and start over
   */
  const handleReset = () => {
    setStage('questionnaire');
    setPatientResponse(null);
    setMatchResults(null);
    setError(null);
  };

  /**
   * Download JSON report
   */
  const handleDownloadJSON = () => {
    const jsonReport = MatchReportGenerator.generateJSONReport(matchResults);
    const blob = new Blob([jsonReport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-trial-match-report-${new Date().toISOString()}.json`;
    a.click();
  };

  /**
   * Download text report
   */
  const handleDownloadText = () => {
    const textReport = MatchReportGenerator.generateReport(matchResults);
    const blob = new Blob([textReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-trial-match-report-${new Date().toISOString()}.txt`;
    a.click();
  };

  // ===========================================================================
  // RENDER STAGES
  // ===========================================================================

  if (stage === 'questionnaire') {
    return (
      <div style={styles.container}>
        <ClinicalTrialEligibilityQuestionnaire 
          onSubmit={handleQuestionnaireSubmit}
        />
      </div>
    );
  }

  if (stage === 'matching') {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <h2>Matching Against Clinical Trials...</h2>
          <p>This may take a moment as we evaluate {matchResults?.totalTrialsEvaluated || 'multiple'} trials</p>
          
          {error && (
            <div style={styles.error}>
              <h3>❌ Error</h3>
              <p>{error}</p>
              <button onClick={handleReset} style={styles.button}>
                Start Over
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'results') {
    return (
      <div style={styles.container}>
        <ResultsView 
          results={matchResults}
          onReset={handleReset}
          onDownloadJSON={handleDownloadJSON}
          onDownloadText={handleDownloadText}
        />
      </div>
    );
  }

  return null;
};

// ==============================================================================
// RESULTS VIEW COMPONENT
// ==============================================================================

const ResultsView = ({ results, onReset, onDownloadJSON, onDownloadText }) => {
  const [selectedTab, setSelectedTab] = useState('eligible'); // 'eligible', 'needs_review', 'ineligible'

  return (
    <div style={styles.resultsContainer}>
      {/* Header */}
      <div style={styles.resultsHeader}>
        <h1>Clinical Trial Matching Results</h1>
        <p style={styles.timestamp}>
          Generated: {new Date(results.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <SummaryCard
          title="Eligible Trials"
          count={results.eligibleTrials.length}
          color="#28a745"
          icon="✓"
          onClick={() => setSelectedTab('eligible')}
          active={selectedTab === 'eligible'}
        />
        
        <SummaryCard
          title="Needs Review"
          count={results.needsReviewTrials.length}
          color="#ffc107"
          icon="⚠"
          onClick={() => setSelectedTab('needs_review')}
          active={selectedTab === 'needs_review'}
        />
        
        <SummaryCard
          title="Ineligible"
          count={results.ineligibleTrials.length}
          color="#dc3545"
          icon="✗"
          onClick={() => setSelectedTab('ineligible')}
          active={selectedTab === 'ineligible'}
        />
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {selectedTab === 'eligible' && (
          <EligibleTrialsView trials={results.eligibleTrials} />
        )}
        
        {selectedTab === 'needs_review' && (
          <NeedsReviewTrialsView trials={results.needsReviewTrials} />
        )}
        
        {selectedTab === 'ineligible' && (
          <IneligibleTrialsView trials={results.ineligibleTrials} />
        )}
      </div>

      {/* Action Buttons */}
      <div style={styles.actionButtons}>
        <button onClick={onDownloadJSON} style={styles.downloadButton}>
          📥 Download JSON Report
        </button>
        <button onClick={onDownloadText} style={styles.downloadButton}>
          📄 Download Text Report
        </button>
        <button onClick={onReset} style={styles.resetButton}>
          🔄 Start New Search
        </button>
      </div>
    </div>
  );
};

// ==============================================================================
// SUMMARY CARD COMPONENT
// ==============================================================================

const SummaryCard = ({ title, count, color, icon, onClick, active }) => (
  <div 
    onClick={onClick}
    style={{
      ...styles.summaryCard,
      borderColor: active ? color : '#ddd',
      borderWidth: active ? '3px' : '1px',
      cursor: 'pointer',
      transform: active ? 'scale(1.05)' : 'scale(1)',
      transition: 'all 0.2s'
    }}
  >
    <div style={{ ...styles.cardIcon, color }}>{icon}</div>
    <h2 style={{ margin: '10px 0', fontSize: '36px' }}>{count}</h2>
    <p style={{ margin: 0, color: '#666' }}>{title}</p>
  </div>
);

// ==============================================================================
// ELIGIBLE TRIALS VIEW
// ==============================================================================

const EligibleTrialsView = ({ trials }) => {
  if (trials.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p>No eligible trials found based on your responses.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={styles.sectionTitle}>✓ Eligible Clinical Trials</h2>
      <p style={styles.sectionSubtitle}>
        These trials appear to be a good match based on your responses. 
        Confidence scores indicate the strength of the match.
      </p>
      
      {trials.map((trial, idx) => (
        <TrialCard key={trial.nctId} trial={trial} index={idx + 1} type="eligible" />
      ))}
    </div>
  );
};

// ==============================================================================
// NEEDS REVIEW TRIALS VIEW
// ==============================================================================

const NeedsReviewTrialsView = ({ trials }) => {
  if (trials.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p>No trials requiring manual review.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={styles.sectionTitle}>⚠ Trials Needing Manual Review</h2>
      <p style={styles.sectionSubtitle}>
        These trials had matches that our AI system flagged for human verification. 
        A clinical coordinator should review these cases.
      </p>
      
      {trials.map((trial, idx) => (
        <TrialCard key={trial.nctId} trial={trial} index={idx + 1} type="needs_review" />
      ))}
    </div>
  );
};

// ==============================================================================
// INELIGIBLE TRIALS VIEW
// ==============================================================================

const IneligibleTrialsView = ({ trials }) => {
  const displayTrials = trials.slice(0, 10); // Show first 10

  return (
    <div>
      <h2 style={styles.sectionTitle}>✗ Ineligible Trials</h2>
      <p style={styles.sectionSubtitle}>
        These trials had exclusion criteria that matched your responses.
        {trials.length > 10 && ` Showing 10 of ${trials.length} ineligible trials.`}
      </p>
      
      {displayTrials.map((trial, idx) => (
        <TrialCard key={trial.nctId} trial={trial} index={idx + 1} type="ineligible" />
      ))}
    </div>
  );
};

// ==============================================================================
// TRIAL CARD COMPONENT
// ==============================================================================

const TrialCard = ({ trial, index, type }) => {
  const [expanded, setExpanded] = useState(false);
  
  const cardColors = {
    eligible: '#d4edda',
    needs_review: '#fff3cd',
    ineligible: '#f8d7da'
  };

  const exclusionCount = trial.matchedCriteria.filter(c => c.matches).length;

  return (
    <div style={{ ...styles.trialCard, backgroundColor: cardColors[type] }}>
      {/* Header */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={styles.trialCardHeader}
      >
        <div>
          <h3 style={{ margin: 0 }}>
            {index}. {trial.nctId}
          </h3>
          {type === 'eligible' && (
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
              Confidence: {(trial.getConfidenceScore() * 100).toFixed(1)}%
            </p>
          )}
          {type === 'needs_review' && (
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#856404' }}>
              {trial.flaggedCriteria.length} criteria flagged for review
            </p>
          )}
          {type === 'ineligible' && (
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#721c24' }}>
              Matched {exclusionCount} exclusion criteria
            </p>
          )}
        </div>
        
        <button style={styles.expandButton}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={styles.trialCardDetails}>
          <div style={styles.detailsSection}>
            <h4>Criteria Evaluated</h4>
            <p>Total: {trial.matchedCriteria.length}</p>
          </div>

          {trial.flaggedCriteria.length > 0 && (
            <div style={styles.detailsSection}>
              <h4>🤖 AI-Flagged Criteria</h4>
              {trial.flaggedCriteria.map(flag => (
                <div key={flag.criterionId} style={styles.flaggedCriterion}>
                  <p><strong>Criterion:</strong> {flag.criterionId}</p>
                  <p><strong>Reasoning:</strong> {flag.aiReasoning}</p>
                  <p><strong>Confidence:</strong> {(flag.confidence * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}

          {type === 'ineligible' && (
            <div style={styles.detailsSection}>
              <h4>Matched Exclusions</h4>
              <ul>
                {trial.matchedCriteria
                  .filter(c => c.matches)
                  .map(c => (
                    <li key={c.criterionId}>{c.criterionId}</li>
                  ))
                }
              </ul>
            </div>
          )}

          <div style={styles.detailsSection}>
            <a 
              href={`https://clinicaltrials.gov/study/${trial.nctId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              View on ClinicalTrials.gov →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// STYLES
// ==============================================================================

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  
  loadingContainer: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  
  spinner: {
    border: '8px solid #f3f3f3',
    borderTop: '8px solid #007bff',
    borderRadius: '50%',
    width: '60px',
    height: '60px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  
  error: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '20px'
  },
  
  resultsContainer: {
    padding: '20px'
  },
  
  resultsHeader: {
    textAlign: 'center',
    marginBottom: '30px',
    borderBottom: '2px solid #007bff',
    paddingBottom: '20px'
  },
  
  timestamp: {
    color: '#666',
    fontSize: '14px'
  },
  
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '40px'
  },
  
  summaryCard: {
    padding: '30px',
    border: '1px solid #ddd',
    borderRadius: '12px',
    textAlign: 'center',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  
  cardIcon: {
    fontSize: '48px',
    fontWeight: 'bold'
  },
  
  tabContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '30px'
  },
  
  sectionTitle: {
    fontSize: '28px',
    marginBottom: '10px',
    color: '#333'
  },
  
  sectionSubtitle: {
    color: '#666',
    fontSize: '16px',
    marginBottom: '30px',
    lineHeight: '1.6'
  },
  
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999'
  },
  
  trialCard: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginBottom: '15px',
    overflow: 'hidden'
  },
  
  trialCardHeader: {
    padding: '20px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 0.2s'
  },
  
  expandButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '5px 10px'
  },
  
  trialCardDetails: {
    padding: '20px',
    borderTop: '1px solid rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.5)'
  },
  
  detailsSection: {
    marginBottom: '20px'
  },
  
  flaggedCriterion: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '10px',
    border: '1px solid rgba(0,0,0,0.1)'
  },
  
  link: {
    color: '#007bff',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '500'
  },
  
  actionButtons: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  
  downloadButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  
  resetButton: {
    padding: '12px 24px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  
  button: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '20px'
  }
};

// Add CSS animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  button:hover {
    opacity: 0.9;
  }
  
  .trial-card-header:hover {
    background-color: rgba(0,0,0,0.05);
  }
`;
document.head.appendChild(styleSheet);

export default ClinicalTrialMatchingSystem;

// ==============================================================================
// EXAMPLE USAGE
// ==============================================================================

/*
import React from 'react';
import ReactDOM from 'react-dom';
import ClinicalTrialMatchingSystem from './CompleteIntegrationExample';

ReactDOM.render(
  <ClinicalTrialMatchingSystem />,
  document.getElementById('root')
);
*/
