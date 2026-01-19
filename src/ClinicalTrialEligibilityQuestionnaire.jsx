import React, { useState, useEffect } from 'react';

/**
 * COMPREHENSIVE CLINICAL TRIAL ELIGIBILITY QUESTIONNAIRE
 * Version: 3.0
 * Date: 2026-01-11
 * 
 * This questionnaire systematically evaluates patient eligibility across 9 clusters:
 * 1. Comorbid Conditions (CMB)
 * 2. Psoriasis Treatment History (PTH)
 * 3. Active Infection History (AIC)
 * 4. Affected Area and Organs (AAO)
 * 5. Age-Based Eligibility (AGE)
 * 6. Non-Plaque Psoriasis Variants (NPV)
 * 7. Chronic Plaque Psoriasis Duration (CPD)
 * 8. Severity Scores (SEV)
 * 9. Weight and BMI (BMI)
 */

// ==============================================================================
// IMPORT SLOT-FILLED DATABASE
// ==============================================================================
import SLOT_FILLED_DATABASE from './data/slot-filled-database.json';

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

/**
 * Extract unique values from database for autocomplete/multiselect options
 */
function extractUniqueValues(cluster, fieldName) {
  const values = new Set();
  const criteria = SLOT_FILLED_DATABASE[cluster]?.criteria || [];
  
  criteria.forEach(criterion => {
    if (criterion.conditions) {
      criterion.conditions.forEach(condition => {
        const fieldValue = condition[fieldName];
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach(val => values.add(val));
        } else if (fieldValue && typeof fieldValue === 'string') {
          values.add(fieldValue);
        }
      });
    }
  });
  
  return Array.from(values).sort();
}

/**
 * Merge similar conditions to avoid duplicates
 */
function mergeSimilarConditions(conditions) {
  const conditionMap = new Map();
  
  conditions.forEach(condition => {
    const normalized = condition.toLowerCase().trim();
    if (!conditionMap.has(normalized)) {
      conditionMap.set(normalized, condition);
    }
  });
  
  return Array.from(conditionMap.values());
}

// ==============================================================================
// SLOT-FILLED RESPONSE BUILDER
// ==============================================================================

/**
 * Builds slot-filled response structure matching database format
 */
class SlotFilledResponseBuilder {
  constructor() {
    this.responses = {};
  }

  addComorbidCondition(conditionType, pattern, severity, timeframe, location) {
    if (!this.responses.CMB) this.responses.CMB = [];
    
    this.responses.CMB.push({
      CONDITION_TYPE: conditionType,
      CONDITION_PATTERN: pattern,
      SEVERITY: severity || "none_specified",
      TIMEFRAME: timeframe || null,
      ANATOMICAL_LOCATION: location || []
    });
  }

  addTreatmentHistory(treatmentType, pattern, timeframe, drugClassification) {
    if (!this.responses.PTH) this.responses.PTH = [];
    
    this.responses.PTH.push({
      TREATMENT_TYPE: treatmentType,
      TREATMENT_PATTERN: pattern,
      TIMEFRAME: timeframe || null,
      DRUG_CLASSIFICATION: drugClassification || null
    });
  }

  addInfectionHistory(infectionType, pattern, severity, timeframe, treatment) {
    if (!this.responses.AIC) this.responses.AIC = [];
    
    this.responses.AIC.push({
      INFECTION_TYPE: infectionType,
      INFECTION_PATTERN: pattern,
      SEVERITY: severity || "none_specified",
      TIMEFRAME: timeframe || null,
      TREATMENT_REQUIREMENT: treatment || []
    });
  }

  addAffectedArea(measurementType, value, threshold) {
    if (!this.responses.AAO) this.responses.AAO = {};
    
    this.responses.AAO[measurementType] = {
      value: value,
      threshold: threshold
    };
  }

  setAge(age) {
    this.responses.AGE = { age: age };
  }

  setPsoriasisVariant(variant) {
    this.responses.NPV = { variant: variant };
  }

  setDiseaseDuration(duration, unit) {
    this.responses.CPD = { 
      duration: duration,
      unit: unit
    };
  }

  setSeverityScore(scoreType, value) {
    if (!this.responses.SEV) this.responses.SEV = {};
    this.responses.SEV[scoreType] = value;
  }

  setWeightBMI(weight, height, weightUnit = 'kg', heightUnit = 'cm') {
    this.responses.BMI = {
      weight: { value: weight, unit: weightUnit },
      height: { value: height, unit: heightUnit },
      bmi: this.calculateBMI(weight, height, weightUnit, heightUnit)
    };
  }

  calculateBMI(weight, height, weightUnit, heightUnit) {
    // Convert to kg and meters
    const weightKg = weightUnit === 'lb' ? weight * 0.453592 : weight;
    const heightM = heightUnit === 'in' ? height * 0.0254 : height / 100;
    
    return (weightKg / (heightM * heightM)).toFixed(2);
  }

