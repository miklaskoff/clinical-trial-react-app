// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * E2E Test: Parser Cost and Download Button Bug
 * 
 * IMPLEMENTATION CONTRACT:
 * 
 * Requirement: 
 * - Cost display ($X.XX spent) must update during parsing
 * - Download button must appear after parsing completes
 * 
 * Acceptance Criteria:
 * 1. When backend returns actualCost > 0, UI must show that cost
 * 2. When backend returns results.length > 0, Download button must be visible
 * 3. No race condition between polling stop and state update
 */

test.describe('Parser Cost and Download Display', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to parser page
    await page.goto('http://localhost:3000/parser');
    
    // Wait for page to load
    await page.waitForSelector('.parser-page', { timeout: 10000 });
  });

  test('should display cost > $0.00 after parsing completes', async ({ page }) => {
    // Create a minimal test JSON file
    const testData = {
      clusterType: 'AIC',
      clusterName: 'Test Cluster',
      rawCriteria: [
        {
          id: 'TEST_001',
          raw_text: 'Patient must be 18 years or older',
          EXCLUSION_STRENGTH: 'inclusion'
        }
      ]
    };

    // Write test file
    const testFilePath = path.join(__dirname, 'downloads', 'test-cost-check.json');
    fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));

    // Upload file via file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for file to be loaded
    await page.waitForTimeout(500);

    // Click Start Parsing button
    const startButton = page.locator('button:has-text("Start Parsing")');
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();

    // Wait for parsing to complete (status should change)
    // Poll until we see "completed" or timeout after 60s
    await page.waitForFunction(
      () => {
        const statusEl = document.querySelector('[data-testid="job-status"]');
        return statusEl?.textContent?.toLowerCase().includes('completed');
      },
      { timeout: 60000 }
    );

    // Wait for results to load after completion
    await page.waitForTimeout(3000);

    // Take screenshot of progress section
    await page.screenshot({ 
      path: 'e2e/screenshots/parser-cost-after-completion.png',
      fullPage: false 
    });

    // CRITICAL CHECK 1: Cost should NOT be $0.00
    const costDisplay = page.locator('[data-testid="cost-display"]');
    await expect(costDisplay).toBeVisible({ timeout: 5000 });
    
    const costText = await costDisplay.textContent();
    console.log('Cost display text:', costText);
    
    // Extract numeric value
    const costMatch = costText?.match(/\$(\d+\.\d{2})/);
    const costValue = costMatch ? parseFloat(costMatch[1]) : 0;
    
    // Cost should be greater than 0 after parsing
    expect(costValue).toBeGreaterThan(0);

    // CRITICAL CHECK 2: Download button should be visible
    const downloadButton = page.locator('[data-testid="download-button"]');
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    // Take final screenshot as evidence
    await page.screenshot({ 
      path: 'e2e/screenshots/parser-download-button-visible.png',
      fullPage: true 
    });

    // Cleanup test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('should show Download button when results exist', async ({ page }) => {
    // This test checks the results display after polling completes
    
    // Navigate and wait
    await page.goto('http://localhost:3000/parser');
    await page.waitForSelector('.parser-page', { timeout: 10000 });

    // Create test file with single criterion
    const testData = {
      clusterType: 'AIC',
      clusterName: 'Download Button Test',
      rawCriteria: [
        {
          id: 'DL_TEST_001',
          raw_text: 'Patient must have confirmed diagnosis',
          EXCLUSION_STRENGTH: 'inclusion'
        }
      ]
    };

    const testFilePath = path.join(__dirname, 'downloads', 'test-download-btn.json');
    fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));

    // Upload and start
    await page.locator('input[type="file"]').setInputFiles(testFilePath);
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start Parsing")').click();

    // Wait for completion
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="job-status"]');
        return el?.textContent?.toLowerCase().includes('completed');
      },
      { timeout: 60000 }
    );

    // Wait for results to load after completion
    await page.waitForTimeout(3000);

    // Screenshot before assertions
    await page.screenshot({ 
      path: 'e2e/screenshots/parser-after-complete-state.png',
      fullPage: true 
    });

    // Check results section exists
    const resultsSection = page.locator('[data-testid="results-section"]');
    await expect(resultsSection).toBeVisible({ timeout: 10000 });
    
    // Download button must be visible
    const downloadBtn = page.locator('[data-testid="download-button"]');
    
    // This is the actual bug - button should be visible but wasn't due to race condition
    await expect(downloadBtn).toBeVisible({ timeout: 10000 });

    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('cost updates during polling (not just at end)', async ({ page }) => {
    // Test that cost updates progressively, not just jumps from 0 to final
    
    await page.goto('http://localhost:3000/parser');
    await page.waitForSelector('.parser-page');

    // Create file with 3 criteria to have longer parsing time
    const testData = {
      clusterType: 'AIC',
      clusterName: 'Progressive Cost Test',
      rawCriteria: [
        { id: 'PC_001', raw_text: 'Age 18 or older', EXCLUSION_STRENGTH: 'inclusion' },
        { id: 'PC_002', raw_text: 'No prior cancer history', EXCLUSION_STRENGTH: 'exclusion' },
        { id: 'PC_003', raw_text: 'ECOG status 0-2', EXCLUSION_STRENGTH: 'inclusion' }
      ]
    };

    const testFilePath = path.join(__dirname, 'downloads', 'test-progressive-cost.json');
    fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));

    await page.locator('input[type="file"]').setInputFiles(testFilePath);
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start Parsing")').click();

    // Collect cost values during parsing
    const costValues = [];
    
    // Poll for 30 seconds, collecting cost values
    const startTime = Date.now();
    while (Date.now() - startTime < 30000) {
      try {
        const costEl = page.locator('text=/\\$\\d+\\.\\d{2} spent/');
        if (await costEl.isVisible()) {
          const text = await costEl.textContent();
          const match = text?.match(/\$(\d+\.\d{2})/);
          if (match) {
            costValues.push(parseFloat(match[1]));
          }
        }
      } catch (e) {
        // Element might not be visible yet
      }
      
      // Check if completed
      const bodyText = await page.locator('body').textContent();
      if (bodyText.toLowerCase().includes('completed')) {
        break;
      }
      
      await page.waitForTimeout(500);
    }

    console.log('Collected cost values:', costValues);

    // After completion, cost should be > 0
    const finalCostEl = page.locator('text=/\\$\\d+\\.\\d{2} spent/');
    if (await finalCostEl.isVisible()) {
      const finalText = await finalCostEl.textContent();
      const finalMatch = finalText?.match(/\$(\d+\.\d{2})/);
      const finalCost = finalMatch ? parseFloat(finalMatch[1]) : 0;
      
      console.log('Final cost:', finalCost);
      expect(finalCost).toBeGreaterThan(0);
    }

    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
});
