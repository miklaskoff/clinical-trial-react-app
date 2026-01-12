import { useState, useCallback } from 'react';
import './App.css';

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
                    <input
                      type="password"
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
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
            <h2>Patient Questionnaire</h2>
            <p>Questionnaire component will be rendered here.</p>
            {/* TODO: Implement PatientQuestionnaire component */}
            <button
              onClick={() =>
                handleQuestionnaireSubmit({
                  responses: {
                    AGE: { age: 35 },
                    BMI: { bmi: 24.5 },
                    CMB: [],
                    PTH: [],
                  },
                })
              }
              className="btn btn-primary"
            >
              Submit Test Data
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Back to Settings
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
            </div>

            <button onClick={handleReset} className="btn btn-primary">
              Start New Match
            </button>
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
