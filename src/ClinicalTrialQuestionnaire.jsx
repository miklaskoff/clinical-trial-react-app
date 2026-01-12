import React, { useState } from 'react';
import DATABASE from './improved_slot_filled_database.json';
import AISemanticMatcher from './aiSemanticMatcher';

const ClinicalTrialQuestionnaire = () => {
  // State for all 9 clusters
  const [cmb, setCmb] = useState({ hasConditions: '', conditions: [] });
  const [pth, setPth] = useState({ hasTreatment: '', treatments: [] });
  const [aic, setAic] = useState({ infections: [] });
  const [aao, setAao] = useState({ BSA: '', PASI: '', PGA: '' });
  const [age, setAge] = useState({ age: '' });
  const [npv, setNpv] = useState({ type: '' });
  const [cpd, setCpd] = useState({ duration: '', unit: 'years' });
  const [sev, setSev] = useState({ hasPASI: '', pasiValue: '' });
  const [bmi, setBmi] = useState({ weight: '', height: '', bmi: '' });
  
  const [currentStep, setCurrentStep] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const [matchResults, setMatchResults] = useState(null);

  // AI Semantic Matching Configuration
  const [anthropicKey, setAnthropicKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-5-20250929');
  const [useAIMatching, setUseAIMatching] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Confidence Thresholds (adjustable by user)
  const [confidenceThresholds, setConfidenceThresholds] = useState({
    exclude: 0.8,    // >= 0.8 = Exclude (High confidence exclusion)
    review: 0.5,     // 0.5-0.79 = Needs Review (Moderate confidence)
    ignore: 0.3      // < 0.3 = Ignore (Low confidence, no match)
  });

  const totalSteps = 9;

  // Auto-calculate BMI
  const calculateBMI = (weight, height) => {
    if (weight && height) {
      const heightM = height / 100;
      const bmiValue = (weight / (heightM * heightM)).toFixed(1);
      setBmi({ ...bmi, weight, height, bmi: bmiValue });
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const responses = {
      timestamp: new Date().toISOString(),
      version: '3.0',
      responses: {
        CMB: cmb,
        PTH: pth,
        AIC: aic,
        AAO: aao,
        AGE: age,
        NPV: npv,
        CPD: cpd,
        SEV: sev,
        BMI: bmi
      }
    };

    // Download JSON
    const blob = new Blob([JSON.stringify(responses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-response-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Run matching
    runMatcher(responses);
  };

  const runMatcher = async (responses) => {
    setIsMatching(true);
    const results = { eligible: [], needsReview: [], ineligible: [] };

    // Initialize AI matcher if enabled
    let aiMatcher = null;
    if (useAIMatching && anthropicKey) {
      aiMatcher = new AISemanticMatcher(anthropicKey, claudeModel);
    }

    // Get all unique trials
    const trials = new Set();
    Object.keys(DATABASE).forEach(key => {
      if (key.startsWith('CLUSTER_')) {
        DATABASE[key].criteria?.forEach(c => trials.add(c.nct_id));
      }
    });

    // Match each trial (with AI if enabled)
    for (const nctId of trials) {
      const result = await matchTrial(nctId, responses.responses, aiMatcher);
      if (result.status === 'eligible') {
        results.eligible.push(result);
      } else if (result.status === 'review') {
        results.needsReview.push(result);
      } else {
        results.ineligible.push(result);
      }
    }

    setMatchResults(results);
    setShowResults(true);
    setIsMatching(false);
  };

  const matchTrial = async (nctId, responses, aiMatcher = null) => {
    let exclusions = [];
    let warnings = [];
    let allPendingAIMatches = [];

    // First pass: collect all rule-based matches and pending AI matches
    Object.keys(DATABASE).forEach(key => {
      if (!key.startsWith('CLUSTER_')) return;

      const cluster = DATABASE[key];
      const criteriaForTrial = cluster.criteria?.filter(c => c.nct_id === nctId) || [];

      criteriaForTrial.forEach(criterion => {
        const match = evaluateCriterion(criterion, cluster.cluster_code, responses, aiMatcher);

        if (match.matches) {
          // Rule-based match found
          if (match.confidence >= confidenceThresholds.exclude) {
            exclusions.push({
              id: criterion.id,
              reason: match.reason,
              confidence: match.confidence,
              matchType: match.matchType
            });
          } else if (match.confidence >= confidenceThresholds.review) {
            warnings.push({
              id: criterion.id,
              reason: match.reason,
              confidence: match.confidence,
              matchType: match.matchType
            });
          }
        } else if (match.pendingAIMatches) {
          // Collect AI matches to process
          allPendingAIMatches.push(...match.pendingAIMatches.map(m => ({
            ...m,
            criterion
          })));
        }
      });
    });

    // Second pass: Process AI semantic matches if any
    if (aiMatcher && allPendingAIMatches.length > 0) {
      const aiResults = await aiMatcher.batchSemanticMatch(allPendingAIMatches);

      for (const aiResult of aiResults) {
        if (aiResult.match && aiResult.confidence >= confidenceThresholds.ignore) {
          const matchInfo = {
            id: aiResult.criterionId,
            reason: `AI Semantic: "${aiResult.patientTerm}" ~ "${aiResult.criterionTerm}" - ${aiResult.reasoning}`,
            confidence: aiResult.confidence,
            matchType: 'ai-semantic'
          };

          if (aiResult.confidence >= confidenceThresholds.exclude) {
            exclusions.push(matchInfo);
          } else if (aiResult.confidence >= confidenceThresholds.review) {
            warnings.push(matchInfo);
          }
        }
      }
    }

    // Determine final status
    let status = 'eligible';
    if (exclusions.length > 0) {
      status = 'ineligible';
    } else if (warnings.length > 0) {
      status = 'review';
    }

    return { nctId, status, exclusions, warnings };
  };

  const evaluateCriterion = (criterion, clusterCode, responses, aiMatcher = null) => {
    const patientCluster = responses[clusterCode];
    if (!patientCluster) return { matches: false };

    // Store potential AI matches for fallback
    const pendingAIMatches = [];

    // CMB - Comorbid Conditions
    if (clusterCode === 'CMB') {
      const patientConditions = patientCluster.conditions || [];
      for (const condition of criterion.conditions || []) {
        const conditionTypes = condition.CONDITION_TYPE || [];
        for (const patientCond of patientConditions) {
          const patientStr = patientCond.toLowerCase();
          for (const criterionCond of conditionTypes) {
            const criterionStr = criterionCond.toLowerCase();

            // Exact match - highest confidence
            if (patientStr === criterionStr) {
              return {
                matches: true,
                reason: `Exact match: "${patientCond}" = "${criterionCond}" (${criterion.id})`,
                confidence: 1.0,
                matchType: 'exact'
              };
            }

            // Substring match - high confidence
            if (patientStr.includes(criterionStr) || criterionStr.includes(patientStr)) {
              return {
                matches: true,
                reason: `Substring match: "${patientCond}" ~ "${criterionCond}" (${criterion.id})`,
                confidence: 0.85,
                matchType: 'substring'
              };
            }

            // No exact/substring match - queue for AI semantic matching
            if (aiMatcher) {
              pendingAIMatches.push({
                patientTerm: patientCond,
                criterionTerm: criterionCond,
                context: 'medical condition',
                criterionId: criterion.id
              });
            }
          }
        }
      }
    }

    // PTH - Treatment History
    if (clusterCode === 'PTH') {
      const patientTreatments = patientCluster.treatments || [];
      for (const condition of criterion.conditions || []) {
        const treatmentTypes = condition.TREATMENT_TYPE || [];
        for (const patientTreat of patientTreatments) {
          const patientStr = patientTreat.toLowerCase();
          for (const criterionTreat of treatmentTypes) {
            const criterionStr = criterionTreat.toLowerCase();

            // Substring match for treatments
            if (patientStr.includes(criterionStr) || criterionStr.includes(patientStr)) {
              return {
                matches: true,
                reason: `Treatment match: "${patientTreat}" ~ "${criterionTreat}" (${criterion.id})`,
                confidence: 0.9,
                matchType: 'substring'
              };
            }

            // Queue for AI semantic matching
            if (aiMatcher) {
              pendingAIMatches.push({
                patientTerm: patientTreat,
                criterionTerm: criterionTreat,
                context: 'treatment',
                criterionId: criterion.id
              });
            }
          }
        }
      }
    }

    // Return pending AI matches for batch processing
    if (pendingAIMatches.length > 0) {
      return { matches: false, pendingAIMatches };
    }

    return { matches: false };
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step">
            <h2>Step 1: Comorbid Conditions</h2>
            <p>Do you have any other diseases?</p>
            
            <div className="radio-group">
              <label>
                <input type="radio" checked={cmb.hasConditions === 'yes'} onChange={() => setCmb({ ...cmb, hasConditions: 'yes' })} />
                Yes
              </label>
              <label>
                <input type="radio" checked={cmb.hasConditions === 'no'} onChange={() => setCmb({ ...cmb, hasConditions: 'no', conditions: [] })} />
                No
              </label>
            </div>

            {cmb.hasConditions === 'yes' && (
              <div className="input-group">
                <label>Enter conditions (comma-separated):</label>
                <input
                  type="text"
                  placeholder="e.g., diabetes, hypertension, depression"
                  value={cmb.conditions.join(', ')}
                  onChange={(e) => setCmb({ ...cmb, conditions: e.target.value.split(',').map(c => c.trim()).filter(c => c) })}
                />
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="step">
            <h2>Step 2: Treatment History</h2>
            <p>Have you ever received any treatment for psoriasis?</p>
            
            <div className="radio-group">
              <label>
                <input type="radio" checked={pth.hasTreatment === 'yes'} onChange={() => setPth({ ...pth, hasTreatment: 'yes' })} />
                Yes
              </label>
              <label>
                <input type="radio" checked={pth.hasTreatment === 'no'} onChange={() => setPth({ ...pth, hasTreatment: 'no', treatments: [] })} />
                No
              </label>
            </div>

            {pth.hasTreatment === 'yes' && (
              <div className="input-group">
                <label>Enter treatments (comma-separated):</label>
                <input
                  type="text"
                  placeholder="e.g., Humira, Enbrel, methotrexate"
                  value={pth.treatments.join(', ')}
                  onChange={(e) => setPth({ ...pth, treatments: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                />
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="step">
            <h2>Step 3: Infections</h2>
            <p>Were you diagnosed with any infectious diseases (excluding seasonal flu)?</p>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={aic.infections.includes('None')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAic({ infections: ['None'] });
                    } else {
                      setAic({ infections: [] });
                    }
                  }}
                />
                None
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={aic.infections.includes('HIV')}
                  onChange={(e) => {
                    const infections = aic.infections.filter(i => i !== 'None');
                    if (e.target.checked) {
                      setAic({ infections: [...infections, 'HIV'] });
                    } else {
                      setAic({ infections: infections.filter(i => i !== 'HIV') });
                    }
                  }}
                  disabled={aic.infections.includes('None')}
                />
                HIV
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={aic.infections.includes('Hepatitis')}
                  onChange={(e) => {
                    const infections = aic.infections.filter(i => i !== 'None');
                    if (e.target.checked) {
                      setAic({ infections: [...infections, 'Hepatitis'] });
                    } else {
                      setAic({ infections: infections.filter(i => i !== 'Hepatitis') });
                    }
                  }}
                  disabled={aic.infections.includes('None')}
                />
                Hepatitis
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={aic.infections.includes('Tuberculosis')}
                  onChange={(e) => {
                    const infections = aic.infections.filter(i => i !== 'None');
                    if (e.target.checked) {
                      setAic({ infections: [...infections, 'Tuberculosis'] });
                    } else {
                      setAic({ infections: infections.filter(i => i !== 'Tuberculosis') });
                    }
                  }}
                  disabled={aic.infections.includes('None')}
                />
                Tuberculosis
              </label>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step">
            <h2>Step 4: Affected Area</h2>
            <p>How much of your body is affected?</p>
            
            <div className="input-group">
              <label>BSA (Body Surface Area %):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={aao.BSA}
                onChange={(e) => setAao({ ...aao, BSA: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>PASI Score:</label>
              <input
                type="number"
                min="0"
                max="72"
                value={aao.PASI}
                onChange={(e) => setAao({ ...aao, PASI: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>PGA Score (0-5):</label>
              <input
                type="number"
                min="0"
                max="5"
                value={aao.PGA}
                onChange={(e) => setAao({ ...aao, PGA: e.target.value })}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step">
            <h2>Step 5: Age</h2>
            <p>How old are you?</p>
            
            <div className="input-group">
              <label>Age (years):</label>
              <input
                type="number"
                min="0"
                max="120"
                value={age.age}
                onChange={(e) => setAge({ age: e.target.value })}
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="step">
            <h2>Step 6: Psoriasis Type</h2>
            <p>What form of psoriasis do you have?</p>
            
            <div className="radio-group">
              <label>
                <input type="radio" checked={npv.type === 'Chronic Plaque'} onChange={() => setNpv({ type: 'Chronic Plaque' })} />
                Chronic Plaque
              </label>
              <label>
                <input type="radio" checked={npv.type === 'Guttate'} onChange={() => setNpv({ type: 'Guttate' })} />
                Guttate
              </label>
              <label>
                <input type="radio" checked={npv.type === 'Pustular'} onChange={() => setNpv({ type: 'Pustular' })} />
                Pustular
              </label>
              <label>
                <input type="radio" checked={npv.type === 'Erythrodermic'} onChange={() => setNpv({ type: 'Erythrodermic' })} />
                Erythrodermic
              </label>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="step">
            <h2>Step 7: Disease Duration</h2>
            <p>How long have you had psoriasis?</p>
            
            <div className="input-group">
              <label>Duration:</label>
              <input
                type="number"
                min="0"
                value={cpd.duration}
                onChange={(e) => setCpd({ ...cpd, duration: e.target.value })}
              />
              <select value={cpd.unit} onChange={(e) => setCpd({ ...cpd, unit: e.target.value })}>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="step">
            <h2>Step 8: Severity Scores</h2>
            <p>Do you have illness severity scores in your medical records?</p>
            
            <div className="radio-group">
              <label>
                <input type="radio" checked={sev.hasPASI === 'yes'} onChange={() => setSev({ ...sev, hasPASI: 'yes' })} />
                Yes
              </label>
              <label>
                <input type="radio" checked={sev.hasPASI === 'no'} onChange={() => setSev({ ...sev, hasPASI: 'no', pasiValue: '' })} />
                No
              </label>
            </div>

            {sev.hasPASI === 'yes' && (
              <div className="input-group">
                <label>PASI Value:</label>
                <input
                  type="number"
                  min="0"
                  max="72"
                  value={sev.pasiValue}
                  onChange={(e) => setSev({ ...sev, pasiValue: e.target.value })}
                />
              </div>
            )}
          </div>
        );

      case 9:
        return (
          <div className="step">
            <h2>Step 9: Weight & BMI</h2>
            <p>What is your weight and height?</p>
            
            <div className="input-group">
              <label>Weight (kg):</label>
              <input
                type="number"
                min="0"
                value={bmi.weight}
                onChange={(e) => calculateBMI(e.target.value, bmi.height)}
              />
            </div>

            <div className="input-group">
              <label>Height (cm):</label>
              <input
                type="number"
                min="0"
                value={bmi.height}
                onChange={(e) => calculateBMI(bmi.weight, e.target.value)}
              />
            </div>

            {bmi.bmi && (
              <div className="result-display">
                <strong>Calculated BMI:</strong> {bmi.bmi}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (showResults && matchResults) {
    return (
      <div className="container">
        <h1>🔍 Trial Match Results</h1>

        <div className="summary-cards">
          <div className="summary-card eligible">
            <div className="card-icon">✓</div>
            <div className="card-number">{matchResults.eligible.length}</div>
            <div className="card-label">Eligible Trials</div>
          </div>

          <div className="summary-card review">
            <div className="card-icon">⚠</div>
            <div className="card-number">{matchResults.needsReview.length}</div>
            <div className="card-label">Needs Review</div>
          </div>

          <div className="summary-card ineligible">
            <div className="card-icon">✗</div>
            <div className="card-number">{matchResults.ineligible.length}</div>
            <div className="card-label">Ineligible</div>
          </div>
        </div>

        {/* Eligible Trials */}
        <div className="trials-list">
          <h2>✓ Eligible Trials</h2>
          {matchResults.eligible.length === 0 ? (
            <p>No eligible trials found.</p>
          ) : (
            matchResults.eligible.map((trial, idx) => (
              <div key={idx} className="trial-card eligible">
                <div className="trial-header">
                  <div className="trial-id">{trial.nctId}</div>
                  <span className="trial-badge badge-eligible">ELIGIBLE</span>
                </div>
                <a href={`https://clinicaltrials.gov/study/${trial.nctId}`} target="_blank" rel="noopener noreferrer">
                  View on ClinicalTrials.gov →
                </a>
              </div>
            ))
          )}
        </div>

        {/* Needs Review Trials */}
        {matchResults.needsReview.length > 0 && (
          <div className="trials-list">
            <h2>⚠ Needs Review</h2>
            {matchResults.needsReview.map((trial, idx) => (
              <div key={idx} className="trial-card review">
                <div className="trial-header">
                  <div className="trial-id">{trial.nctId}</div>
                  <span className="trial-badge badge-review">NEEDS REVIEW</span>
                </div>
                <a href={`https://clinicaltrials.gov/study/${trial.nctId}`} target="_blank" rel="noopener noreferrer">
                  View on ClinicalTrials.gov →
                </a>
                {trial.warnings && trial.warnings.length > 0 && (
                  <div className="match-details">
                    <strong>Warnings:</strong>
                    <ul>
                      {trial.warnings.map((warning, widx) => (
                        <li key={widx}>
                          <span className="confidence-badge" style={{
                            backgroundColor: warning.confidence >= 0.7 ? '#ff9800' : '#ffc107'
                          }}>
                            {(warning.confidence * 100).toFixed(0)}% confidence
                          </span>
                          <span className="match-type-badge">{warning.matchType || 'rule'}</span>
                          <br />
                          {warning.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ineligible Trials */}
        {matchResults.ineligible.length > 0 && (
          <div className="trials-list">
            <h2>✗ Ineligible Trials</h2>
            {matchResults.ineligible.map((trial, idx) => (
              <div key={idx} className="trial-card ineligible">
                <div className="trial-header">
                  <div className="trial-id">{trial.nctId}</div>
                  <span className="trial-badge badge-ineligible">INELIGIBLE</span>
                </div>
                <a href={`https://clinicaltrials.gov/study/${trial.nctId}`} target="_blank" rel="noopener noreferrer">
                  View on ClinicalTrials.gov →
                </a>
                {trial.exclusions && trial.exclusions.length > 0 && (
                  <div className="match-details">
                    <strong>Exclusion Reasons:</strong>
                    <ul>
                      {trial.exclusions.map((exclusion, eidx) => (
                        <li key={eidx}>
                          <span className="confidence-badge" style={{
                            backgroundColor: exclusion.confidence >= 0.9 ? '#d32f2f' : '#f44336'
                          }}>
                            {(exclusion.confidence * 100).toFixed(0)}% confidence
                          </span>
                          <span className="match-type-badge">{exclusion.matchType || 'rule'}</span>
                          <br />
                          {exclusion.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-primary" onClick={() => window.location.reload()}>Start Over</button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Clinical Trial Eligibility Questionnaire</h1>

      {/* AI Matching Settings Panel */}
      <div className="settings-panel">
        <button
          className="btn btn-settings"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ {showSettings ? 'Hide' : 'Show'} AI Matching Settings
        </button>

        {showSettings && (
          <div className="settings-content">
            <div className="setting-section">
              <h3>🤖 AI Semantic Matching with Claude</h3>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={useAIMatching}
                    onChange={(e) => setUseAIMatching(e.target.checked)}
                  />
                  Enable AI-powered semantic matching (requires Anthropic API key)
                </label>
              </div>

              {useAIMatching && (
                <>
                  <div className="input-group">
                    <label>Anthropic API Key:</label>
                    <input
                      type="password"
                      placeholder="sk-ant-api..."
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      style={{ fontFamily: 'monospace' }}
                    />
                    <small>Get your key from console.anthropic.com - only used locally, never stored</small>
                  </div>

                  <div className="input-group">
                    <label>Claude Model:</label>
                    <select
                      value={claudeModel}
                      onChange={(e) => setClaudeModel(e.target.value)}
                      style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                    >
                      <option value="claude-opus-4-5-20251101">Claude Opus 4.5 (Most Capable)</option>
                      <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Balanced - Recommended)</option>
                      <option value="claude-3-5-haiku-20241022">Claude Haiku 3.5 (Fastest & Cheapest)</option>
                    </select>
                    <small>Sonnet recommended for balance of speed, cost, and accuracy</small>
                  </div>
                </>
              )}
            </div>

            <div className="setting-section">
              <h3>📊 Confidence Thresholds</h3>
              <p className="threshold-description">
                Adjust how confidence scores affect trial matching results:
              </p>

              <div className="threshold-control">
                <label>
                  <strong>Exclude Threshold:</strong> {(confidenceThresholds.exclude * 100).toFixed(0)}%
                  <br />
                  <small>Confidence ≥ {(confidenceThresholds.exclude * 100).toFixed(0)}% = Patient is EXCLUDED from trial</small>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={confidenceThresholds.exclude * 100}
                  onChange={(e) => setConfidenceThresholds({
                    ...confidenceThresholds,
                    exclude: parseFloat(e.target.value) / 100
                  })}
                  className="threshold-slider exclude"
                />
              </div>

              <div className="threshold-control">
                <label>
                  <strong>Review Threshold:</strong> {(confidenceThresholds.review * 100).toFixed(0)}%
                  <br />
                  <small>Confidence ≥ {(confidenceThresholds.review * 100).toFixed(0)}% and &lt; {(confidenceThresholds.exclude * 100).toFixed(0)}% = Trial NEEDS REVIEW</small>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={confidenceThresholds.review * 100}
                  onChange={(e) => setConfidenceThresholds({
                    ...confidenceThresholds,
                    review: parseFloat(e.target.value) / 100
                  })}
                  className="threshold-slider review"
                />
              </div>

              <div className="threshold-control">
                <label>
                  <strong>Ignore Threshold:</strong> {(confidenceThresholds.ignore * 100).toFixed(0)}%
                  <br />
                  <small>Confidence &lt; {(confidenceThresholds.ignore * 100).toFixed(0)}% = Match is IGNORED</small>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={confidenceThresholds.ignore * 100}
                  onChange={(e) => setConfidenceThresholds({
                    ...confidenceThresholds,
                    ignore: parseFloat(e.target.value) / 100
                  })}
                  className="threshold-slider ignore"
                />
              </div>

              <div className="threshold-preview">
                <strong>Current Configuration:</strong>
                <ul>
                  <li>≥ {(confidenceThresholds.exclude * 100).toFixed(0)}% → <span style={{color: '#d32f2f'}}>Exclude</span></li>
                  <li>{(confidenceThresholds.review * 100).toFixed(0)}% - {(confidenceThresholds.exclude * 100).toFixed(0)}% → <span style={{color: '#ff9800'}}>Review</span></li>
                  <li>&lt; {(confidenceThresholds.ignore * 100).toFixed(0)}% → <span style={{color: '#9e9e9e'}}>Ignore</span></li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(currentStep / totalSteps) * 100}%` }}></div>
      </div>
      <p className="progress-text">Step {currentStep} of {totalSteps}</p>

      {renderStep()}

      <div className="button-group">
        {currentStep > 1 && (
          <button className="btn btn-secondary" onClick={handlePrevious}>← Previous</button>
        )}
        {currentStep < totalSteps ? (
          <button className="btn btn-primary" onClick={handleNext}>Next →</button>
        ) : (
          <button
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={isMatching}
          >
            {isMatching ? 'Matching in progress...' : 'Submit & Match Trials'}
          </button>
        )}
      </div>

      {isMatching && (
        <div className="matching-progress">
          <div className="spinner"></div>
          <p>Analyzing matches{useAIMatching ? ' with AI semantic matching' : ''}...</p>
        </div>
      )}
    </div>
  );
};

export default ClinicalTrialQuestionnaire;
