import Database from 'better-sqlite3';
const db = new Database('./data/clinical-trials.db');

console.log('\n=== PARSER DIAGNOSTICS ===\n');

// 1. Parsed criteria
const parsed = db.prepare('SELECT criterionId, parserVersion, clusterType FROM parsed_criteria').all();
console.log('Parsed criteria in DB:', parsed.length);
parsed.forEach(p => console.log(`  - ${p.criterionId} (v${p.parserVersion}, ${p.clusterType})`));

// 2. Last 3 jobs
console.log('\nLast 3 parser jobs:');
const jobs = db.prepare(`
  SELECT id, status, clusterType, totalCriteria, parsedCount, skippedCount, actualCost, inputFile 
  FROM parser_jobs 
  ORDER BY createdAt DESC 
  LIMIT 3
`).all();
jobs.forEach(j => {
  console.log(`  Job ${j.id.substring(0, 8)}:`);
  console.log(`    Status: ${j.status}, Cluster: ${j.clusterType || 'EMPTY'}`);
  console.log(`    Total: ${j.totalCriteria}, Parsed: ${j.parsedCount}, Skipped: ${j.skippedCount}`);
  console.log(`    Cost: $${j.actualCost || 0}`);
  console.log(`    File: ${j.inputFile}`);
});

// 3. API config
console.log('\nAPI Configuration:');
const apiKey = db.prepare("SELECT value FROM config WHERE key = 'anthropic_api_key'").get();
console.log('  API Key configured:', apiKey ? (apiKey.value.startsWith('sk-ant-') ? 'YES (sk-ant-...)' : 'INVALID') : 'NO');

// 4. API usage
const usage = db.prepare('SELECT COALESCE(SUM(costUsd), 0) as total FROM api_usage').get();
console.log('  Total API spent: $' + (usage.total || 0).toFixed(2));

db.close();
console.log('\n=== END DIAGNOSTICS ===\n');
