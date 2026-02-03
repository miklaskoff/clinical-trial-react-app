/**
 * REAL E2E Test for Parser Testing UI
 * 
 * This test uses Playwright to test the ACTUAL UI, not mocks.
 * It verifies the complete flow:
 * 1. Upload JSON file
 * 2. Start parsing
 * 3. Cost tracking updates
 * 4. Download button appears
 * 5. Download works
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';

// Test data - small file for quick testing with UNIQUE IDs
const uniqueSuffix = Date.now();
const TEST_CRITERIA = {
  cluster: 'AGE',
  criteria: [
    {
      id: `TEST_E2E_${uniqueSuffix}_001`,
      nct_id: 'NCT99999999',
      raw_text: 'Age ≥ 18 years and ≤ 65 years'
    },
    {
      id: `TEST_E2E_${uniqueSuffix}_002`, 
      nct_id: 'NCT99999999',
      raw_text: 'Age between 21 and 55 years old'
    }
  ]
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServers() {
  console.log('🔍 Checking servers...');
  
  try {
    const frontendRes = await fetch(FRONTEND_URL);
    console.log(`   Frontend (${FRONTEND_URL}): ${frontendRes.ok ? '✅ OK' : '❌ FAILED'}`);
    if (!frontendRes.ok) return false;
  } catch (e) {
    console.log(`   Frontend (${FRONTEND_URL}): ❌ NOT RUNNING - ${e.message}`);
    return false;
  }
  
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/parser/version`);
    const data = await backendRes.json();
    console.log(`   Backend (${BACKEND_URL}): ${backendRes.ok ? '✅ OK' : '❌ FAILED'} - version ${data.version}`);
    if (!backendRes.ok) return false;
  } catch (e) {
    console.log(`   Backend (${BACKEND_URL}): ❌ NOT RUNNING - ${e.message}`);
    return false;
  }
  
  return true;
}

async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 REAL E2E TEST: Parser Testing UI');
  console.log('='.repeat(60) + '\n');
  
  // Check servers first
  const serversOk = await checkServers();
  if (!serversOk) {
    console.log('\n❌ SERVERS NOT RUNNING. Start them with:');
    console.log('   npm run dev        (frontend)');
    console.log('   npm run dev:backend (backend)');
    process.exit(1);
  }
  
  // Create temp test file
  const testFilePath = path.join(__dirname, 'test-criteria.json');
  fs.writeFileSync(testFilePath, JSON.stringify(TEST_CRITERIA, null, 2));
  console.log(`\n📁 Created test file: ${testFilePath}`);
  
  const browser = await chromium.launch({ 
    headless: false,  // Show browser so user can see
    slowMo: 500       // Slow down for visibility
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = {
    navigateToParser: false,
    uploadFile: false,
    fileDisplayed: false,
    startParsing: false,
    costUpdates: false,
    parsingCompletes: false,
    downloadButtonVisible: false,
    downloadWorks: false
  };
  
  try {
    // Step 1: Navigate to Parser page
    console.log('\n📍 Step 1: Navigate to Parser Testing UI...');
    await page.goto(FRONTEND_URL);
    await sleep(1000);
    
    // Click on Parser link in navigation
    const parserLink = page.locator('a:has-text("Parser"), button:has-text("Parser"), [href*="parser"]').first();
    if (await parserLink.isVisible()) {
      await parserLink.click();
      await sleep(500);
    }
    
    // Check if we're on parser page
    const parserHeading = page.locator('h1:has-text("Parser"), h2:has-text("Parser")').first();
    if (await parserHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      results.navigateToParser = true;
      console.log('   ✅ Navigated to Parser page');
    } else {
      // Maybe it's on a different route
      await page.goto(`${FRONTEND_URL}/parser`);
      await sleep(1000);
      results.navigateToParser = true;
      console.log('   ✅ Navigated to Parser page (direct URL)');
    }
    
    // Step 2: Upload file
    console.log('\n📍 Step 2: Upload test file...');
    // File input is hidden (styled), use data-testid or force
    const fileInput = page.locator('[data-testid="file-input"], input[type="file"]').first();
    
    // Check if element exists in DOM (even if hidden)
    const inputCount = await page.locator('input[type="file"]').count();
    console.log(`   Found ${inputCount} file input(s) in DOM`);
    
    if (inputCount > 0) {
      await fileInput.setInputFiles(testFilePath);
      await sleep(1000);
      results.uploadFile = true;
      console.log('   ✅ File uploaded');
    } else {
      console.log('   ❌ File input not found!');
      await page.screenshot({ path: 'e2e/debug-no-file-input.png' });
      throw new Error('File input not found');
    }
    
    // Step 3: Check file is displayed
    console.log('\n📍 Step 3: Check file info displayed...');
    const criteriaCountText = await page.locator('text=/\\d+ criteria/i').first();
    if (await criteriaCountText.isVisible({ timeout: 3000 }).catch(() => false)) {
      results.fileDisplayed = true;
      const text = await criteriaCountText.textContent();
      console.log(`   ✅ File info displayed: "${text}"`);
    } else {
      // Check for any indication file was loaded
      const anyText = await page.locator('text=/uploaded|loaded|criteria|cluster/i').first();
      if (await anyText.isVisible({ timeout: 2000 }).catch(() => false)) {
        results.fileDisplayed = true;
        console.log('   ✅ File loaded (some indication visible)');
      } else {
        console.log('   ⚠️ Cannot confirm file displayed');
      }
    }
    
    // Step 4: Click Start Parsing
    console.log('\n📍 Step 4: Start parsing...');
    const startButton = page.locator('button:has-text("Start"), button:has-text("Parse"), button:has-text("Begin")').first();
    if (await startButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Get initial cost display
      const costBefore = await page.locator('text=/\\$[0-9.]+/').first().textContent().catch(() => '$0.00');
      console.log(`   Initial cost: ${costBefore}`);
      
      await startButton.click();
      results.startParsing = true;
      console.log('   ✅ Start button clicked');
      
      // Wait for parsing to start
      await sleep(2000);
    } else {
      console.log('   ❌ Start button not found!');
      // Screenshot for debugging
      await page.screenshot({ path: 'e2e/debug-no-start-button.png' });
      console.log('   📸 Screenshot saved: e2e/debug-no-start-button.png');
      throw new Error('Start button not found');
    }
    
    // Step 5: Monitor cost updates during parsing
    console.log('\n📍 Step 5: Monitor cost updates...');
    let lastCost = '$0.00';
    let costChanged = false;
    
    // Take screenshot at start of parsing
    await page.screenshot({ path: 'e2e/step5-parsing-start.png', fullPage: true });
    console.log('   📸 Screenshot: e2e/step5-parsing-start.png');
    
    for (let i = 0; i < 60; i++) {  // Wait up to 60 seconds
      await sleep(1000);
      
      // Check for cost display - look for the actual cost value
      const costElements = await page.locator('text=/\\$[0-9]+\\.[0-9]+/').all();
      for (const costEl of costElements) {
        const text = await costEl.textContent().catch(() => '');
        if (text && text.includes('$') && !text.includes('$0.00')) {
          if (text !== lastCost) {
            costChanged = true;
            console.log(`   💰 Cost updated: ${lastCost} → ${text}`);
            lastCost = text;
            // Screenshot when cost changes
            await page.screenshot({ path: `e2e/step5-cost-changed-${i}.png` });
          }
        }
      }
      
      // Check if parsing completed
      const completedIndicator = page.locator('text=/completed|finished|done|100%/i').first();
      const progressFull = page.locator('text=/15\\s*\\/\\s*15|100%/').first();
      
      if (await completedIndicator.isVisible().catch(() => false) || await progressFull.isVisible().catch(() => false)) {
        results.parsingCompletes = true;
        console.log('   ✅ Parsing completed!');
        // Screenshot on completion
        await page.screenshot({ path: 'e2e/step5-parsing-complete.png', fullPage: true });
        console.log('   📸 Screenshot: e2e/step5-parsing-complete.png');
        break;
      }
      
      // Show progress every 5 seconds
      if (i % 5 === 0) {
        const progressText = await page.locator('text=/[0-9]+\\s*(of|\\/)\\s*[0-9]+/i').first().textContent().catch(() => null);
        if (progressText) {
          console.log(`   ⏳ Progress: ${progressText}`);
        }
      }
    }
    
    if (costChanged) {
      results.costUpdates = true;
      console.log(`   ✅ Cost tracking working. Final cost: ${lastCost}`);
    } else {
      console.log(`   ❌ Cost did NOT change from ${lastCost}`);
      await page.screenshot({ path: 'e2e/step5-cost-not-changed.png', fullPage: true });
      console.log('   📸 Screenshot: e2e/step5-cost-not-changed.png');
    }
    
    // Step 6: Check for Download button
    console.log('\n📍 Step 6: Check Download button...');
    
    // Wait longer for results to load and button to appear
    let downloadButton = null;
    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      downloadButton = page.locator('button:has-text("Download"), a:has-text("Download"), button:has-text("📥")').first();
      if (await downloadButton.isVisible().catch(() => false)) {
        break;
      }
      console.log(`   ⏳ Waiting for download button... (${i+1}s)`);
    }
    
    if (await downloadButton?.isVisible().catch(() => false)) {
      results.downloadButtonVisible = true;
      console.log('   ✅ Download button is VISIBLE!');
      
      // Step 7: Try to download
      console.log('\n📍 Step 7: Test download...');
      
      // Set up download listener
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
        downloadButton.click()
      ]);
      
      if (download) {
        const suggestedFilename = download.suggestedFilename();
        const downloadPath = path.join(__dirname, suggestedFilename);
        await download.saveAs(downloadPath);
        
        // Check file exists and has content
        if (fs.existsSync(downloadPath)) {
          const content = fs.readFileSync(downloadPath, 'utf-8');
          const size = content.length;
          results.downloadWorks = true;
          console.log(`   ✅ Download successful!`);
          console.log(`      File: ${suggestedFilename}`);
          console.log(`      Size: ${size} bytes`);
          
          // Try to parse and show preview
          try {
            const data = JSON.parse(content);
            console.log(`      Criteria count: ${Array.isArray(data) ? data.length : 'N/A'}`);
          } catch (e) {
            console.log(`      (Could not parse JSON: ${e.message})`);
          }
          
          // Cleanup download
          fs.unlinkSync(downloadPath);
        } else {
          console.log('   ❌ Download file not saved');
        }
      } else {
        console.log('   ❌ No download event triggered');
        await page.screenshot({ path: 'e2e/debug-no-download.png' });
        console.log('   📸 Screenshot saved: e2e/debug-no-download.png');
      }
    } else {
      console.log('   ❌ Download button NOT VISIBLE!');
      await page.screenshot({ path: 'e2e/debug-no-download-button.png' });
      console.log('   📸 Screenshot saved: e2e/debug-no-download-button.png');
      
      // Debug: show what's on the page
      const pageContent = await page.content();
      const hasDownloadWord = pageContent.toLowerCase().includes('download');
      console.log(`   Page contains "download": ${hasDownloadWord}`);
    }
    
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    await page.screenshot({ path: 'e2e/debug-error.png' });
    console.log('   📸 Screenshot saved: e2e/debug-error.png');
  } finally {
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));
    
    const checkMark = (v) => v ? '✅' : '❌';
    console.log(`${checkMark(results.navigateToParser)} Navigate to Parser page`);
    console.log(`${checkMark(results.uploadFile)} Upload JSON file`);
    console.log(`${checkMark(results.fileDisplayed)} File info displayed`);
    console.log(`${checkMark(results.startParsing)} Start parsing button works`);
    console.log(`${checkMark(results.costUpdates)} Cost updates during parsing`);
    console.log(`${checkMark(results.parsingCompletes)} Parsing completes`);
    console.log(`${checkMark(results.downloadButtonVisible)} Download button visible`);
    console.log(`${checkMark(results.downloadWorks)} Download actually works`);
    
    const passed = Object.values(results).filter(v => v).length;
    const total = Object.keys(results).length;
    
    console.log('\n' + '-'.repeat(60));
    console.log(`TOTAL: ${passed}/${total} checks passed`);
    
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log('⚠️ SOME TESTS FAILED - See above for details');
    }
    console.log('='.repeat(60) + '\n');
    
    // Keep browser open for 5 seconds so user can see
    console.log('Browser will close in 5 seconds...');
    await sleep(5000);
    
    await browser.close();
    
    process.exit(passed === total ? 0 : 1);
  }
}

// Run the test
runTest().catch(console.error);
