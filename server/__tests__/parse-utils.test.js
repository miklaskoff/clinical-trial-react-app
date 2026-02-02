/**
 * @file Disease-Based File Organization Tests
 * TDD: Tests written BEFORE implementation
 * 
 * Feature: Output files organized by disease folder
 * - server/data/{disease}/CLUSTER_{code}.json
 * - One file per cluster per disease (no duplicates)
 * - Overwrite with backup instead of creating new files
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DISEASE = 'test_disease_unit';
const DATA_DIR = path.join(__dirname, '..', 'data');
const TEST_DIR = path.join(DATA_DIR, TEST_DISEASE);

// Import functions that will be added to parse-full-cluster.js
// For now, we'll test the utility functions we'll create

describe('Disease-Based File Organization', () => {
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('getOutputPath utility', () => {
    // We'll import this after creating it
    let getOutputPath;
    
    beforeEach(async () => {
      try {
        const module = await import('../parse-utils.js');
        getOutputPath = module.getOutputPath;
      } catch {
        // Will fail until we implement
        getOutputPath = null;
      }
    });

    it('should return path inside disease folder', () => {
      if (!getOutputPath) {
        throw new Error('getOutputPath not implemented yet');
      }
      
      const result = getOutputPath('psoriasis', 'CMB', DATA_DIR);
      expect(result).toBe(path.join(DATA_DIR, 'psoriasis', 'CLUSTER_CMB.json'));
    });

    it('should handle different cluster codes', () => {
      if (!getOutputPath) {
        throw new Error('getOutputPath not implemented yet');
      }
      
      expect(getOutputPath('psoriasis', 'PTH', DATA_DIR))
        .toBe(path.join(DATA_DIR, 'psoriasis', 'CLUSTER_PTH.json'));
      expect(getOutputPath('psoriasis', 'SEV', DATA_DIR))
        .toBe(path.join(DATA_DIR, 'psoriasis', 'CLUSTER_SEV.json'));
    });
  });

  describe('ensureDiseaseDir utility', () => {
    let ensureDiseaseDir;
    
    beforeEach(async () => {
      try {
        const module = await import('../parse-utils.js');
        ensureDiseaseDir = module.ensureDiseaseDir;
      } catch {
        ensureDiseaseDir = null;
      }
    });

    it('should create disease folder if not exists', () => {
      if (!ensureDiseaseDir) {
        throw new Error('ensureDiseaseDir not implemented yet');
      }
      
      expect(fs.existsSync(TEST_DIR)).toBe(false);
      ensureDiseaseDir(TEST_DISEASE, DATA_DIR);
      expect(fs.existsSync(TEST_DIR)).toBe(true);
    });

    it('should not throw if folder already exists', () => {
      if (!ensureDiseaseDir) {
        throw new Error('ensureDiseaseDir not implemented yet');
      }
      
      fs.mkdirSync(TEST_DIR, { recursive: true });
      expect(() => ensureDiseaseDir(TEST_DISEASE, DATA_DIR)).not.toThrow();
    });
  });

  describe('writeWithBackup utility', () => {
    let writeWithBackup;
    
    beforeEach(async () => {
      try {
        const module = await import('../parse-utils.js');
        writeWithBackup = module.writeWithBackup;
      } catch {
        writeWithBackup = null;
      }
    });

    it('should write file to specified path', () => {
      if (!writeWithBackup) {
        throw new Error('writeWithBackup not implemented yet');
      }
      
      fs.mkdirSync(TEST_DIR, { recursive: true });
      const filePath = path.join(TEST_DIR, 'CLUSTER_CMB.json');
      const data = { test: true, criteria: [] };
      
      writeWithBackup(filePath, data);
      
      expect(fs.existsSync(filePath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(filePath, 'utf-8'))).toEqual(data);
    });

    it('should create backup before overwriting existing file', () => {
      if (!writeWithBackup) {
        throw new Error('writeWithBackup not implemented yet');
      }
      
      fs.mkdirSync(TEST_DIR, { recursive: true });
      const filePath = path.join(TEST_DIR, 'CLUSTER_CMB.json');
      const backupPath = filePath + '.backup';
      
      // Create existing file
      const oldData = { old: true, version: 1 };
      fs.writeFileSync(filePath, JSON.stringify(oldData));
      
      // Overwrite with new data
      const newData = { new: true, version: 2 };
      writeWithBackup(filePath, newData);
      
      // Verify backup created
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(backupPath, 'utf-8'))).toEqual(oldData);
      
      // Verify new file written
      expect(JSON.parse(fs.readFileSync(filePath, 'utf-8'))).toEqual(newData);
    });

    it('should not create backup if file does not exist', () => {
      if (!writeWithBackup) {
        throw new Error('writeWithBackup not implemented yet');
      }
      
      fs.mkdirSync(TEST_DIR, { recursive: true });
      const filePath = path.join(TEST_DIR, 'CLUSTER_NEW.json');
      const backupPath = filePath + '.backup';
      
      writeWithBackup(filePath, { test: true });
      
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.existsSync(backupPath)).toBe(false);
    });
  });

  describe('parseCliArgs utility', () => {
    let parseCliArgs;
    
    beforeEach(async () => {
      try {
        const module = await import('../parse-utils.js');
        parseCliArgs = module.parseCliArgs;
      } catch {
        parseCliArgs = null;
      }
    });

    it('should parse --disease option', () => {
      if (!parseCliArgs) {
        throw new Error('parseCliArgs not implemented yet');
      }
      
      const result = parseCliArgs(['node', 'script.js', '--disease=psoriasis']);
      expect(result.disease).toBe('psoriasis');
    });

    it('should default to psoriasis if no --disease', () => {
      if (!parseCliArgs) {
        throw new Error('parseCliArgs not implemented yet');
      }
      
      const result = parseCliArgs(['node', 'script.js']);
      expect(result.disease).toBe('psoriasis');
    });

    it('should parse --cluster option', () => {
      if (!parseCliArgs) {
        throw new Error('parseCliArgs not implemented yet');
      }
      
      const result = parseCliArgs(['node', 'script.js', '--cluster=CMB']);
      expect(result.cluster).toBe('CMB');
    });

    it('should parse --errors-only flag', () => {
      if (!parseCliArgs) {
        throw new Error('parseCliArgs not implemented yet');
      }
      
      const result = parseCliArgs(['node', 'script.js', '--errors-only']);
      expect(result.errorsOnly).toBe(true);
    });

    it('should parse multiple options together', () => {
      if (!parseCliArgs) {
        throw new Error('parseCliArgs not implemented yet');
      }
      
      const result = parseCliArgs([
        'node', 'script.js', 
        '--disease=rheumatoid_arthritis', 
        '--cluster=PTH',
        '--errors-only'
      ]);
      
      expect(result.disease).toBe('rheumatoid_arthritis');
      expect(result.cluster).toBe('PTH');
      expect(result.errorsOnly).toBe(true);
    });
  });
});