  getResponse() {
    return {
      timestamp: new Date().toISOString(),
      version: "3.0",
      responses: this.responses
    };
  }
}

// ==============================================================================
// AUTOCOMPLETE COMPONENT
// ==============================================================================

const AutocompleteInput = ({ 
  placeholder, 
  suggestions, 
  value, 
  onChange, 
  hint 
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);

  useEffect(() => {
    if (value && value.length > 0) {
      const filtered = suggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [value, suggestions]);

  return (
    <div style={{ position: 'relative', marginBottom: '10px' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint || placeholder}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '14px'
        }}
        onFocus={() => value && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />
      
      {showSuggestions && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderTop: 'none',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          {filteredSuggestions.map((suggestion, idx) => (
            <div
              key={idx}
              onClick={() => {
                onChange(suggestion);
                setShowSuggestions(false);
              }}
              style={{
                padding: '8px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// MAIN QUESTIONNAIRE COMPONENT
// ==============================================================================

const ClinicalTrialEligibilityQuestionnaire = ({ onSubmit }) => {
  // State for navigation
  const [currentCluster, setCurrentCluster] = useState(0);
  const [completedClusters, setCompletedClusters] = useState(new Set());
  
  // Response builder
  const [responseBuilder] = useState(new SlotFilledResponseBuilder());
  
  // ===========================================================================
  // CLUSTER 1: COMORBID CONDITIONS (CMB)
  // ===========================================================================
  const [cmb_hasConditions, setCmb_hasConditions] = useState('');
  const [cmb_selectedConditions, setCmb_selectedConditions] = useState([]);
  const [cmb_conditionInput, setCmb_conditionInput] = useState('');
  const [cmb_conditionDetails, setCmb_conditionDetails] = useState({});
  
  // Additional common conditions that should always be in suggestions
  // (especially cancer types for synonym matching)
  const ADDITIONAL_CONDITIONS = [
    'lung cancer', 'breast cancer', 'prostate cancer', 'colon cancer',
    'colorectal cancer', 'pancreatic cancer', 'ovarian cancer', 'bladder cancer',
    'kidney cancer', 'liver cancer', 'skin cancer', 'melanoma', 'leukemia',
    'lymphoma', 'brain cancer', 'thyroid cancer', 'cervical cancer',
    'cancer', 'malignancy'
  ];
  
  // Extract unique conditions from database and merge with additional ones
  const cmbConditionOptions = mergeSimilarConditions([
    ...extractUniqueValues('CLUSTER_1_COMORBID_CONDITIONS', 'CONDITION_TYPE'),
    ...ADDITIONAL_CONDITIONS
  ]);
  
  // ===========================================================================
  // CLUSTER 2: PSORIASIS TREATMENT HISTORY (PTH)
  // ===========================================================================
  const [pth_hasTreatment, setPth_hasTreatment] = useState('');
  const [pth_selectedTreatments, setPth_selectedTreatments] = useState([]);
  const [pth_treatmentInput, setPth_treatmentInput] = useState('');
  const [pth_treatmentDetails, setPth_treatmentDetails] = useState({});
  
  // Extract unique treatments from database
  const pthTreatmentOptions = mergeSimilarConditions(
    extractUniqueValues('CLUSTER_2_TREATMENT_HISTORY', 'TREATMENT_TYPE')
  );
  
  // ===========================================================================
  // CLUSTER 3: ACTIVE INFECTION HISTORY (AIC)
  // ===========================================================================
  const [aic_hasInfection, setAic_hasInfection] = useState('');
  const [aic_selectedInfections, setAic_selectedInfections] = useState([]);
  const [aic_infectionDetails, setAic_infectionDetails] = useState({});
  
  // ===========================================================================
  // CLUSTER 4: AFFECTED AREA AND ORGANS (AAO)
  // ===========================================================================
  const [aao_bsa, setAao_bsa] = useState('');
  const [aao_pasi, setAao_pasi] = useState('');
  const [aao_pga, setAao_pga] = useState('');
  const [aao_tjc68, setAao_tjc68] = useState('');
  const [aao_sjc66, setAao_sjc66] = useState('');
  
  // ===========================================================================
  // CLUSTER 5: AGE-BASED ELIGIBILITY (AGE)
  // ===========================================================================
  const [age_value, setAge_value] = useState('');
  
  // ===========================================================================
  // CLUSTER 6: NON-PLAQUE PSORIASIS VARIANTS (NPV)
  // ===========================================================================
  const [npv_variant, setNpv_variant] = useState('');
  
  // ===========================================================================
  // CLUSTER 7: CHRONIC PLAQUE PSORIASIS DURATION (CPD)
  // ===========================================================================
  const [cpd_duration, setCpd_duration] = useState('');
  const [cpd_unit, setCpd_unit] = useState('months');
  
  // ===========================================================================
  // CLUSTER 8: SEVERITY SCORES (SEV)
  // ===========================================================================
  const [sev_hasPASI, setSev_hasPASI] = useState('');
  const [sev_pasiValue, setSev_pasiValue] = useState('');
  const [sev_hasBSA, setSev_hasBSA] = useState('');
  const [sev_bsaValue, setSev_bsaValue] = useState('');
  const [sev_hasPGA, setSev_hasPGA] = useState('');
  const [sev_pgaValue, setSev_pgaValue] = useState('');
  
  // ===========================================================================
  // CLUSTER 9: WEIGHT AND BMI (BMI)
  // ===========================================================================
  const [bmi_weight, setBmi_weight] = useState('');
  const [bmi_weightUnit, setBmi_weightUnit] = useState('kg');
  const [bmi_height, setBmi_height] = useState('');
  const [bmi_heightUnit, setBmi_heightUnit] = useState('cm');
  const [bmi_calculated, setBmi_calculated] = useState(null);
  
  // Calculate BMI when weight/height change
  useEffect(() => {
    if (bmi_weight && bmi_height) {
      const weightKg = bmi_weightUnit === 'lb' ? bmi_weight * 0.453592 : parseFloat(bmi_weight);
      const heightM = bmi_heightUnit === 'in' ? bmi_height * 0.0254 : parseFloat(bmi_height) / 100;
      const bmi = (weightKg / (heightM * heightM)).toFixed(2);
      setBmi_calculated(bmi);
    }
  }, [bmi_weight, bmi_height, bmi_weightUnit, bmi_heightUnit]);
  
  // ===========================================================================
  // CLUSTER DEFINITIONS
  // ===========================================================================
  const clusters = [
    {
      code: 'CMB',
      name: 'Comorbid Conditions and Risk Factors',
      primary_question: 'Do you have any other diseases?',
      component: renderCMBCluster
    },
    {
      code: 'PTH',
      name: 'Psoriasis Treatment History and Restrictions',
      primary_question: 'Have you ever received any treatment for your disease?',
      component: renderPTHCluster
    },
    {
      code: 'AIC',
      name: 'Active Infection History Criteria',
      primary_question: 'Were you diagnosed with any infectious diseases (excluding seasonal flu)?',
      component: renderAICCluster
    },
    {
      code: 'AAO',
      name: 'Affected Area and Organs',
      primary_question: 'How much of your body is affected?',
      component: renderAAOCluster
    },
    {
      code: 'AGE',
      name: 'Age-Based Eligibility Criteria',
      primary_question: 'How old are you?',
      component: renderAGECluster
    },
    {
      code: 'NPV',
      name: 'Non-Plaque Psoriasis Variants',
      primary_question: 'What form of psoriasis do you have?',
      component: renderNPVCluster
    },
    {
      code: 'CPD',
      name: 'Chronic Plaque Psoriasis Duration Criteria',
      primary_question: 'How long have you had psoriasis or psoriatic arthritis?',
      component: renderCPDCluster
    },
    {
      code: 'SEV',
      name: 'Severity Scores',
      primary_question: 'Do you have illness severity scores in your medical records?',
      component: renderSEVCluster
    },
    {
      code: 'BMI',
      name: 'Weight and Body Mass Index Criteria',
      primary_question: 'What is your weight and height?',
      component: renderBMICluster
    }
  ];
  
  // ===========================================================================
  // RENDER FUNCTIONS FOR EACH CLUSTER
  // ===========================================================================
  
  function renderCMBCluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Comorbid Conditions and Risk Factors</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[0].primary_question}
        </p>
        
        {/* Primary Question */}
        <div style={{ marginBottom: '20px' }}>
          <label>
            <input
              type="radio"
              value="yes"
              checked={cmb_hasConditions === 'yes'}
              onChange={(e) => setCmb_hasConditions(e.target.value)}
            />
            {' '}Yes
          </label>
          <br />
          <label>
            <input
              type="radio"
              value="no"
              checked={cmb_hasConditions === 'no'}
              onChange={(e) => setCmb_hasConditions(e.target.value)}
            />
            {' '}No
          </label>
        </div>
        
        {/* Follow-up: Which conditions? */}
        {cmb_hasConditions === 'yes' && (
          <div style={{ marginLeft: '20px', marginTop: '20px' }}>
            <h3>Which conditions do you have?</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Start typing to see suggestions, or type your own
            </p>
            
            <AutocompleteInput
              placeholder="Type condition name..."
              hint="e.g., depression, heart failure, diabetes"
              suggestions={cmbConditionOptions}
              value={cmb_conditionInput}
              onChange={setCmb_conditionInput}
            />
            
            <button
              onClick={() => {
                if (cmb_conditionInput && !cmb_selectedConditions.includes(cmb_conditionInput)) {
                  setCmb_selectedConditions([...cmb_selectedConditions, cmb_conditionInput]);
                  setCmb_conditionInput('');
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Condition
            </button>
            
            {/* Display selected conditions */}
            {cmb_selectedConditions.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4>Selected Conditions:</h4>
                {cmb_selectedConditions.map((condition, idx) => (
                  <div key={idx} style={{ 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    marginBottom: '10px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <strong>{condition}</strong>
                    <button
                      onClick={() => {
                        setCmb_selectedConditions(
                          cmb_selectedConditions.filter((_, i) => i !== idx)
                        );
                      }}
                      style={{
                        marginLeft: '10px',
                        padding: '4px 8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                    
                    {/* Follow-up questions for this condition */}
                    {renderConditionFollowUps(condition, idx)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  function renderConditionFollowUps(condition, idx) {
    const details = cmb_conditionDetails[idx] || {};
    
    return (
      <div style={{ marginTop: '15px', paddingLeft: '20px', borderLeft: '3px solid #007bff' }}>
        {/* Pattern: Current or History? */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            When did you have this condition?
          </label>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input
              type="checkbox"
              checked={details.pattern?.includes('current') || false}
              onChange={(e) => {
                const newDetails = { ...cmb_conditionDetails };
                if (!newDetails[idx]) newDetails[idx] = { pattern: [] };
                if (!newDetails[idx].pattern) newDetails[idx].pattern = [];
                
                if (e.target.checked) {
                  newDetails[idx].pattern = [...newDetails[idx].pattern, 'current'];
                } else {
                  newDetails[idx].pattern = newDetails[idx].pattern.filter(p => p !== 'current');
                }
                setCmb_conditionDetails(newDetails);
              }}
            />
            {' '}Currently have it
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={details.pattern?.includes('history') || false}
              onChange={(e) => {
                const newDetails = { ...cmb_conditionDetails };
                if (!newDetails[idx]) newDetails[idx] = { pattern: [] };
                if (!newDetails[idx].pattern) newDetails[idx].pattern = [];
                
                if (e.target.checked) {
                  newDetails[idx].pattern = [...newDetails[idx].pattern, 'history'];
                } else {
                  newDetails[idx].pattern = newDetails[idx].pattern.filter(p => p !== 'history');
                }
                setCmb_conditionDetails(newDetails);
              }}
            />
            {' '}Had it in the past
          </label>
        </div>
        
        {/* Timeframe (if history) */}
        {details.pattern?.includes('history') && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
              When was your last episode?
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Number"
                value={details.timeframe_amount || ''}
                onChange={(e) => {
                  const newDetails = { ...cmb_conditionDetails };
                  if (!newDetails[idx]) newDetails[idx] = {};
                  newDetails[idx].timeframe_amount = e.target.value;
                  setCmb_conditionDetails(newDetails);
                }}
                style={{ width: '80px', padding: '6px' }}
              />
              <select
                value={details.timeframe_unit || 'weeks'}
                onChange={(e) => {
                  const newDetails = { ...cmb_conditionDetails };
                  if (!newDetails[idx]) newDetails[idx] = {};
                  newDetails[idx].timeframe_unit = e.target.value;
                  setCmb_conditionDetails(newDetails);
                }}
                style={{ padding: '6px' }}
              >
                <option value="days">days ago</option>
                <option value="weeks">weeks ago</option>
                <option value="months">months ago</option>
                <option value="years">years ago</option>
              </select>
            </div>
          </div>
        )}
        
        {/* Severity */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            How severe is/was it?
          </label>
          <select
            value={details.severity || 'none_specified'}
            onChange={(e) => {
              const newDetails = { ...cmb_conditionDetails };
              if (!newDetails[idx]) newDetails[idx] = {};
              newDetails[idx].severity = e.target.value;
              setCmb_conditionDetails(newDetails);
            }}
            style={{ width: '100%', padding: '6px' }}
          >
            <option value="none_specified">Not specified</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="significant">Clinically significant</option>
          </select>
        </div>
      </div>
    );
  }
  
  function renderPTHCluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Psoriasis Treatment History</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[1].primary_question}
        </p>
        
        {/* Primary Question */}
        <div style={{ marginBottom: '20px' }}>
          <label>
            <input
              type="radio"
              value="yes"
              checked={pth_hasTreatment === 'yes'}
              onChange={(e) => setPth_hasTreatment(e.target.value)}
            />
            {' '}Yes
          </label>
          <br />
          <label>
            <input
              type="radio"
              value="no"
              checked={pth_hasTreatment === 'no'}
              onChange={(e) => setPth_hasTreatment(e.target.value)}
            />
            {' '}No
          </label>
        </div>
        
        {/* Follow-up: Which treatments? */}
        {pth_hasTreatment === 'yes' && (
          <div style={{ marginLeft: '20px', marginTop: '20px' }}>
            <h3>Which treatments have you received?</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Start typing medication name (e.g., humira, cosentyx, methotrexate)
            </p>
            
            <AutocompleteInput
              placeholder="Type medication name..."
              hint="e.g., humira, cosentyx, skyrizi, methotrexate"
              suggestions={pthTreatmentOptions}
              value={pth_treatmentInput}
              onChange={setPth_treatmentInput}
            />
            
            <button
              onClick={() => {
                if (pth_treatmentInput && !pth_selectedTreatments.includes(pth_treatmentInput)) {
                  setPth_selectedTreatments([...pth_selectedTreatments, pth_treatmentInput]);
                  setPth_treatmentInput('');
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Treatment
            </button>
            
            {/* Display selected treatments */}
            {pth_selectedTreatments.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4>Selected Treatments:</h4>
                {pth_selectedTreatments.map((treatment, idx) => (
                  <div key={idx} style={{ 
                    padding: '10px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    marginBottom: '10px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <strong>{treatment}</strong>
                    <button
                      onClick={() => {
                        setPth_selectedTreatments(
                          pth_selectedTreatments.filter((_, i) => i !== idx)
                        );
                      }}
                      style={{
                        marginLeft: '10px',
                        padding: '4px 8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                    
                    {/* Follow-up questions for this treatment */}
                    {renderTreatmentFollowUps(treatment, idx)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  function renderTreatmentFollowUps(treatment, idx) {
    const details = pth_treatmentDetails[idx] || {};
    
    return (
      <div style={{ marginTop: '15px', paddingLeft: '20px', borderLeft: '3px solid #28a745' }}>
        {/* Pattern: Currently using or used previously? */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            Are you currently using this treatment?
          </label>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            <input
              type="radio"
              name={`pattern_${idx}`}
              value="ongoing"
              checked={details.pattern === 'ongoing'}
              onChange={(e) => {
                const newDetails = { ...pth_treatmentDetails };
                if (!newDetails[idx]) newDetails[idx] = {};
                newDetails[idx].pattern = e.target.value;
                setPth_treatmentDetails(newDetails);
              }}
            />
            {' '}Yes, currently using
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              name={`pattern_${idx}`}
              value="used previously"
              checked={details.pattern === 'used previously'}
              onChange={(e) => {
                const newDetails = { ...pth_treatmentDetails };
                if (!newDetails[idx]) newDetails[idx] = {};
                newDetails[idx].pattern = e.target.value;
                setPth_treatmentDetails(newDetails);
              }}
            />
            {' '}No, used previously
          </label>
        </div>
        
        {/* Timeframe (if used previously) */}
        {details.pattern === 'used previously' && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
              When did you last use this treatment?
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Number"
                value={details.timeframe_weeks || ''}
                onChange={(e) => {
                  const newDetails = { ...pth_treatmentDetails };
                  if (!newDetails[idx]) newDetails[idx] = {};
                  newDetails[idx].timeframe_weeks = e.target.value;
                  setPth_treatmentDetails(newDetails);
                }}
                style={{ width: '80px', padding: '6px' }}
              />
              <span>weeks ago</span>
            </div>
          </div>
        )}
        
        {/* Treatment Response */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            How did you respond to this treatment?
          </label>
          <select
            value={details.response || 'not_specified'}
            onChange={(e) => {
              const newDetails = { ...pth_treatmentDetails };
              if (!newDetails[idx]) newDetails[idx] = {};
              newDetails[idx].response = e.target.value;
              setPth_treatmentDetails(newDetails);
            }}
            style={{ width: '100%', padding: '6px' }}
          >
            <option value="not_specified">Not specified</option>
            <option value="good_response">Good response</option>
            <option value="partial_response">Partial response</option>
            <option value="no_response">No response</option>
            <option value="lost_response">Lost response over time</option>
            <option value="intolerant">Could not tolerate (side effects)</option>
          </select>
        </div>
      </div>
    );
  }
  
  function renderAICCluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Active Infection History</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[2].primary_question}
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label>
            <input
              type="radio"
              value="yes"
              checked={aic_hasInfection === 'yes'}
              onChange={(e) => setAic_hasInfection(e.target.value)}
            />
            {' '}Yes
          </label>
          <br />
          <label>
            <input
              type="radio"
              value="no"
              checked={aic_hasInfection === 'no'}
              onChange={(e) => setAic_hasInfection(e.target.value)}
            />
            {' '}No
          </label>
        </div>
        
        {aic_hasInfection === 'yes' && (
          <div style={{ marginLeft: '20px' }}>
            <h3>Please select any infections you've had:</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Select all that apply
            </p>
            
            {[
              'HIV',
              'Hepatitis B',
              'Hepatitis C',
              'Tuberculosis',
              'COVID-19',
              'Herpes Zoster (Shingles)',
              'Bacterial infection',
              'Fungal infection',
              'Opportunistic infection'
            ].map((infection) => (
              <label key={infection} style={{ display: 'block', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={aic_selectedInfections.includes(infection)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAic_selectedInfections([...aic_selectedInfections, infection]);
                    } else {
                      setAic_selectedInfections(
                        aic_selectedInfections.filter(i => i !== infection)
                      );
                    }
                  }}
                />
                {' '}{infection}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  function renderAAOCluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Affected Area and Organs</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[3].primary_question}
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            Body Surface Area (BSA) - Percentage of body affected:
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={aao_bsa}
            onChange={(e) => setAao_bsa(e.target.value)}
            placeholder="Enter BSA percentage"
            style={{ width: '200px', padding: '6px' }}
          />
          <span style={{ marginLeft: '8px' }}>%</span>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            PASI Score (Psoriasis Area and Severity Index):
          </label>
          <input
            type="number"
            min="0"
            max="72"
            step="0.1"
            value={aao_pasi}
            onChange={(e) => setAao_pasi(e.target.value)}
            placeholder="Enter PASI score"
            style={{ width: '200px', padding: '6px' }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            PGA Score (Physician Global Assessment):
          </label>
          <select
            value={aao_pga}
            onChange={(e) => setAao_pga(e.target.value)}
            style={{ width: '200px', padding: '6px' }}
          >
            <option value="">Select PGA</option>
            <option value="0">0 - Clear</option>
            <option value="1">1 - Almost Clear</option>
            <option value="2">2 - Mild</option>
            <option value="3">3 - Moderate</option>
            <option value="4">4 - Severe</option>
            <option value="5">5 - Very Severe</option>
          </select>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            TJC68 (Tender Joint Count - 68 joints):
          </label>
          <input
            type="number"
            min="0"
            max="68"
            value={aao_tjc68}
            onChange={(e) => setAao_tjc68(e.target.value)}
            placeholder="Enter tender joint count"
            style={{ width: '200px', padding: '6px' }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            SJC66 (Swollen Joint Count - 66 joints):
          </label>
          <input
            type="number"
            min="0"
            max="66"
            value={aao_sjc66}
            onChange={(e) => setAao_sjc66(e.target.value)}
            placeholder="Enter swollen joint count"
            style={{ width: '200px', padding: '6px' }}
          />
        </div>
      </div>
    );
  }
  
  function renderAGECluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Age-Based Eligibility</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[4].primary_question}
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            Your age in years:
          </label>
          <input
            type="number"
            min="0"
            max="120"
            value={age_value}
            onChange={(e) => setAge_value(e.target.value)}
            placeholder="Enter your age"
            style={{ width: '200px', padding: '8px', fontSize: '16px' }}
          />
          <span style={{ marginLeft: '8px' }}>years</span>
        </div>
      </div>
    );
  }
  
  function renderNPVCluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Non-Plaque Psoriasis Variants</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[5].primary_question}
        </p>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="radio"
              value="chronic_plaque"
              checked={npv_variant === 'chronic_plaque'}
              onChange={(e) => setNpv_variant(e.target.value)}
            />
            {' '}Chronic Plaque Psoriasis
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="radio"
              value="guttate"
              checked={npv_variant === 'guttate'}
              onChange={(e) => setNpv_variant(e.target.value)}
            />
            {' '}Guttate Psoriasis
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="radio"
              value="pustular"
              checked={npv_variant === 'pustular'}
              onChange={(e) => setNpv_variant(e.target.value)}
            />
            {' '}Pustular Psoriasis
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="radio"
              value="erythrodermic"
              checked={npv_variant === 'erythrodermic'}
              onChange={(e) => setNpv_variant(e.target.value)}
            />
            {' '}Erythrodermic Psoriasis
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="radio"
              value="inverse"
              checked={npv_variant === 'inverse'}
              onChange={(e) => setNpv_variant(e.target.value)}
            />
            {' '}Inverse Psoriasis
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="radio"
              value="nail"
              checked={npv_variant === 'nail'}
              onChange={(e) => setNpv_variant(e.target.value)}
            />
            {' '}Nail Psoriasis
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="radio"
              value="scalp"
              checked={npv_variant === 'scalp'}
              onChange={(e) => setNpv_variant(e.target.value)}
            />
            {' '}Scalp Psoriasis
          </label>
        </div>
      </div>
    );
  }
  
  function renderCPDCluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Chronic Plaque Psoriasis Duration</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[6].primary_question}
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            Duration:
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              value={cpd_duration}
              onChange={(e) => setCpd_duration(e.target.value)}
              placeholder="Enter duration"
              style={{ width: '120px', padding: '6px' }}
            />
            <select
              value={cpd_unit}
              onChange={(e) => setCpd_unit(e.target.value)}
              style={{ padding: '6px' }}
            >
              <option value="months">months</option>
              <option value="years">years</option>
            </select>
          </div>
        </div>
      </div>
    );
  }
  
  function renderSEVCluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Severity Scores</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[7].primary_question}
        </p>
        
        {/* PASI */}
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '10px' }}>
            Do you have a PASI (Psoriasis Area and Severity Index) score?
          </label>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ marginRight: '20px' }}>
              <input
                type="radio"
                value="yes"
                checked={sev_hasPASI === 'yes'}
                onChange={(e) => setSev_hasPASI(e.target.value)}
              />
              {' '}Yes
            </label>
            <label>
              <input
                type="radio"
                value="no"
                checked={sev_hasPASI === 'no'}
                onChange={(e) => setSev_hasPASI(e.target.value)}
              />
              {' '}No
            </label>
          </div>
          {sev_hasPASI === 'yes' && (
            <div style={{ marginLeft: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>PASI Score (0-72):</label>
              <input
                type="number"
                min="0"
                max="72"
                step="0.1"
                value={sev_pasiValue}
                onChange={(e) => setSev_pasiValue(e.target.value)}
                style={{ width: '150px', padding: '6px' }}
              />
            </div>
          )}
        </div>
        
        {/* BSA */}
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '10px' }}>
            Do you have a BSA (Body Surface Area) percentage?
          </label>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ marginRight: '20px' }}>
              <input
                type="radio"
                value="yes"
                checked={sev_hasBSA === 'yes'}
                onChange={(e) => setSev_hasBSA(e.target.value)}
              />
              {' '}Yes
            </label>
            <label>
              <input
                type="radio"
                value="no"
                checked={sev_hasBSA === 'no'}
                onChange={(e) => setSev_hasBSA(e.target.value)}
              />
              {' '}No
            </label>
          </div>
          {sev_hasBSA === 'yes' && (
            <div style={{ marginLeft: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>BSA Percentage (0-100%):</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={sev_bsaValue}
                onChange={(e) => setSev_bsaValue(e.target.value)}
                style={{ width: '150px', padding: '6px' }}
              />
              <span style={{ marginLeft: '5px' }}>%</span>
            </div>
          )}
        </div>
        
        {/* PGA */}
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '10px' }}>
            Do you have a PGA (Physician Global Assessment) score?
          </label>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ marginRight: '20px' }}>
              <input
                type="radio"
                value="yes"
                checked={sev_hasPGA === 'yes'}
                onChange={(e) => setSev_hasPGA(e.target.value)}
              />
              {' '}Yes
            </label>
            <label>
              <input
                type="radio"
                value="no"
                checked={sev_hasPGA === 'no'}
                onChange={(e) => setSev_hasPGA(e.target.value)}
              />
              {' '}No
            </label>
          </div>
          {sev_hasPGA === 'yes' && (
            <div style={{ marginLeft: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>PGA Score:</label>
              <select
                value={sev_pgaValue}
                onChange={(e) => setSev_pgaValue(e.target.value)}
                style={{ width: '200px', padding: '6px' }}
              >
                <option value="">Select PGA</option>
                <option value="0">0 - Clear</option>
                <option value="1">1 - Almost Clear</option>
                <option value="2">2 - Mild</option>
                <option value="3">3 - Moderate</option>
                <option value="4">4 - Severe</option>
                <option value="5">5 - Very Severe</option>
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  function renderBMICluster() {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Weight and BMI</h2>
        <p style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '500' }}>
          {clusters[8].primary_question}
        </p>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            Weight:
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              step="0.1"
              value={bmi_weight}
              onChange={(e) => setBmi_weight(e.target.value)}
              placeholder="Enter weight"
              style={{ width: '120px', padding: '6px' }}
            />
            <select
              value={bmi_weightUnit}
              onChange={(e) => setBmi_weightUnit(e.target.value)}
              style={{ padding: '6px' }}
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px' }}>
            Height:
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              step="0.1"
              value={bmi_height}
              onChange={(e) => setBmi_height(e.target.value)}
              placeholder="Enter height"
              style={{ width: '120px', padding: '6px' }}
            />
            <select
              value={bmi_heightUnit}
              onChange={(e) => setBmi_heightUnit(e.target.value)}
              style={{ padding: '6px' }}
            >
              <option value="cm">cm</option>
              <option value="in">in</option>
            </select>
          </div>
        </div>
        
        {bmi_calculated && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#e7f3ff',
            border: '1px solid #0066cc',
            borderRadius: '4px'
          }}>
            <strong>Calculated BMI:</strong> {bmi_calculated}
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              {parseFloat(bmi_calculated) < 18.5 && 'Underweight'}
              {parseFloat(bmi_calculated) >= 18.5 && parseFloat(bmi_calculated) < 25 && 'Normal weight'}
              {parseFloat(bmi_calculated) >= 25 && parseFloat(bmi_calculated) < 30 && 'Overweight'}
              {parseFloat(bmi_calculated) >= 30 && 'Obese'}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // ===========================================================================
  // BUILD SLOT-FILLED RESPONSE
  // ===========================================================================
  
  function buildSlotFilledResponse() {
    const builder = new SlotFilledResponseBuilder();
    
    // CMB - Comorbid Conditions
    if (cmb_hasConditions === 'yes') {
      cmb_selectedConditions.forEach((condition, idx) => {
        const details = cmb_conditionDetails[idx] || {};
        builder.addComorbidCondition(
          [condition],
          details.pattern || [],
          details.severity || 'none_specified',
          details.timeframe_amount && details.timeframe_unit ? {
            relation: 'within',
            amount: parseInt(details.timeframe_amount),
            unit: details.timeframe_unit,
            reference: 'screening'
          } : null,
          []
        );
      });
    }
    
    // PTH - Treatment History
    if (pth_hasTreatment === 'yes') {
      pth_selectedTreatments.forEach((treatment, idx) => {
        const details = pth_treatmentDetails[idx] || {};
        builder.addTreatmentHistory(
          [treatment],
          [details.pattern || 'not_specified'],
          details.timeframe_weeks ? {
            relation: 'within',
            amount: parseInt(details.timeframe_weeks),
            unit: 'weeks',
            reference: 'last use'
          } : null,
          null // Drug classification would come from medication database lookup
        );
      });
    }
    
    // AIC - Infections
    if (aic_hasInfection === 'yes') {
      aic_selectedInfections.forEach(infection => {
        builder.addInfectionHistory(
          [infection],
          [],
          'none_specified',
          null,
          []
        );
      });
    }
    
    // AAO - Affected Area
    if (aao_bsa || aao_pasi || aao_pga) {
      if (aao_bsa) builder.addAffectedArea('BSA', parseFloat(aao_bsa), null);
      if (aao_pasi) builder.addAffectedArea('PASI', parseFloat(aao_pasi), null);
      if (aao_pga) builder.addAffectedArea('PGA', parseFloat(aao_pga), null);
    }
    
    // AGE
    if (age_value) {
      builder.setAge(parseInt(age_value));
    }
    
    // NPV
    if (npv_variant) {
      builder.setPsoriasisVariant(npv_variant);
    }
    
    // CPD
    if (cpd_duration) {
      builder.setDiseaseDuration(parseInt(cpd_duration), cpd_unit);
    }
    
    // SEV
    if (sev_pasiValue) builder.setSeverityScore('PASI', parseFloat(sev_pasiValue));
    if (sev_bsaValue) builder.setSeverityScore('BSA', parseFloat(sev_bsaValue));
    if (sev_pgaValue) builder.setSeverityScore('PGA', parseFloat(sev_pgaValue));
    
    // BMI
    if (bmi_weight && bmi_height) {
      builder.setWeightBMI(
        parseFloat(bmi_weight),
        parseFloat(bmi_height),
        bmi_weightUnit,
        bmi_heightUnit
      );
    }
    
    return builder.getResponse();
  }
  
  // ===========================================================================
  // NAVIGATION & RENDERING
  // ===========================================================================
  
  const handleNext = () => {
    setCompletedClusters(new Set([...completedClusters, currentCluster]));
    if (currentCluster < clusters.length - 1) {
      setCurrentCluster(currentCluster + 1);
    }
  };
  
  const handlePrevious = () => {
    if (currentCluster > 0) {
      setCurrentCluster(currentCluster - 1);
    }
  };
  
  const handleSubmit = () => {
    const response = buildSlotFilledResponse();
    console.log('SLOT-FILLED PATIENT RESPONSE:', JSON.stringify(response, null, 2));

    // Call the parent component's onSubmit handler if provided
    if (onSubmit) {
      onSubmit(response);
    } else {
      // Fallback for standalone usage
      alert('Questionnaire submitted! Check console for slot-filled response.');
    }
  };
  
  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================
  
  return (
    <div style={{ 
      maxWidth: '900px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        Clinical Trial Eligibility Questionnaire
      </h1>
      
      {/* Progress Bar */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '10px'
        }}>
          {clusters.map((cluster, idx) => (
            <div
              key={cluster.code}
              style={{
                flex: 1,
                height: '8px',
                backgroundColor: idx <= currentCluster ? '#007bff' : '#ddd',
                marginRight: idx < clusters.length - 1 ? '4px' : '0',
                borderRadius: '4px'
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Step {currentCluster + 1} of {clusters.length}: {clusters[currentCluster].name}
        </div>
      </div>
      
      {/* Current Cluster Content */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        padding: '20px',
        backgroundColor: '#fafafa',
        minHeight: '400px'
      }}>
        {clusters[currentCluster].component()}
      </div>
      
      {/* Navigation Buttons */}
      <div style={{ 
        marginTop: '30px', 
        display: 'flex', 
        justifyContent: 'space-between' 
      }}>
        <button
          onClick={handlePrevious}
          disabled={currentCluster === 0}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: currentCluster === 0 ? '#ccc' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: currentCluster === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          Previous
        </button>
        
        {currentCluster < clusters.length - 1 ? (
          <button
            onClick={handleNext}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Submit & Find Matching Trials
          </button>
        )}
      </div>
      
      {/* Debug: Show slot-filled response preview */}
      <details style={{ marginTop: '40px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
          🔍 Developer View: Current Slot-Filled Response
        </summary>
        <pre style={{ 
          backgroundColor: '#f4f4f4', 
          padding: '15px', 
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '12px'
        }}>
          {JSON.stringify(buildSlotFilledResponse(), null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default ClinicalTrialEligibilityQuestionnaire;
