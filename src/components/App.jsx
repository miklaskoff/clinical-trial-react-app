import { useState, useCallback, useEffect } from 'react';
import ClinicalTrialEligibilityQuestionnaire from '../ClinicalTrialEligibilityQuestionnaire';
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
      lines.push(`${idx + 1}. ${trial.nctId} (Confidence: ${(trial.getConfidenceScore() * 100).toFixed(0)}%)`);
    });
    lines.push('');
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
          lines.push(`   • ${c.rawText || c.criterionId}`);
          if (c.aiReasoning) {
            lines.push(`     AI: ${c.aiReasoning}`);
          }
        });
      }
    });
    lines.push('');
  }
  
  // Ineligible Trials with failure reasons
  if (results.ineligibleTrials.length > 0) {
    lines.push('INELIGIBLE TRIALS');
    lines.push('───────────────────────────────────────────────────────────────');
    results.ineligibleTrials.forEach((trial, idx) => {
      lines.push(`${idx + 1}. ${trial.nctId}`);
      
      // Get failed criteria
      const failedInclusions = trial.getFailedInclusions ? trial.getFailedInclusions() : [];
      const matchedExclusions = trial.getMatchedExclusions ? trial.getMatchedExclusions() : [];
      
      if (failedInclusions.length > 0) {
        lines.push('   ✗ Failed inclusion criteria:');
        failedInclusions.forEach((c) => {
          const text = c.rawText || c.criterionId;
          lines.push(`     • ${text}`);
        });
      }
      
      if (matchedExclusions.length > 0) {
        lines.push('   ✗ Matched exclusion criteria:');
        matchedExclusions.forEach((c) => {
          const text = c.rawText || c.criterionId;
          lines.push(`     • ${text}`);
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

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
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
      const database = await import('../data/trials-database.json');

      const aiConfig = useAI && apiKey ? { apiKey, model } : null;
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
  }, [useAI, apiKey, model]);

  /**
   * Reset application state
   */
  const handleReset = useCallback(() => {
    setStage(STAGES.SETTINGS);
    setMatchResults(null);
    setError(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Clinical Trial Matching System</h1>
        <p className="app-subtitle">AI-powered patient-trial matching</p>
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
                      <strong>{trial.nctId}</strong>
                      <span>Confidence: {(trial.getConfidenceScore() * 100).toFixed(0)}%</span>
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
                      <strong>{trial.nctId}</strong>
                      <div className="failure-reasons">
                        {trial.getFailedInclusions && trial.getFailedInclusions().length > 0 && (
                          <div className="failed-inclusions">
                            <small>Failed inclusions:</small>
                            <ul>
                              {trial.getFailedInclusions().slice(0, 3).map((c, i) => (
                                <li key={i}>{c.rawText || c.criterionId}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {trial.getMatchedExclusions && trial.getMatchedExclusions().length > 0 && (
                          <div className="matched-exclusions">
                            <small>Matched exclusions:</small>
                            <ul>
                              {trial.getMatchedExclusions().slice(0, 3).map((c, i) => (
                                <li key={i}>{c.rawText || c.criterionId}</li>
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
