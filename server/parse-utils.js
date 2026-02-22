/**
 * @file parse-utils.js
 * @description Utility functions for cluster parsing with disease-based organization
 * 
 * Features:
 * - Disease folder structure: data/{disease}/CLUSTER_{code}.json
 * - One file per cluster per disease (no duplicates)
 * - Backup before overwrite
 * - CLI argument parsing
 */

import fs from 'fs';
import path from 'path';

/**
 * Get output path for parsed cluster data
 * Returns: data/{disease}/CLUSTER_{cluster}.json
 * 
 * @param {string} disease - Disease name (e.g., 'psoriasis')
 * @param {string} cluster - Cluster code (e.g., 'CMB', 'PTH')
 * @param {string} dataDir - Base data directory
 * @returns {string} Full path to output file
 */
export function getOutputPath(disease, cluster, dataDir) {
  const diseaseDir = path.join(dataDir, disease);
  return path.join(diseaseDir, `CLUSTER_${cluster}.json`);
}

/**
 * Ensure disease directory exists
 * Creates folder if not present: data/{disease}/
 * 
 * @param {string} disease - Disease name
 * @param {string} dataDir - Base data directory
 */
export function ensureDiseaseDir(disease, dataDir) {
  const diseaseDir = path.join(dataDir, disease);
  if (!fs.existsSync(diseaseDir)) {
    fs.mkdirSync(diseaseDir, { recursive: true });
    console.log(`📁 Created disease folder: ${diseaseDir}`);
  }
}

/**
 * Write JSON data to file with backup if file exists
 * 
 * @param {string} filePath - Path to output file
 * @param {Object} data - Data to write
 */
export function writeWithBackup(filePath, data) {
  // Create backup if file exists
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + '.backup';
    fs.copyFileSync(filePath, backupPath);
    console.log(`💾 Backup created: ${backupPath}`);
  }
  
  // Write new file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Written: ${filePath}`);
}

/**
 * Parse CLI arguments for parse-full-cluster.js
 * 
 * Supported options:
 * --disease=<name>   Disease folder (default: 'psoriasis')
 * --cluster=<code>   Cluster code (default: 'CMB')
 * --errors-only      Re-parse only failed criteria
 * --dry-run          Show what would be done without doing it
 * 
 * @param {string[]} argv - Process argv array
 * @returns {Object} Parsed options
 */
export function parseCliArgs(argv) {
  const args = argv.slice(2); // Skip node and script name
  
  const options = {
    disease: 'psoriasis',  // Default disease
    cluster: 'CMB',        // Default cluster
    errorsOnly: false,
    dryRun: false
  };
  
  for (const arg of args) {
    if (arg.startsWith('--disease=')) {
      options.disease = arg.split('=')[1];
    } else if (arg.startsWith('--cluster=')) {
      options.cluster = arg.split('=')[1];
    } else if (arg === '--errors-only') {
      options.errorsOnly = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }
  
  return options;
}

/**
 * Initialize output database structure
 * 
 * @param {string} cluster - Cluster code
 * @param {string} clusterName - Human-readable cluster name
 * @param {number} totalCriteria - Total criteria count
 * @returns {Object} Initial database structure
 */
export function initDatabase(cluster, clusterName, totalCriteria) {
  return {
    cluster: `CLUSTER_${cluster}`,
    cluster_name: clusterName,
    generated_at: new Date().toISOString(),
    total_criteria: totalCriteria,
    parsing_stats: {
      complete: 0,
      pending_admin_review: 0,
      error: 0
    },
    criteria: []
  };
}

/**
 * Load existing parsed data if available
 * 
 * @param {string} outputPath - Path to output file
 * @returns {Object|null} Existing data or null
 */
export function loadExistingData(outputPath) {
  if (fs.existsSync(outputPath)) {
    try {
      return JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } catch (error) {
      console.warn(`⚠️ Failed to load existing data: ${error.message}`);
      return null;
    }
  }
  return null;
}

// Cluster name mapping
const CLUSTER_NAMES = {
  CMB: 'Comorbid Conditions and Risk Factors',
  PTH: 'Prior Treatment History',
  SEV: 'Severity Measurements',
  AGE: 'Age Requirements',
  BMI: 'BMI Requirements',
  LAB: 'Laboratory Values',
  ANA: 'Anatomical Locations',
  DIT: 'Disease Type',
  BIO: 'Biomarker Criteria',
  DD: 'Disease Duration',
  AIC: 'Autoimmune Conditions',
  AAO: 'Affected Anatomical Organs'
};

/**
 * Get human-readable name for cluster code
 * 
 * @param {string} cluster - Cluster code
 * @returns {string} Cluster name
 */
export function getClusterName(cluster) {
  return CLUSTER_NAMES[cluster] || `Unknown Cluster (${cluster})`;
}
