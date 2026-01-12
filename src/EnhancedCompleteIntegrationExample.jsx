/**
 * ENHANCED COMPLETE INTEGRATION EXAMPLE
 * Clinical Trial Eligibility System with Claude API Integration
 *
 * Features:
 * - Full 9-cluster questionnaire workflow
 * - Claude API semantic matching with confidence scoring
 * - User-adjustable confidence thresholds
 * - Settings panel with API configuration
 * - Caching to reduce API costs
 * - Drug classification matching
 * - Polished UI with results visualization
 */

import React, { useState } from 'react';
import ClinicalTrialEligibilityQuestionnaire from './ClinicalTrialEligibilityQuestionnaire';
import { ClinicalTrialMatcher, MatchReportGenerator } from './ClinicalTrialMatcher';
import './EnhancedIntegrationStyles.css';

// ==============================================================================
// MAIN INTEGRATION COMPONENT
// ==============================================================================

const EnhancedClinicalTrialMatchingSystem = () => {
  // Navigation state
  const [stage, setStage] = useState('settings'); // 'settings', 'questionnaire', 'matching', 'results'
  const [patientResponse, setPatientResponse] = useState(null);
  const [matchResults, setMatchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // AI Configuration state
  const [anthropicKey, setAnthropicKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-5-20250929');
  const [useAIMatching, setUseAIMatching] = useState(true);
  const [confidenceThresholds, setConfidenceThresholds] = useState({
    exclude: 0.8,
    review: 0.5,
    ignore: 0.3
  });

  // Settings panel visibility
  const [showSettings, setShowSettings] = useState(false);

  /**
   * Handle questionnaire submission with AI configuration
   */
  const handleQuestionnaireSubmit = async (response) => {
    console.log('📝 Patient Response Received:', response);

    setPatientResponse(response);
    setStage('matching');
    setIsLoading(true);
    setError(null);

    try {
      // Prepare AI configuration
      const aiConfig = useAIMatching && anthropicKey ? {
        apiKey: anthropicKey,
        model: claudeModel,
        confidenceThresholds: confidenceThresholds
      } : null;

      // Initialize matcher with AI config
      const matcher = new ClinicalTrialMatcher(undefined, aiConfig);

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
      setStage('questionnaire');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start questionnaire after settings
   */
  const handleStartQuestionnaire = () => {
    if (useAIMatching && !anthropicKey) {
      alert('Please enter your Anthropic API key to use AI matching, or disable AI matching to use rule-based matching only.');
      return;
    }
    setStage('questionnaire');
  };

  /**
   * Reset and start over
   */
  const handleReset = () => {
    setStage('settings');
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
    a.download = `clinical-trial-match-report-${new Date().toISOString().split('.')[0]}.json`;
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
    a.download = `clinical-trial-match-report-${new Date().toISOString().split('.')[0]}.txt`;
    a.click();
  };

  // ===========================================================================
  // RENDER SETTINGS STAGE
  // ===========================================================================

  if (stage === 'settings') {
    return (
      <div className="enhanced-container">
        <div className="settings-stage">
          <h1 className="main-title">Clinical Trial Matching System</h1>
          <p className="subtitle">Configure AI-powered semantic matching settings</p>

          <div className="settings-card">
            <h2>🤖 AI Semantic Matching Configuration</h2>

            {/* Enable/Disable AI */}
            <div className="setting-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={useAIMatching}
                  onChange={(e) => setUseAIMatching(e.target.checked)}
                  className="toggle-checkbox"
                />
                <span className="toggle-text">Enable AI Semantic Matching with Claude</span>
              </label>
              <p className="setting-description">
                When enabled, uses Claude AI to detect semantic relationships between patient data and trial criteria.
                When disabled, uses only rule-based matching (exact matches, synonyms, drug classifications).
              </p>
            </div>

            {useAIMatching && (
              <>
                {/* API Key Input */}
                <div className="setting-group">
                  <label className="input-label">Anthropic API Key</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="api-key-input"
                  />
                  <p className="setting-description">
                    Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>
                  </p>
                </div>

                {/* Model Selection */}
                <div className="setting-group">
                  <label className="input-label">Claude Model</label>
                  <select
                    value={claudeModel}
                    onChange={(e) => setClaudeModel(e.target.value)}
                    className="model-select"
                  >
                    <option value="claude-opus-4-5-20251101">Opus 4.5 (Most capable, ~$15/M tokens)</option>
                    <option value="claude-sonnet-4-5-20250929">Sonnet 4.5 (Recommended, ~$3/M tokens)</option>
                    <option value="claude-haiku-3-5-20241022">Haiku 3.5 (Fastest, ~$1/M tokens)</option>
                  </select>
                  <p className="setting-description">
                    <strong>Recommended:</strong> Sonnet 4.5 offers the best balance of accuracy and cost.
                  </p>
                </div>

                {/* Confidence Thresholds */}
                <div className="setting-group">
                  <h3 className="threshold-title">Confidence Thresholds</h3>
                  <p className="setting-description">
                    Adjust how confident the AI must be before taking action. Higher values = stricter matching.
                  </p>

                  {/* Exclude Threshold */}
                  <div className="threshold-item">
                    <div className="threshold-header">
                      <label className="threshold-label">
                        <span className="threshold-badge exclude">Exclude</span>
                        Exclude Patient (≥ {(confidenceThresholds.exclude * 100).toFixed(0)}%)
                      </label>
                      <span className="threshold-value">{(confidenceThresholds.exclude * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={confidenceThresholds.exclude * 100}
                      onChange={(e) => setConfidenceThresholds({
                        ...confidenceThresholds,
                        exclude: parseInt(e.target.value) / 100
                      })}
                      className="threshold-slider exclude"
                    />
                    <p className="threshold-description">
                      AI matches at or above this confidence will exclude the patient from the trial.
                    </p>
                  </div>

                  {/* Review Threshold */}
                  <div className="threshold-item">
                    <div className="threshold-header">
                      <label className="threshold-label">
                        <span className="threshold-badge review">Review</span>
                        Flag for Manual Review (≥ {(confidenceThresholds.review * 100).toFixed(0)}%)
                      </label>
                      <span className="threshold-value">{(confidenceThresholds.review * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={confidenceThresholds.review * 100}
                      onChange={(e) => setConfidenceThresholds({
                        ...confidenceThresholds,
                        review: parseInt(e.target.value) / 100
                      })}
                      className="threshold-slider review"
                    />
                    <p className="threshold-description">
                      Matches between Review and Exclude thresholds will be flagged for human verification.
                    </p>
                  </div>

                  {/* Ignore Threshold */}
                  <div className="threshold-item">
                    <div className="threshold-header">
                      <label className="threshold-label">
                        <span className="threshold-badge ignore">Ignore</span>
                        Ignore Low Confidence (&lt; {(confidenceThresholds.ignore * 100).toFixed(0)}%)
                      </label>
                      <span className="threshold-value">{(confidenceThresholds.ignore * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={confidenceThresholds.ignore * 100}
                      onChange={(e) => setConfidenceThresholds({
                        ...confidenceThresholds,
                        ignore: parseInt(e.target.value) / 100
                      })}
                      className="threshold-slider ignore"
                    />
                    <p className="threshold-description">
                      Matches below this confidence will be completely ignored.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Start Button */}
            <button
              onClick={handleStartQuestionnaire}
              className="start-button"
            >
              Start Questionnaire →
            </button>
          </div>

          {/* Feature Highlights */}
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Semantic Matching</h3>
              <p>Claude AI detects relationships like "hypertension" = "high blood pressure"</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💊</div>
              <h3>Drug Classification</h3>
              <p>Recognizes drug classes (TNF inhibitors, biologics, IL-17/23 inhibitors)</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Cost Optimization</h3>
              <p>Intelligent caching reduces duplicate API calls</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3>Adjustable Confidence</h3>
              <p>Fine-tune matching sensitivity with threshold sliders</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER QUESTIONNAIRE STAGE
  // ===========================================================================

  if (stage === 'questionnaire') {
    return (
      <div className="enhanced-container">
        {/* Settings Toggle Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="settings-toggle"
        >
          ⚙️ {showSettings ? 'Hide' : 'Show'} Settings
        </button>

        {/* Collapsible Settings Panel */}
        {showSettings && (
          <div className="settings-panel-overlay">
            <div className="settings-panel-mini">
              <h3>AI Settings</h3>
              <div className="mini-setting">
                <label>
                  <input
                    type="checkbox"
                    checked={useAIMatching}
                    onChange={(e) => setUseAIMatching(e.target.checked)}
                  />
                  {' '}Enable AI Matching
                </label>
              </div>
              {useAIMatching && (
                <>
                  <div className="mini-setting">
                    <label>Model:</label>
                    <select
                      value={claudeModel}
                      onChange={(e) => setClaudeModel(e.target.value)}
                      className="mini-select"
                    >
                      <option value="claude-opus-4-5-20251101">Opus 4.5</option>
                      <option value="claude-sonnet-4-5-20250929">Sonnet 4.5</option>
                      <option value="claude-haiku-3-5-20241022">Haiku 3.5</option>
                    </select>
                  </div>
                  <div className="mini-setting">
                    <label>Exclude ≥ {(confidenceThresholds.exclude * 100).toFixed(0)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={confidenceThresholds.exclude * 100}
                      onChange={(e) => setConfidenceThresholds({
                        ...confidenceThresholds,
                        exclude: parseInt(e.target.value) / 100
                      })}
                      className="mini-slider"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <ClinicalTrialEligibilityQuestionnaire
          onSubmit={handleQuestionnaireSubmit}
        />
      </div>
    );
  }

  // ===========================================================================
  // RENDER MATCHING STAGE
  // ===========================================================================

  if (stage === 'matching') {
    return (
      <div className="enhanced-container">
        <div className="loading-stage">
          <div className="spinner"></div>
          <h2>Matching Against Clinical Trials...</h2>
          <p>Analyzing patient eligibility across {matchResults?.totalTrialsEvaluated || 19} trials</p>
          <p className="loading-detail">
            {useAIMatching ?
              `Using ${claudeModel.includes('opus') ? 'Opus 4.5' : claudeModel.includes('sonnet') ? 'Sonnet 4.5' : 'Haiku 3.5'} for semantic matching...` :
              'Using rule-based matching...'}
          </p>

          {error && (
            <div className="error-box">
              <h3>Error</h3>
              <p>{error}</p>
              <button onClick={handleReset} className="error-button">
                Start Over
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER RESULTS STAGE
  // ===========================================================================

  if (stage === 'results') {
    return (
      <div className="enhanced-container">
        <ResultsView
          results={matchResults}
          onReset={handleReset}
          onDownloadJSON={handleDownloadJSON}
          onDownloadText={handleDownloadText}
          aiEnabled={useAIMatching}
          model={claudeModel}
        />
      </div>
    );
  }

  return null;
};

// ==============================================================================
// RESULTS VIEW COMPONENT
// ==============================================================================

const ResultsView = ({ results, onReset, onDownloadJSON, onDownloadText, aiEnabled, model }) => {
  const [selectedTab, setSelectedTab] = useState('eligible');

  return (
    <div className="results-container">
      {/* Header */}
      <div className="results-header">
        <h1>Clinical Trial Matching Results</h1>
        <p className="results-timestamp">
          Generated: {new Date(results.timestamp).toLocaleString()}
        </p>
        <p className="results-config">
          Matching Method: {aiEnabled ? `AI-Powered (${model.includes('opus') ? 'Opus 4.5' : model.includes('sonnet') ? 'Sonnet 4.5' : 'Haiku 3.5'})` : 'Rule-Based Only'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
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
      <div className="tab-content">
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
      <div className="action-buttons">
        <button onClick={onDownloadJSON} className="download-button">
          📥 Download JSON Report
        </button>
        <button onClick={onDownloadText} className="download-button">
          📄 Download Text Report
        </button>
        <button onClick={onReset} className="reset-button">
          🔄 Start New Search
        </button>
      </div>
    </div>
  );
};

// Summary Card Component (same as before)
const SummaryCard = ({ title, count, color, icon, onClick, active }) => (
  <div
    onClick={onClick}
    className={`summary-card ${active ? 'active' : ''}`}
    style={{
      borderColor: active ? color : '#ddd',
      borderWidth: active ? '3px' : '1px'
    }}
  >
    <div className="card-icon" style={{ color }}>{icon}</div>
    <h2 className="card-count">{count}</h2>
    <p className="card-title">{title}</p>
  </div>
);

// Trial View Components (keeping existing implementations)
const EligibleTrialsView = ({ trials }) => {
  if (trials.length === 0) {
    return (
      <div className="empty-state">
        <p>No eligible trials found based on your responses.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">✓ Eligible Clinical Trials</h2>
      <p className="section-subtitle">
        These trials appear to be a good match based on your responses.
        Confidence scores indicate the strength of the match.
      </p>

      {trials.map((trial, idx) => (
        <TrialCard key={trial.nctId} trial={trial} index={idx + 1} type="eligible" />
      ))}
    </div>
  );
};

const NeedsReviewTrialsView = ({ trials }) => {
  if (trials.length === 0) {
    return (
      <div className="empty-state">
        <p>No trials requiring manual review.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">⚠ Trials Needing Manual Review</h2>
      <p className="section-subtitle">
        These trials had matches that our AI system flagged for human verification.
        A clinical coordinator should review these cases.
      </p>

      {trials.map((trial, idx) => (
        <TrialCard key={trial.nctId} trial={trial} index={idx + 1} type="needs_review" />
      ))}
    </div>
  );
};

const IneligibleTrialsView = ({ trials }) => {
  const displayTrials = trials.slice(0, 10);

  return (
    <div>
      <h2 className="section-title">✗ Ineligible Trials</h2>
      <p className="section-subtitle">
        These trials had exclusion criteria that matched your responses.
        {trials.length > 10 && ` Showing 10 of ${trials.length} ineligible trials.`}
      </p>

      {displayTrials.map((trial, idx) => (
        <TrialCard key={trial.nctId} trial={trial} index={idx + 1} type="ineligible" />
      ))}
    </div>
  );
};

const TrialCard = ({ trial, index, type }) => {
  const [expanded, setExpanded] = useState(false);

  const cardColors = {
    eligible: '#d4edda',
    needs_review: '#fff3cd',
    ineligible: '#f8d7da'
  };

  const exclusionCount = trial.matchedCriteria.filter(c => c.matches).length;

  return (
    <div className="trial-card" style={{ backgroundColor: cardColors[type] }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="trial-card-header"
      >
        <div>
          <h3>
            {index}. {trial.nctId}
          </h3>
          {type === 'eligible' && (
            <p className="trial-info">
              Confidence: {(trial.getConfidenceScore() * 100).toFixed(1)}%
            </p>
          )}
          {type === 'needs_review' && (
            <p className="trial-info warning">
              {trial.flaggedCriteria.length} criteria flagged for review
            </p>
          )}
          {type === 'ineligible' && (
            <p className="trial-info danger">
              Matched {exclusionCount} exclusion criteria
            </p>
          )}
        </div>

        <button className="expand-button">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="trial-card-details">
          <div className="details-section">
            <h4>Criteria Evaluated</h4>
            <p>Total: {trial.matchedCriteria.length}</p>
          </div>

          {trial.flaggedCriteria.length > 0 && (
            <div className="details-section">
              <h4>🤖 AI-Flagged Criteria</h4>
              {trial.flaggedCriteria.map(flag => (
                <div key={flag.criterionId} className="flagged-criterion">
                  <p><strong>Criterion:</strong> {flag.criterionId}</p>
                  <p><strong>Reasoning:</strong> {flag.aiReasoning}</p>
                  <p><strong>Confidence:</strong> {(flag.confidence * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}

          {type === 'ineligible' && (
            <div className="details-section">
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

          <div className="details-section">
            <a
              href={`https://clinicaltrials.gov/study/${trial.nctId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="trial-link"
            >
              View on ClinicalTrials.gov →
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedClinicalTrialMatchingSystem;
