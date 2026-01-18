import { useState, useCallback, useEffect } from 'react';
import ClinicalTrialEligibilityQuestionnaire from '../ClinicalTrialEligibilityQuestionnaire';
import DrugReviewDashboard from './Admin/DrugReviewDashboard.jsx';
import './App.css';

/**
 * LocalStorage key for API key
 */
const API_KEY_STORAGE_KEY = 'anthropic_api_key';

/**
 * App stages
 */
const STAGES = {
  SETTINGS: 'settings',
  QUESTIONNAIRE: 'questionnaire',
  MATCHING: 'matching',
  RESULTS: 'results',
};

/**
 * Generate narrative patient description from responses
 * @param {Object} patientResponse - Patient response object
 * @returns {string} Narrative description
 */
function generatePatientNarrative(patientResponse) {
  const lines = [];
  const responses = patientResponse.responses || patientResponse;
  
  // Age
  if (responses.AGE) {
    const age = responses.AGE.age || responses.AGE;
    lines.push(`• Age: ${age} years old`);
  }
  
  // BMI/Weight
  if (responses.BMI) {
    const bmi = responses.BMI.bmi || responses.BMI;
    const weight = responses.BMI.weight;
    const height = responses.BMI.height;
    let bmiLine = `• BMI: ${bmi}`;
    if (weight) bmiLine += `, Weight: ${weight.value || weight} ${weight.unit || 'kg'}`;
    if (height) bmiLine += `, Height: ${height.value || height} ${height.unit || 'cm'}`;
    lines.push(bmiLine);
  }
  
  // Comorbidities
  if (responses.CMB && responses.CMB.length > 0) {
    lines.push(`• Comorbid conditions: ${responses.CMB.length} reported`);
    responses.CMB.forEach((c) => {
      const condition = c.CONDITION_TYPE || c.condition || c;
      const severity = c.SEVERITY || c.severity || '';
      lines.push(`  - ${condition}${severity ? ` (${severity})` : ''}`);
    });
  } else {
    lines.push('• No comorbid conditions reported');
  }
  
  // Treatment History
  if (responses.PTH && responses.PTH.length > 0) {
    lines.push(`• Previous treatments: ${responses.PTH.length} reported`);
    responses.PTH.forEach((t) => {
      const treatment = t.TREATMENT_TYPE || t.treatment || t;
      const pattern = t.TREATMENT_PATTERN || t.pattern || '';
      lines.push(`  - ${treatment}${pattern ? ` (${pattern})` : ''}`);
    });
  } else {
    lines.push('• No previous psoriasis treatments reported');
  }
  
  // Infections
  if (responses.AIC && responses.AIC.length > 0) {
    lines.push(`• Infections: ${responses.AIC.length} reported`);
    responses.AIC.forEach((i) => {
      const infection = i.INFECTION_TYPE || i.infection || i;
      lines.push(`  - ${infection}`);
    });
  } else {
    lines.push('• No active infections reported');
  }
  
  // Psoriasis Type
  if (responses.NPV) {
    const type = responses.NPV.type || responses.NPV.PSORIASIS_TYPE || responses.NPV;
    lines.push(`• Psoriasis type: ${type}`);
  }
  
  // Disease Duration
  if (responses.CPD) {
    const duration = responses.CPD.duration || responses.CPD.DURATION || responses.CPD;
    const unit = responses.CPD.unit || responses.CPD.DURATION_UNIT || 'months';
    lines.push(`• Disease duration: ${duration} ${unit}`);
  }
  
  // Severity
  if (responses.SEV) {
    lines.push('• Severity scores:');
    if (responses.SEV.PASI) lines.push(`  - PASI: ${responses.SEV.PASI}`);
    if (responses.SEV.BSA) lines.push(`  - BSA: ${responses.SEV.BSA}%`);
    if (responses.SEV.PGA) lines.push(`  - PGA: ${responses.SEV.PGA}`);
    if (responses.SEV.DLQI) lines.push(`  - DLQI: ${responses.SEV.DLQI}`);
  }
  
  // Affected Areas
  if (responses.AAO) {
    const areas = responses.AAO.areas || responses.AAO.ANATOMICAL_LOCATION || [];
    if (areas.length > 0) {
      lines.push(`• Affected areas: ${areas.join(', ')}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate text report with ineligibility reasons
 * @param {Object} results - Match results
 * @returns {string} Text report
 */
function generateTextReport(results) {
  const lines = [];
  const timestamp = new Date(results.timestamp).toLocaleString();
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('           CLINICAL TRIAL MATCHING REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  
  // Patient Profile (Narrative)
  lines.push('PATIENT PROFILE');
  lines.push('───────────────────────────────────────────────────────────────');
  if (results.patientResponse) {
    lines.push(generatePatientNarrative(results.patientResponse));
  } else {
    lines.push('Patient data not available');
  }
  lines.push('');
  
  // Patient Response JSON
  lines.push('PATIENT RESPONSE (JSON)');
  lines.push('───────────────────────────────────────────────────────────────');
  if (results.patientResponse) {
    lines.push(JSON.stringify(results.patientResponse, null, 2));
  }
  lines.push('');
  
  // Summary
  lines.push('MATCHING SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Total Trials Evaluated: ${results.eligibleTrials.length + results.needsReviewTrials.length + results.ineligibleTrials.length}`);
  lines.push(`✓ Eligible: ${results.eligibleTrials.length}`);
  lines.push(`⚠ Needs Review: ${results.needsReviewTrials.length}`);
  lines.push(`✗ Ineligible: ${results.ineligibleTrials.length}`);
  lines.push('');
  
  // Eligible Trials
  if (results.eligibleTrials.length > 0) {
    lines.push('ELIGIBLE TRIALS');
    lines.push('───────────────────────────────────────────────────────────────');
    results.eligibleTrials.forEach((trial, idx) => {
      const confidence = trial.getConfidenceScore ? trial.getConfidenceScore() : 1.0;
      lines.push(`${idx + 1}. ${trial.nctId} (Overall Confidence: ${(confidence * 100).toFixed(0)}%)`);
      
      // Show confidence breakdown
      if (trial.matchedCriteria && trial.matchedCriteria.length > 0) {
        const exactMatches = trial.matchedCriteria.filter(c => c.confidence === 1.0).length;
        const ruleBased = trial.matchedCriteria.filter(c => c.confidence < 1.0 && c.confidence >= 0.7).length;
        const aiMatches = trial.matchedCriteria.filter(c => c.requiresAI).length;
        const lowConf = trial.matchedCriteria.filter(c => c.confidence < 0.7).length;
        
        lines.push(`   Criteria breakdown:`);
        lines.push(`   • Total criteria evaluated: ${trial.matchedCriteria.length}`);
        if (exactMatches > 0) lines.push(`   • Exact matches (100%): ${exactMatches}`);
        if (ruleBased > 0) lines.push(`   • Rule-based matches (70-99%): ${ruleBased}`);
        if (aiMatches > 0) lines.push(`   • AI semantic matches: ${aiMatches}`);
        if (lowConf > 0) lines.push(`   • Low confidence (<70%): ${lowConf}`);
        
        // Show non-exact criteria with details
        const nonExact = trial.matchedCriteria.filter(c => c.confidence < 1.0);
        if (nonExact.length > 0) {
          lines.push('');
          lines.push('   Non-exact match details:');
          nonExact.forEach((c) => {
            const text = c.rawText || c.criterionId;
            const conf = `${(c.confidence * 100).toFixed(0)}%`;
            const ai = c.requiresAI ? ' [AI]' : '';
            lines.push(`   ┌─ Criterion: ${text}`);
            lines.push(`   │  Confidence: ${conf}${ai}`);
            if (c.patientValue) lines.push(`   │  Patient: ${c.patientValue}`);
            if (c.confidenceReason) lines.push(`   │  Reason: ${c.confidenceReason}`);
            lines.push(`   └────────────────────────────────────`);
          });
        }
      }
      lines.push('');
    });
  }
  
  // Needs Review Trials
  if (results.needsReviewTrials.length > 0) {
    lines.push('TRIALS NEEDING REVIEW');
    lines.push('───────────────────────────────────────────────────────────────');
    results.needsReviewTrials.forEach((trial, idx) => {
      lines.push(`${idx + 1}. ${trial.nctId}`);
      if (trial.flaggedCriteria && trial.flaggedCriteria.length > 0) {
        lines.push('   Flagged criteria:');
        trial.flaggedCriteria.forEach((c) => {
          lines.push(`   ┌─ Criterion: ${c.rawText || c.criterionId}`);
          lines.push(`   │  Confidence: ${(c.confidence * 100).toFixed(0)}%${c.requiresAI ? ' [AI]' : ''}`);
          if (c.patientValue) lines.push(`   │  Patient: ${c.patientValue}`);
          if (c.confidenceReason) lines.push(`   │  Reason: ${c.confidenceReason}`);
          if (c.aiReasoning) lines.push(`   │  AI Analysis: ${c.aiReasoning}`);
          lines.push(`   └────────────────────────────────────`);
        });
      }
      lines.push('');
    });
  }
  
  // Ineligible Trials with failure reasons
  if (results.ineligibleTrials.length > 0) {
    lines.push('INELIGIBLE TRIALS');
    lines.push('───────────────────────────────────────────────────────────────');
    results.ineligibleTrials.forEach((trial, idx) => {
      const confidence = trial.getConfidenceScore ? trial.getConfidenceScore() : 0;
      lines.push(`${idx + 1}. ${trial.nctId} (Confidence: ${(confidence * 100).toFixed(0)}%)`);
      
      // Get failed criteria
      const failedInclusions = trial.getFailedInclusions ? trial.getFailedInclusions() : [];
      const matchedExclusions = trial.getMatchedExclusions ? trial.getMatchedExclusions() : [];
      
      if (failedInclusions.length > 0) {
        lines.push('   ✗ Failed inclusion criteria:');
        failedInclusions.forEach((c) => {
          const text = c.rawText || c.criterionId;
          const conf = `${(c.confidence * 100).toFixed(0)}%`;
          const ai = c.requiresAI ? ' [AI]' : '';
          lines.push(`   ┌─ Criterion: ${text}`);
          lines.push(`   │  Confidence: ${conf}${ai}`);
          if (c.patientValue) lines.push(`   │  Patient: ${c.patientValue}`);
          if (c.confidenceReason) lines.push(`   │  Reason: ${c.confidenceReason}`);
          lines.push(`   └────────────────────────────────────`);
        });
      }
      
      if (matchedExclusions.length > 0) {
        lines.push('   ✗ Matched exclusion criteria:');
        matchedExclusions.forEach((c) => {
          const text = c.rawText || c.criterionId;
          const conf = `${(c.confidence * 100).toFixed(0)}%`;
          const ai = c.requiresAI ? ' [AI]' : '';
          lines.push(`   ┌─ Criterion: ${text}`);
          lines.push(`   │  Confidence: ${conf}${ai}`);
          if (c.patientValue) lines.push(`   │  Patient: ${c.patientValue}`);
          if (c.confidenceReason) lines.push(`   │  Reason: ${c.confidenceReason}`);
          lines.push(`   └────────────────────────────────────`);
        });
      }
      
      // Fallback to failureReasons if no detailed criteria
      if (failedInclusions.length === 0 && matchedExclusions.length === 0 && trial.failureReasons) {
        lines.push('   ✗ Reasons:');
        trial.failureReasons.forEach((reason) => {
          lines.push(`     • ${reason}`);
        });
      }
      
      lines.push('');
    });
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    END OF REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Main Application Component
 */
function App() {
  const [stage, setStage] = useState(STAGES.SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-5-20250929');
  const [useAI, setUseAI] = useState(true);
  const [matchResults, setMatchResults] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  
  // Confidence thresholds
  const [confidenceThresholds, setConfidenceThresholds] = useState({
    exclude: 0.8,  // High confidence = exclude patient
    review: 0.5,   // Medium confidence = flag for review
    ignore: 0.3,   // Low confidence = ignore match
  });

  // Check if we're on admin route
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      setIsAdminRoute(path === '/admin' || path === '/admin/');
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
    }
    // Load saved thresholds
    const savedThresholds = localStorage.getItem('confidence_thresholds');
    if (savedThresholds) {
      try {
        setConfidenceThresholds(JSON.parse(savedThresholds));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Save API key to localStorage when it changes
  const handleApiKeyChange = useCallback((e) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    if (newKey.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, newKey);
    }
  }, []);

  // Clear saved API key
  const handleClearApiKey = useCallback(() => {
    setApiKey('');
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }, []);

  // Update confidence threshold
  const handleThresholdChange = useCallback((key, value) => {
    setConfidenceThresholds(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('confidence_thresholds', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Handle settings submission
   */
  const handleSettingsSubmit = useCallback((e) => {
    e.preventDefault();
    if (useAI && !apiKey.trim()) {
      setError('Please enter an API key or disable AI matching');
      return;
    }
    setError(null);
    setStage(STAGES.QUESTIONNAIRE);
  }, [useAI, apiKey]);

  /**
   * Handle questionnaire submission
   */
  const handleQuestionnaireSubmit = useCallback(async (patientResponse) => {
    setStage(STAGES.MATCHING);
    setIsLoading(true);
    setError(null);

    try {
      // Dynamically import matcher to reduce initial bundle size
      const { ClinicalTrialMatcher } = await import('../services/matcher');
      
      // Load the complete database with all 11 clusters (770 criteria, 75 trials)
      // Includes: AGE, BMI, NPV, CPD, SEV, AAO, AIC, CMB, BIO, FLR, PTH
      const database = await import('../improved_slot_filled_database.json');

      const aiConfig = useAI && apiKey ? { 
        apiKey, 
        model,
        confidenceThresholds 
      } : null;
      const matcher = new ClinicalTrialMatcher(database.default, aiConfig);

      const results = await matcher.matchPatient(patientResponse);
      setMatchResults(results);
      setStage(STAGES.RESULTS);
    } catch (err) {
      console.error('Matching error:', err);
      setError(err.message);
      setStage(STAGES.QUESTIONNAIRE);
    } finally {
      setIsLoading(false);
    }
  }, [useAI, apiKey, model, confidenceThresholds]);

  /**
   * Reset application state
   */
  const handleReset = useCallback(() => {
    setStage(STAGES.SETTINGS);
    setMatchResults(null);
    setError(null);
  }, []);

  // Render admin dashboard if on /admin route
  if (isAdminRoute) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Clinical Trial Matching System</h1>
          <nav className="app-nav">
            <a href="/" className="nav-link">← Back to Main App</a>
          </nav>
        </header>
        <main className="app-main">
          <DrugReviewDashboard />
        </main>
        <footer className="app-footer">
          <p>Clinical Trial Matching System v4.0 - Admin Dashboard</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Clinical Trial Matching System</h1>
        <p className="app-subtitle">AI-powered patient-trial matching</p>
        <nav className="app-nav">
          <a href="/admin" className="nav-link admin-link">Admin Dashboard</a>
        </nav>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner" role="alert">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        {stage === STAGES.SETTINGS && (
          <section className="settings-panel">
            <h2>Configuration</h2>
            <form onSubmit={handleSettingsSubmit}>
              <div className="form-group">
                <label htmlFor="useAI">
                  <input
                    type="checkbox"
                    id="useAI"
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                  />
                  Enable AI Semantic Matching
                </label>
              </div>

              {useAI && (
                <>
                  <div className="form-group">
                    <label htmlFor="apiKey">Anthropic API Key</label>
                    <div className="input-with-button">
                      <input
                        type="password"
                        id="apiKey"
                        value={apiKey}
                        onChange={handleApiKeyChange}
                        placeholder="sk-ant-..."
                      />
                      {apiKey && (
                        <button 
                          type="button" 
                          onClick={handleClearApiKey}
                          className="btn btn-small btn-secondary"
                          title="Clear saved API key"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {apiKey && (
                      <small className="hint">✓ API key saved locally</small>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="model">Model</label>
                    <select
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                      <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
                      <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                    </select>
                  </div>

                  <div className="form-group thresholds-group">
                    <h3>Confidence Thresholds</h3>
                    <p className="threshold-description">
                      Adjust how confident the matching must be before taking action.
                    </p>

                    <div className="threshold-item">
                      <div className="threshold-header">
                        <label>
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
                        onChange={(e) => handleThresholdChange('exclude', parseInt(e.target.value) / 100)}
                        className="threshold-slider"
                      />
                    </div>

                    <div className="threshold-item">
                      <div className="threshold-header">
                        <label>
                          <span className="threshold-badge review">Review</span>
                          Flag for Review (≥ {(confidenceThresholds.review * 100).toFixed(0)}%)
                        </label>
                        <span className="threshold-value">{(confidenceThresholds.review * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={confidenceThresholds.review * 100}
                        onChange={(e) => handleThresholdChange('review', parseInt(e.target.value) / 100)}
                        className="threshold-slider"
                      />
                    </div>

                    <div className="threshold-item">
                      <div className="threshold-header">
                        <label>
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
                        onChange={(e) => handleThresholdChange('ignore', parseInt(e.target.value) / 100)}
                        className="threshold-slider"
                      />
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary">
                Start Questionnaire
              </button>
            </form>
          </section>
        )}

        {stage === STAGES.QUESTIONNAIRE && (
          <section className="questionnaire-panel">
            <ClinicalTrialEligibilityQuestionnaire 
              onSubmit={handleQuestionnaireSubmit} 
            />
            <button onClick={handleReset} className="btn btn-secondary back-btn">
              ← Back to Settings
            </button>
          </section>
        )}

        {stage === STAGES.MATCHING && (
          <section className="matching-panel">
            <h2>Matching in Progress...</h2>
            <div className="loading-spinner" aria-label="Loading">
              <div className="spinner"></div>
            </div>
            <p>Evaluating clinical trials...</p>
          </section>
        )}

        {stage === STAGES.RESULTS && matchResults && (
          <section className="results-panel">
            <h2>Results</h2>
            <div className="results-summary">
              <div className="stat eligible">
                <span className="stat-value">{matchResults.eligibleTrials.length}</span>
                <span className="stat-label">Eligible</span>
              </div>
              <div className="stat review">
                <span className="stat-value">{matchResults.needsReviewTrials.length}</span>
                <span className="stat-label">Needs Review</span>
              </div>
              <div className="stat ineligible">
                <span className="stat-value">{matchResults.ineligibleTrials.length}</span>
                <span className="stat-label">Ineligible</span>
              </div>
            </div>

            <div className="trials-list">
              <h3>Eligible Trials</h3>
              {matchResults.eligibleTrials.length === 0 ? (
                <p>No eligible trials found.</p>
              ) : (
                <ul>
                  {matchResults.eligibleTrials.map((trial) => (
                    <li key={trial.nctId} className="trial-card eligible">
                      <div className="trial-header">
                        <strong>{trial.nctId}</strong>
                        <span className="confidence-score">
                          Confidence: {(trial.getConfidenceScore() * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="confidence-breakdown">
                        <small>
                          {trial.matchedCriteria?.length || 0} criteria evaluated
                          {trial.matchedCriteria?.filter(c => c.confidence === 1.0).length > 0 && 
                            ` • ${trial.matchedCriteria.filter(c => c.confidence === 1.0).length} exact (100%)`}
                          {trial.matchedCriteria?.filter(c => c.confidence < 1.0 && c.confidence >= 0.7).length > 0 && 
                            ` • ${trial.matchedCriteria.filter(c => c.confidence < 1.0 && c.confidence >= 0.7).length} rule-based (70-99%)`}
                          {trial.matchedCriteria?.filter(c => c.requiresAI).length > 0 && 
                            ` • ${trial.matchedCriteria.filter(c => c.requiresAI).length} AI-matched`}
                        </small>
                        {/* Show non-100% criteria with details */}
                        {trial.matchedCriteria?.filter(c => c.confidence < 1.0).length > 0 && (
                          <div className="criteria-details">
                            <small>Non-exact matches:</small>
                            <ul>
                              {trial.matchedCriteria.filter(c => c.confidence < 1.0).slice(0, 5).map((c, i) => (
                                <li key={i} className="criterion-detail">
                                  <div className="criterion-text">{c.rawText || c.criterionId}</div>
                                  <div className="criterion-info">
                                    <span className="criterion-confidence">{(c.confidence * 100).toFixed(0)}%</span>
                                    {c.requiresAI && <span className="criterion-ai">AI</span>}
                                  </div>
                                  {c.patientValue && <div className="patient-value">📋 {c.patientValue}</div>}
                                  {c.confidenceReason && <div className="confidence-reason">💡 {c.confidenceReason}</div>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3>Ineligible Trials</h3>
              {matchResults.ineligibleTrials.length === 0 ? (
                <p>No ineligible trials.</p>
              ) : (
                <ul>
                  {matchResults.ineligibleTrials.slice(0, 10).map((trial) => (
                    <li key={trial.nctId} className="trial-card ineligible">
                      <div className="trial-header">
                        <strong>{trial.nctId}</strong>
                        <span className="confidence-score">
                          Confidence: {(trial.getConfidenceScore() * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="failure-reasons">
                        {trial.getFailedInclusions && trial.getFailedInclusions().length > 0 && (
                          <div className="failed-inclusions">
                            <small>Failed inclusions:</small>
                            <ul>
                              {trial.getFailedInclusions().slice(0, 5).map((c, i) => (
                                <li key={i} className="criterion-detail">
                                  <div className="criterion-text">{c.rawText || c.criterionId}</div>
                                  <div className="criterion-info">
                                    <span className="criterion-confidence">{(c.confidence * 100).toFixed(0)}%</span>
                                    {c.requiresAI && <span className="criterion-ai">AI</span>}
                                  </div>
                                  {c.patientValue && <div className="patient-value">📋 {c.patientValue}</div>}
                                  {c.confidenceReason && <div className="confidence-reason">💡 {c.confidenceReason}</div>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {trial.getMatchedExclusions && trial.getMatchedExclusions().length > 0 && (
                          <div className="matched-exclusions">
                            <small>Matched exclusions:</small>
                            <ul>
                              {trial.getMatchedExclusions().slice(0, 5).map((c, i) => (
                                <li key={i} className="criterion-detail">
                                  <div className="criterion-text">{c.rawText || c.criterionId}</div>
                                  <div className="criterion-info">
                                    <span className="criterion-confidence">{(c.confidence * 100).toFixed(0)}%</span>
                                    {c.requiresAI && <span className="criterion-ai">AI</span>}
                                  </div>
                                  {c.patientValue && <div className="patient-value">📋 {c.patientValue}</div>}
                                  {c.confidenceReason && <div className="confidence-reason">💡 {c.confidenceReason}</div>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {matchResults.ineligibleTrials.length > 10 && (
                <p className="more-trials">
                  ...and {matchResults.ineligibleTrials.length - 10} more ineligible trials
                </p>
              )}
            </div>

            <div className="results-actions">
              <button onClick={handleReset} className="btn btn-primary">
                Start New Match
              </button>
              <button 
                onClick={() => {
                  const report = generateTextReport(matchResults);
                  const blob = new Blob([report], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `clinical-trial-report-${new Date().toISOString().split('T')[0]}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn btn-secondary"
              >
                📄 Download Text Report
              </button>
              <button 
                onClick={() => {
                  const json = JSON.stringify(matchResults.toJSON ? matchResults.toJSON() : matchResults, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `clinical-trial-results-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn btn-secondary"
              >
                📊 Download Results JSON
              </button>
              <button 
                onClick={() => {
                  const json = JSON.stringify(matchResults.patientResponse, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `patient-response-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn btn-secondary"
              >
                🧑‍⚕️ Download Patient JSON
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>Clinical Trial Matching System v4.0</p>
      </footer>
    </div>
  );
}

export default App;
