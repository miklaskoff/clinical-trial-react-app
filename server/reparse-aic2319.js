/**
 * Re-parse AIC_2319 with updated FIELD_CATALOG v2.2 rules
 * Tests: Semicolon branch separation, timeframe scope, treatment vs condition classification
 */

const AIC_2319_RAW = {
  id: 'AIC_2319',
  nct_id: 'NCT07033234',
  raw_text: 'Known history of recurrent or chronic infections, or prior history of chronic or recurrent infections, including but not limited to: chronic renal infection, chronic chest infection (e.g., bronchiectasis), symptomatic urinary tract infection, and open, draining, or infected skin wounds; history of serious infections (e.g., sepsis, pneumonia, and pyelonephritis), or hospitalization or treatment with intravenous antibiotics for infections within 2 months before screening',
  original: {
    code: 'chronic_infections',
    parsed_category: 'Concomitant Medical Conditions/Comorbidities',
    criterion_type: 'exclusion'
  }
};

async function reparseAIC2319() {
  console.log('🔄 Re-parsing AIC_2319 with FIELD_CATALOG v2.2 rules...\n');
  console.log('📝 Raw text:');
  console.log(AIC_2319_RAW.raw_text);
  console.log('\n' + '='.repeat(80) + '\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/parser/criterion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criterion: AIC_2319_RAW,
        cluster: 'AIC'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Parsed successfully!\n');
    console.log('Full response structure:', Object.keys(result));
    
    // Get the parsed data - might be result.parsed or result directly
    const parsed = result.parsed || result;
    console.log(JSON.stringify(parsed, null, 2));
    
    // Validate against our new rules
    console.log('\n' + '='.repeat(80));
    console.log('📋 VALIDATION AGAINST v2.2 RULES:\n');
    
    // Check 1: TREATMENT_HISTORY has hospitalization
    const hasTreatmentHistory = parsed.TREATMENT_HISTORY && Array.isArray(parsed.TREATMENT_HISTORY);
    const hasHospitalization = hasTreatmentHistory && 
      parsed.TREATMENT_HISTORY.some(t => t.treatment?.toLowerCase().includes('hospitalization'));
    const hasIVAbx = hasTreatmentHistory && 
      parsed.TREATMENT_HISTORY.some(t => t.treatment?.toLowerCase().includes('intravenous') || t.treatment?.toLowerCase().includes('iv'));
    
    console.log(`1. TREATMENT_HISTORY has hospitalization: ${hasHospitalization ? '✅' : '❌'}`);
    console.log(`2. TREATMENT_HISTORY has IV antibiotics: ${hasIVAbx ? '✅' : '❌'}`);
    
    // Check 2: No treatment events in NESTED_CONDITION
    const nestedCondition = parsed.NESTED_CONDITION;
    let treatmentInNested = false;
    if (nestedCondition?.nested_items) {
      for (const item of nestedCondition.nested_items) {
        if (item.values?.some(v => 
          v.toLowerCase().includes('hospitalization') || 
          v.toLowerCase().includes('intravenous'))) {
          treatmentInNested = true;
        }
      }
    }
    console.log(`3. No treatment events in NESTED_CONDITION: ${!treatmentInNested ? '✅' : '❌'}`);
    
    // Check 3: TREATMENT_HISTORY has timing
    const treatmentsHaveTiming = hasTreatmentHistory && 
      parsed.TREATMENT_HISTORY.every(t => t.timing && t.timing.amount);
    console.log(`4. TREATMENT_HISTORY entries have timing: ${treatmentsHaveTiming ? '✅' : '❌'}`);
    
    // Check 4: _parsing_notes present
    const hasParsingNotes = !!parsed._parsing_notes;
    console.log(`5. _parsing_notes documents scope: ${hasParsingNotes ? '✅' : '⚠️ (optional)'}`);
    
    // Check 5: LOGICAL_OPERATOR is OR
    console.log(`6. LOGICAL_OPERATOR is OR: ${parsed.LOGICAL_OPERATOR === 'OR' ? '✅' : '❌'}`);
    
    return result.parsed;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.log('\n⚠️ Make sure the backend server is running on port 3001');
      console.log('   Run: cd server && npm run dev');
    }
    
    process.exit(1);
  }
}

reparseAIC2319();
