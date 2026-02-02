/**
 * AIC Cluster Parser - Parses Active Infection Criteria
 * Outputs complete slot-filled database structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_FILE = path.join(__dirname, 'data', 'test-aic-criteria.json');
const OUTPUT_FILE = path.join(__dirname, 'data', 'slot-filled-aic-output.json');
const BATCH_SIZE = 1;  // One at a time to stay within rate limits
const DELAY_BETWEEN_BATCHES = 65000;  // 65 seconds - Claude API limit
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 120000;  // 2 minutes for first retry
const SERVER_RETRY_DELAY = 10000;  // 10 seconds for server connection issues
const MAX_CRITERIA_TO_PARSE = 30;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:3001/api/health', { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) 
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`    🔄 Checking server connection (attempt ${attempt}/${maxAttempts})...`);
    
    if (await checkServerHealth()) {
      console.log(`    ✅ Server is available`);
      return true;
    }
    
    if (attempt < maxAttempts) {
      console.log(`    ⏳ Server not responding. Waiting ${SERVER_RETRY_DELAY / 1000}s...`);
      await sleep(SERVER_RETRY_DELAY);
    }
  }
  
  console.log(`    ❌ Server unavailable after ${maxAttempts} attempts`);
  return false;
}

async function parseCriterionWithRetry(criterion, retryCount = 0) {
  try {
    return await parseCriterion(criterion);
  } catch (error) {
    const is429 = error.message.includes('429') || error.message.includes('rate');
    const isFetchFailed = error.message.includes('fetch failed') || 
                          error.message.includes('ECONNREFUSED') ||
                          error.message.includes('network') ||
                          error.cause?.code === 'ECONNREFUSED';
    
    if (is429 && retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`    ⏳ Rate limited. Waiting ${delay / 1000}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await sleep(delay);
      return parseCriterionWithRetry(criterion, retryCount + 1);
    }
    
    if (isFetchFailed && retryCount < MAX_RETRIES) {
      console.log(`    ⚠️ Server connection failed. Attempting to reconnect...`);
      const serverAvailable = await waitForServer();
      if (serverAvailable) {
        console.log(`    🔁 Retrying criterion ${criterion.id} (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        return parseCriterionWithRetry(criterion, retryCount + 1);
      }
    }
    
    throw error;
  }
}

async function parseCriterion(criterion) {
  const response = await fetch('http://localhost:3001/api/parser/criterion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      criterion: {
        id: criterion.id,
        nct_id: criterion.nct_id,
        raw_text: criterion.text || criterion.source,
        original: {
          code: criterion.code,
          parsed_category: criterion.parsed_category,
          criterion_type: criterion.criterion_type,
          source: criterion.source
        }
      },
      cluster: 'AIC'  // Active Infection Criteria
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }
  
  return response.json();
}

async function main() {
  console.log('=== AIC Cluster Parser (Active Infection Criteria) ===\n');
  
  // Read input file
  console.log(`Reading: ${INPUT_FILE}`);
  const inputData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const criteria = inputData.members;
  
  console.log(`Found ${criteria.length} criteria to parse\n`);
  
  // Check for existing output to resume from
  let slotFilledDatabase;
  let alreadyParsedIds = new Set();
  
  if (fs.existsSync(OUTPUT_FILE)) {
    const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    
    for (const c of existingData.criteria) {
      if (c.parsing_status === 'complete' || c.parsing_status === 'pending_admin_review') {
        alreadyParsedIds.add(c.id);
        alreadyParsedIds.add(String(c.id));
        
        if (typeof c.id === 'string' && c.id.startsWith('AIC_')) {
          const numericId = c.id.replace('AIC_', '');
          alreadyParsedIds.add(numericId);
          alreadyParsedIds.add(parseInt(numericId, 10));
        }
        if (typeof c.id === 'number') {
          alreadyParsedIds.add(`AIC_${c.id}`);
        }
      }
    }
    
    console.log(`Resuming: Found ${alreadyParsedIds.size} already parsed criteria\n`);
    
    slotFilledDatabase = {
      cluster: 'CLUSTER_AIC',
      cluster_name: 'Active Infection History Criteria',
      generated_at: new Date().toISOString(),
      total_criteria: criteria.length,
      parsing_stats: {
        complete: 0,
        pending_admin_review: 0,
        error: 0
      },
      criteria: existingData.criteria.filter(c => 
        c.parsing_status === 'complete' || c.parsing_status === 'pending_admin_review'
      )
    };
    
    for (const c of slotFilledDatabase.criteria) {
      if (c.parsing_status === 'complete') {
        slotFilledDatabase.parsing_stats.complete++;
      } else if (c.parsing_status === 'pending_admin_review') {
        slotFilledDatabase.parsing_stats.pending_admin_review++;
      }
    }
  } else {
    slotFilledDatabase = {
      cluster: 'CLUSTER_AIC',
      cluster_name: 'Active Infection History Criteria',
      generated_at: new Date().toISOString(),
      total_criteria: criteria.length,
      parsing_stats: {
        complete: 0,
        pending_admin_review: 0,
        error: 0
      },
      criteria: []
    };
  }
  
  // Filter criteria that need parsing
  let toParse = criteria.filter(c => {
    const id = c.id;
    const strId = String(id);
    const aicId = `AIC_${id}`;
    
    return !alreadyParsedIds.has(id) && 
           !alreadyParsedIds.has(strId) && 
           !alreadyParsedIds.has(aicId);
  });
  
  if (toParse.length > MAX_CRITERIA_TO_PARSE) {
    console.log(`Limiting to ${MAX_CRITERIA_TO_PARSE} criteria (of ${toParse.length} remaining)\n`);
    toParse = toParse.slice(0, MAX_CRITERIA_TO_PARSE);
  }
  
  console.log(`Need to parse: ${toParse.length} criteria\n`);
  
  if (toParse.length === 0) {
    console.log('All criteria already parsed!');
    return;
  }
  
  // Process in batches
  let processed = 0;
  let errors = 0;
  
  for (let i = 0; i < toParse.length; i += BATCH_SIZE) {
    const batch = toParse.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toParse.length / BATCH_SIZE);
    
    console.log(`\nBatch ${batchNum}/${totalBatches}`);
    
    const batchPromises = batch.map(async (criterion) => {
      try {
        console.log(`  📝 Parsing: ${criterion.id} - "${criterion.text?.substring(0, 60) || criterion.source?.substring(0, 60)}..."`);
        const parsed = await parseCriterionWithRetry(criterion);
        
        parsed.original = {
          code: criterion.code,
          parsed_category: criterion.parsed_category,
          criterion_type: criterion.criterion_type,
          source: criterion.source
        };
        
        console.log(`  ✅ Success: ${criterion.id} - status: ${parsed.parsing_status}`);
        return { success: true, data: parsed };
      } catch (error) {
        console.error(`  ❌ Error parsing ${criterion.id}: ${error.message}`);
        return {
          success: false,
          data: {
            id: criterion.id,
            nct_id: criterion.nct_id,
            raw_text: criterion.text || criterion.source,
            parsing_status: 'error',
            error: error.message,
            original: {
              code: criterion.code,
              parsed_category: criterion.parsed_category,
              criterion_type: criterion.criterion_type
            }
          }
        };
      }
    });
    
    const results = await Promise.all(batchPromises);
    
    for (const result of results) {
      slotFilledDatabase.criteria.push(result.data);
      processed++;
      
      const status = result.data.parsing_status || 'complete';
      if (status === 'complete') {
        slotFilledDatabase.parsing_stats.complete++;
      } else if (status === 'pending_admin_review') {
        slotFilledDatabase.parsing_stats.pending_admin_review++;
      } else {
        slotFilledDatabase.parsing_stats.error++;
        errors++;
      }
    }
    
    const percent = (((processed + alreadyParsedIds.size) / criteria.length) * 100).toFixed(1);
    console.log(`  ✓ Processed: ${processed + alreadyParsedIds.size}/${criteria.length} (${percent}%)`);
    
    // Delay between batches
    if (i + BATCH_SIZE < toParse.length) {
      console.log(`  ⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s for rate limit...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
    
    // Save progress after EVERY criterion (VS Code terminals kill idle processes)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(slotFilledDatabase, null, 2));
    console.log(`  💾 Progress saved`);
  }
  
  // Write final output
  console.log(`\n\nWriting output to: ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(slotFilledDatabase, null, 2));
  
  // Summary
  console.log('\n=== PARSING COMPLETE ===');
  console.log(`Total criteria: ${criteria.length}`);
  console.log(`Complete: ${slotFilledDatabase.parsing_stats.complete}`);
  console.log(`Pending review: ${slotFilledDatabase.parsing_stats.pending_admin_review}`);
  console.log(`Errors: ${slotFilledDatabase.parsing_stats.error}`);
  console.log(`\n📄 Review file: ${OUTPUT_FILE}`);
}

main().catch(console.error);
