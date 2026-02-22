/**
 * Test script for the 100% LLM parser
 */

const sampleCriteria = [
  {
    id: 2473,
    raw_text: "Patients with psychoneuro-related diseases or history (such as depression, epilepsy), which affect medication compliance or the researcher's clinical judgment of suicide risk",
    cluster: "CMB"
  },
  {
    id: 2472,
    raw_text: "Known malignant tumors or history of malignant tumors (excluding clinically cured skin basal cell carcinoma, skin squamous cell carcinoma, cervical carcinoma in situ)",
    cluster: "CMB"
  },
  {
    id: 2467,
    raw_text: "The presence of decompensated cardiac insufficiency (New York Heart Disease Association (NYHA) class III or IV) within 6 months prior to screening",
    cluster: "CMB"
  }
];

async function testParser() {
  console.log("=== 100% LLM Parser Test ===\n");
  
  for (const criterion of sampleCriteria) {
    console.log(`\n--- Criterion ID: ${criterion.id} ---`);
    console.log(`Raw text: ${criterion.raw_text.substring(0, 80)}...`);
    
    try {
      const response = await fetch('http://localhost:3001/api/parser/criterion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criterion: { id: criterion.id, raw_text: criterion.raw_text },
          cluster: criterion.cluster
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else {
        console.log("\n✅ SLOT-FILLED OUTPUT:");
        // Result is the full parsed criterion object directly
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    
    console.log("\n" + "=".repeat(60));
  }
}

testParser().catch(console.error);
