/**
 * Full Cluster Parser - Parses all criteria from input JSON
 * Outputs complete slot-filled database structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INPUT_FILE = path.join(__dirname, 'data', 'test-cmb-criteria.json');
const OUTPUT_FILE = path.join(__dirname, 'data', 'slot-filled-cmb-output.json');
const CLEAN_OUTPUT_FILE = path.join(__dirname, 'data', 'slot-filled-cmb-output-clean.json');
const BATCH_SIZE = 1;  // One at a time to stay within rate limits
const DELAY_BETWEEN_BATCHES = 65000;  // 65 seconds - Claude API limit is 30,000 tokens/minute
const MAX_RETRIES = 3;  // Retry on rate limit errors
const INITIAL_RETRY_DELAY = 120000;  // 2 minutes for first retry
const SERVER_RETRY_DELAY = 10000;  // 10 seconds for server connection issues
const MAX_CRITERIA_TO_PARSE = 30;  // Parse 30 criteria for review

// Check command line args for special modes
const REPARSE_ERRORS_ONLY = process.argv.includes('--errors-only');

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
    
    // Handle rate limiting
    if (is429 && retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`    ⏳ Rate limited. Waiting ${delay / 1000}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await sleep(delay);
      return parseCriterionWithRetry(criterion, retryCount + 1);
    }
    
    // Handle server connection issues (fetch failed)
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
        // Pass original data so validator can infer CRITERION_TYPE and EXCLUSION_STRENGTH
        original: {
          code: criterion.code,
          parsed_category: criterion.parsed_category,
          criterion_type: criterion.criterion_type,
          source: criterion.source
        }
      },
      cluster: 'CMB'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }
  
  return response.json();
}

async function main() {
  console.log('=== Full Cluster Parser ===\n');
  
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
    
    // Find successfully parsed criteria (not error)
    for (const c of existingData.criteria) {
      if (c.parsing_status === 'complete' || c.parsing_status === 'pending_admin_review') {
        // Add both formats to handle ID inconsistencies
        alreadyParsedIds.add(c.id);  // "CMB_2473" or 2473
        alreadyParsedIds.add(String(c.id));  // Ensure string comparison
        
        // Extract numeric part from "CMB_2473" format
        if (typeof c.id === 'string' && c.id.startsWith('CMB_')) {
          const numericId = c.id.replace('CMB_', '');
          alreadyParsedIds.add(numericId);  // "2473"
          alreadyParsedIds.add(parseInt(numericId, 10));  // 2473
        }
        // Add CMB_ prefix if numeric
        if (typeof c.id === 'number') {
          alreadyParsedIds.add(`CMB_${c.id}`);  // "CMB_2473"
        }
      }
    }
    
    console.log(`Resuming: Found ${alreadyParsedIds.size} already parsed criteria\n`);
    
    // Keep successfully parsed, remove errors for re-parsing
    slotFilledDatabase = {
      cluster: 'CLUSTER_CMB',
      cluster_name: 'Comorbid Conditions and Risk Factors',
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
    
    // Update stats
    for (const c of slotFilledDatabase.criteria) {
      if (c.parsing_status === 'complete') {
        slotFilledDatabase.parsing_stats.complete++;
      } else if (c.parsing_status === 'pending_admin_review') {
        slotFilledDatabase.parsing_stats.pending_admin_review++;
      }
    }
  } else {
    // Fresh start
    slotFilledDatabase = {
      cluster: 'CLUSTER_CMB',
      cluster_name: 'Comorbid Conditions and Risk Factors',
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
  
  // Determine what to parse based on mode
  let toParse;
  
  if (REPARSE_ERRORS_ONLY) {
    // --errors-only mode: Only re-parse criteria that had errors
    console.log('🔄 ERRORS-ONLY MODE: Re-parsing failed criteria\n');
    
    // Get error IDs from existing output (extract numeric part)
    const errorIds = new Set();
    if (fs.existsSync(OUTPUT_FILE)) {
      const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      for (const c of existingData.criteria) {
        if (c.parsing_status === 'error') {
          // Handle both numeric and CMB_ prefixed IDs
          const numId = typeof c.id === 'number' ? c.id : 
                        (typeof c.id === 'string' && c.id.startsWith('CMB_')) ? 
                        parseInt(c.id.replace('CMB_', ''), 10) : parseInt(c.id, 10);
          errorIds.add(numId);
        }
      }
    }
    
    console.log(`Found ${errorIds.size} error criteria to re-parse\n`);
    
    // Filter input to only error IDs
    toParse = criteria.filter(c => errorIds.has(c.id) || errorIds.has(parseInt(c.id, 10)));
    
  } else {
    // Normal mode: Parse criteria not already successfully parsed
    // Filter criteria that need parsing (check all ID formats)
    toParse = criteria.filter(c => {
      const id = c.id;
      const strId = String(id);
      const cmbId = `CMB_${id}`;
      
      // Skip if any format is already parsed
      return !alreadyParsedIds.has(id) && 
             !alreadyParsedIds.has(strId) && 
             !alreadyParsedIds.has(cmbId);
    });
    
    // Limit to MAX_CRITERIA_TO_PARSE (user requested 30)
    if (toParse.length > MAX_CRITERIA_TO_PARSE) {
      console.log(`Limiting to ${MAX_CRITERIA_TO_PARSE} criteria (of ${toParse.length} remaining)\n`);
      toParse = toParse.slice(0, MAX_CRITERIA_TO_PARSE);
    }
  }
  
  console.log(`Need to parse: ${toParse.length} criteria\n`);
  
  if (toParse.length === 0) {
    console.log('All criteria already parsed!');
  }
  
  // Process in batches
  let processed = 0;
  let errors = 0;
  
  for (let i = 0; i < toParse.length; i += BATCH_SIZE) {
    const batch = toParse.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toParse.length / BATCH_SIZE);
    
    console.log(`\nBatch ${batchNum}/${totalBatches} (criteria ${i + 1}-${Math.min(i + BATCH_SIZE, criteria.length)})`);
    
    // Process batch with retry logic
    const batchPromises = batch.map(async (criterion) => {
      try {
        console.log(`  📝 Parsing: ${criterion.id} - "${criterion.text?.substring(0, 50) || criterion.source?.substring(0, 50)}..."`);
        const parsed = await parseCriterionWithRetry(criterion);
        
        // Add original metadata
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
    
    // Add results to database
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
    
    // Progress update
    const percent = (((processed + alreadyParsedIds.size) / criteria.length) * 100).toFixed(1);
    console.log(`  ✓ Processed: ${processed + alreadyParsedIds.size}/${criteria.length} (${percent}%)`);
    
    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < toParse.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
    
    // Save progress periodically
    if (processed % 10 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(slotFilledDatabase, null, 2));
    }
  }
  
  // Write output
  console.log(`\n\nWriting output to: ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(slotFilledDatabase, null, 2));
  
  // Write clean output (without 'original' field for production use)
  const cleanDatabase = {
    ...slotFilledDatabase,
    criteria: slotFilledDatabase.criteria.map(c => {
      const { original, ...clean } = c;
      return clean;
    })
  };
  console.log(`Writing clean output to: ${CLEAN_OUTPUT_FILE}`);
  fs.writeFileSync(CLEAN_OUTPUT_FILE, JSON.stringify(cleanDatabase, null, 2));
  
  // Summary
  console.log('\n=== PARSING COMPLETE ===');
  console.log(`Total criteria: ${criteria.length}`);
  console.log(`Complete: ${slotFilledDatabase.parsing_stats.complete}`);
  console.log(`Pending review: ${slotFilledDatabase.parsing_stats.pending_admin_review}`);
  console.log(`Errors: ${slotFilledDatabase.parsing_stats.error}`);
  console.log(`\nOutput saved to: ${OUTPUT_FILE}`);
  console.log(`Clean output saved to: ${CLEAN_OUTPUT_FILE}`);
}

main().catch(console.error);
