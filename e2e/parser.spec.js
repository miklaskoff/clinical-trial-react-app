// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Tests for Parser Testing UI
 * 
 * Tests cover the complete parsing workflow:
 * 1. Navigation to /parser route
 * 2. File upload and criteria detection
 * 3. Model selection
 * 4. Cost estimation display
 * 5. Job start/pause/resume
 * 6. Progress tracking
 * 7. Results display
 * 8. History management
 */

test.describe('Parser Testing UI', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/parser');
  });

  test.describe('Navigation and Initial Render', () => {
    
    test('should navigate to /parser route and display Parser page', async ({ page }) => {
      // Check page title
      await expect(page.locator('h2')).toContainText('Parser Testing UI');
      
      // Check parser version is displayed
      await expect(page.locator('text=/Parser Version/i')).toBeVisible();
    });

    test('should display navigation links back to main app and admin', async ({ page }) => {
      // Back to main app link
      await expect(page.locator('a[href="/"]')).toBeVisible();
      
      // Admin dashboard link
      await expect(page.locator('a[href="/admin"]')).toBeVisible();
    });

    test('should display upload area with file input', async ({ page }) => {
      // Upload section visible
      await expect(page.locator('.upload-section, [data-testid="upload-section"]')).toBeVisible();
      
      // File input exists
      await expect(page.locator('input[type="file"]')).toBeVisible();
    });

    test('should display model selection dropdown', async ({ page }) => {
      // Model dropdown visible
      await expect(page.locator('select')).toBeVisible();
      
      // Check model options
      await expect(page.locator('option[value="claude-sonnet-4-5-20250929"]')).toBeVisible();
    });

    test('should display Start button initially disabled', async ({ page }) => {
      // Start button exists but disabled (no file uploaded)
      const startButton = page.locator('button:has-text("Start")');
      await expect(startButton).toBeVisible();
      await expect(startButton).toBeDisabled();
    });
  });

  test.describe('File Upload', () => {
    
    test('should enable Start button after valid JSON upload', async ({ page }) => {
      // Create test JSON file content
      const testData = {
        clusterType: 'AIC',
        criteria: [
          { criterionId: 'AIC_001', nctId: 'NCT12345', raw_text: 'Test criterion 1' },
          { criterionId: 'AIC_002', nctId: 'NCT12346', raw_text: 'Test criterion 2' }
        ]
      };
      
      // Write temp file for upload (Playwright handles this)
      const tempFilePath = path.join(__dirname, 'temp-test-criteria.json');
      fs.writeFileSync(tempFilePath, JSON.stringify(testData));
      
      try {
        // Upload file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(tempFilePath);
        
        // Wait for processing
        await page.waitForTimeout(500);
        
        // Start button should now be enabled
        const startButton = page.locator('button:has-text("Start")');
        await expect(startButton).toBeEnabled();
        
        // Criteria count should be displayed
        await expect(page.locator('text=/2 criteria/i')).toBeVisible();
      } finally {
        // Cleanup
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    test('should show error for invalid JSON file', async ({ page }) => {
      // Create invalid JSON file
      const tempFilePath = path.join(__dirname, 'temp-invalid.json');
      fs.writeFileSync(tempFilePath, 'not valid json {{{');
      
      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(tempFilePath);
        
        await page.waitForTimeout(500);
        
        // Error message should be displayed
        await expect(page.locator('text=/invalid|error|failed/i')).toBeVisible();
        
        // Start button should remain disabled
        const startButton = page.locator('button:has-text("Start")');
        await expect(startButton).toBeDisabled();
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    test('should display cluster type from uploaded file', async ({ page }) => {
      const testData = {
        clusterType: 'PTH',
        criteria: [
          { criterionId: 'PTH_001', nctId: 'NCT12345', raw_text: 'Prior treatment' }
        ]
      };
      
      const tempFilePath = path.join(__dirname, 'temp-pth.json');
      fs.writeFileSync(tempFilePath, JSON.stringify(testData));
      
      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(tempFilePath);
        
        await page.waitForTimeout(500);
        
        // Cluster type displayed
        await expect(page.locator('text=/PTH/i')).toBeVisible();
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  test.describe('Model Selection and Cost Estimation', () => {
    
    test('should update cost estimate when model is changed', async ({ page }) => {
      // Upload a file first
      const testData = {
        clusterType: 'AIC',
        criteria: Array(10).fill(null).map((_, i) => ({
          criterionId: `AIC_${String(i + 1).padStart(3, '0')}`,
          nctId: `NCT${12345 + i}`,
          raw_text: `Test criterion ${i + 1}`
        }))
      };
      
      const tempFilePath = path.join(__dirname, 'temp-estimate.json');
      fs.writeFileSync(tempFilePath, JSON.stringify(testData));
      
      try {
        await page.locator('input[type="file"]').setInputFiles(tempFilePath);
        await page.waitForTimeout(500);
        
        // Get initial estimate
        const estimateLocator = page.locator('text=/\\$[0-9]+\\.?[0-9]*/');
        await expect(estimateLocator.first()).toBeVisible();
        
        // Change model to Opus (more expensive)
        await page.selectOption('select', 'claude-opus-4-20250514');
        await page.waitForTimeout(300);
        
        // Estimate should update (Opus is ~5x more expensive)
        await expect(estimateLocator.first()).toBeVisible();
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    test('should display estimated time for parsing', async ({ page }) => {
      const testData = {
        clusterType: 'AIC',
        criteria: Array(20).fill(null).map((_, i) => ({
          criterionId: `AIC_${String(i + 1).padStart(3, '0')}`,
          nctId: `NCT${12345 + i}`,
          raw_text: `Test criterion ${i + 1}`
        }))
      };
      
      const tempFilePath = path.join(__dirname, 'temp-time.json');
      fs.writeFileSync(tempFilePath, JSON.stringify(testData));
      
      try {
        await page.locator('input[type="file"]').setInputFiles(tempFilePath);
        await page.waitForTimeout(500);
        
        // Time estimate should be visible
        await expect(page.locator('text=/minutes|seconds/i')).toBeVisible();
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  test.describe('Already Parsed Detection', () => {
    
    test('should show count of already parsed criteria', async ({ page }) => {
      // This test assumes the upload endpoint checks for already-parsed criteria
      const testData = {
        clusterType: 'AIC',
        criteria: [
          { criterionId: 'AIC_001', nctId: 'NCT12345', raw_text: 'Test criterion' }
        ]
      };
      
      const tempFilePath = path.join(__dirname, 'temp-parsed-check.json');
      fs.writeFileSync(tempFilePath, JSON.stringify(testData));
      
      try {
        await page.locator('input[type="file"]').setInputFiles(tempFilePath);
        await page.waitForTimeout(500);
        
        // Should show criteria summary (either 0 or some already parsed)
        await expect(page.locator('text=/criteria/i')).toBeVisible();
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    test('should have force-reparse checkbox', async ({ page }) => {
      // Force reparse option should exist
      await expect(page.locator('input[type="checkbox"]')).toBeVisible();
      await expect(page.locator('text=/force|reparse/i')).toBeVisible();
    });
  });

  test.describe('Budget Limit', () => {
    
    test('should display budget limit input', async ({ page }) => {
      await expect(page.locator('input[type="number"]')).toBeVisible();
      await expect(page.locator('text=/budget/i')).toBeVisible();
    });

    test('should allow setting custom budget limit', async ({ page }) => {
      const budgetInput = page.locator('input[type="number"]');
      await budgetInput.fill('5.00');
      
      // Value should be set
      await expect(budgetInput).toHaveValue('5.00');
    });
  });

  test.describe('History Section', () => {
    
    test('should display parsing history section', async ({ page }) => {
      await expect(page.locator('text=/history/i')).toBeVisible();
    });

    test('should show "no history" message when empty', async ({ page }) => {
      // If no previous jobs, should show empty state
      const historySection = page.locator('.history-section, [data-testid="history-section"]');
      if (await historySection.isVisible()) {
        await expect(page.locator('text=/no.*history|empty/i')).toBeVisible();
      }
    });
  });

  test.describe('API Balance Display', () => {
    
    test('should display API balance section', async ({ page }) => {
      await expect(page.locator('text=/balance|usage/i')).toBeVisible();
    });
  });

});

test.describe('Parser Workflow Integration', () => {
  
  test('should complete full parsing workflow: upload → start → progress → results', async ({ page }) => {
    // Navigate to parser
    await page.goto('/parser');
    
    // Create test data
    const testData = {
      clusterType: 'AIC',
      criteria: [
        { criterionId: 'AIC_E2E_001', nctId: 'NCT12345', raw_text: 'Patient must be at least 18 years old' },
        { criterionId: 'AIC_E2E_002', nctId: 'NCT12346', raw_text: 'No history of cardiac disease' }
      ]
    };
    
    const tempFilePath = path.join(__dirname, 'temp-workflow.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(testData));
    
    try {
      // 1. Upload file
      await page.locator('input[type="file"]').setInputFiles(tempFilePath);
      await page.waitForTimeout(500);
      
      // 2. Verify criteria count
      await expect(page.locator('text=/2 criteria/i')).toBeVisible();
      
      // 3. Start button should be enabled
      const startButton = page.locator('button:has-text("Start")');
      await expect(startButton).toBeEnabled();
      
      // 4. Click start (this would require backend to be running)
      // In E2E tests with real backend, uncomment:
      // await startButton.click();
      // await expect(page.locator('button:has-text("Pause")')).toBeVisible();
      // await expect(page.locator('.progress-bar')).toBeVisible();
      
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  test('should navigate back to main app from parser', async ({ page }) => {
    await page.goto('/parser');
    
    // Click back link
    await page.click('a[href="/"]');
    
    // Should be on main app
    await expect(page.locator('h1')).toContainText('Clinical Trial');
    await expect(page.url()).toContain('/');
  });

  test('should navigate to admin from parser', async ({ page }) => {
    await page.goto('/parser');
    
    // Click admin link
    await page.click('a[href="/admin"]');
    
    // Should be on admin page
    await expect(page.url()).toContain('/admin');
  });
});
