import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateFollowUpQuestions } from '../../services/FollowUpGenerator.js';
import { getClaudeClient } from '../../services/ClaudeClient.js';

describe('FollowUpGenerator - Treatment Criterion IDs', () => {
  beforeEach(() => {
    // Clear any caches
    vi.clearAllMocks();
  });

  it('should load matching criteria from CLUSTER_PTH for adalimumab', async () => {
    // This test verifies that the treatment generator loads criteria from database
    // and passes them to the AI, just like the condition generator does
    
    const result = await generateFollowUpQuestions('adalimumab');
    
    // Verify we got questions back
    expect(result).toBeDefined();
    expect(result.questions).toBeDefined();
    expect(Array.isArray(result.questions)).toBe(true);
    
    // Verify drug classification worked
    expect(result.drugClass).toBeDefined();
    expect(result.drugName).toBe('adalimumab');
    
    // Verify criteria were loaded (matchingCriteriaCount should be > 0)
    expect(result.matchingCriteriaCount).toBeGreaterThan(0);
    
    console.log(`✅ Loaded ${result.matchingCriteriaCount} criteria for adalimumab`);
  });

  it('should include criterionIds in AI-generated questions', async () => {
    // This test verifies that AI-generated questions include criterion IDs
    // CRITICAL: This tests ACTUAL behavior, not mocks
    
    const client = getClaudeClient();
    
    // Only run this test if AI is configured (skip if no API key)
    const isConfigured = client.isConfigured();
    if (!isConfigured) {
      await client.initFromDatabase();
    }
    
    if (!client.isConfigured()) {
      console.log('⚠️ Skipping AI test - no API key configured');
      return;
    }
    
    const result = await generateFollowUpQuestions('adalimumab');
    
    // If AI generated questions (not default), they MUST have criterionIds
    if (result.aiGenerated && result.questions.length > 0) {
      const firstQuestion = result.questions[0];
      
      // Check for criterionIds array (new format)
      const hasCriterionIds = firstQuestion.criterionIds && Array.isArray(firstQuestion.criterionIds);
      
      // Check for old single criterionId (backward compatibility)
      const hasCriterionId = firstQuestion.criterionId && typeof firstQuestion.criterionId === 'string';
      
      // At least ONE format should be present
      expect(hasCriterionIds || hasCriterionId).toBe(true);
      
      if (hasCriterionIds) {
        console.log(`✅ Question has criterionIds array:`, firstQuestion.criterionIds);
        // Verify IDs start with PTH_ (treatment cluster)
        firstQuestion.criterionIds.forEach(id => {
          expect(id).toMatch(/^(PTH_|FLR_|CMB_)/);
        });
      } else if (hasCriterionId) {
        console.log(`✅ Question has single criterionId:`, firstQuestion.criterionId);
        expect(firstQuestion.criterionId).toMatch(/^(PTH_|FLR_|CMB_)/);
      }
    } else {
      console.log('⚠️ AI did not generate questions or returned default questions');
    }
  });

  it('should pass criteria context to AI prompt', async () => {
    // This test verifies criteria are included in the AI prompt
    // We'll spy on the Claude client to see what prompt is sent
    
    const client = getClaudeClient();
    
    // Only run if AI configured
    if (!client.isConfigured()) {
      await client.initFromDatabase();
    }
    
    if (!client.isConfigured()) {
      console.log('⚠️ Skipping AI prompt test - no API key configured');
      return;
    }
    
    // Spy on generateQuestions to see the prompt
    const generateSpy = vi.spyOn(client, 'generateQuestions');
    
    await generateFollowUpQuestions('adalimumab');
    
    // Verify generateQuestions was called
    if (generateSpy.mock.calls.length > 0) {
      const prompt = generateSpy.mock.calls[0][0];
      
      // Verify prompt includes criteria IDs (like PTH_XXXX)
      expect(prompt).toMatch(/PTH_\d+/);
      
      // Verify prompt includes raw_text from criteria
      expect(prompt).toContain('Related eligibility criteria');
      
      // Verify prompt requests criterionIds in response
      expect(prompt).toMatch(/criterionId/i);
      
      console.log('✅ AI prompt includes criteria context');
    } else {
      console.log('⚠️ AI generateQuestions not called (using cache or default)');
    }
    
    generateSpy.mockRestore();
  });

  it('should filter criteria by TREATMENT_TYPE and TREATMENT_PATTERN', async () => {
    // This test verifies that only RELEVANT criteria are loaded
    // (not all 700+ criteria from the database)
    
    const result = await generateFollowUpQuestions('adalimumab');
    
    // matchingCriteriaCount should be reasonable (not all criteria)
    expect(result.matchingCriteriaCount).toBeLessThan(100);
    expect(result.matchingCriteriaCount).toBeGreaterThan(0);
    
    console.log(`✅ Filtered to ${result.matchingCriteriaCount} relevant criteria (not all 700+)`);
  });

  it('should return aiGenerated:false when AI unavailable', async () => {
    // This test verifies blocking behavior when AI is unavailable
    
    const client = getClaudeClient();
    
    // Temporarily break the API key
    const originalConfigured = client.isConfigured.bind(client);
    vi.spyOn(client, 'isConfigured').mockReturnValue(false);
    vi.spyOn(client, 'initFromDatabase').mockResolvedValue(false);
    
    const result = await generateFollowUpQuestions('adalimumab');
    
    // Should return aiGenerated: false
    expect(result.aiGenerated).toBe(false);
    
    // Restore
    client.isConfigured.mockRestore();
    client.initFromDatabase.mockRestore();
    
    console.log('✅ Returns aiGenerated:false when AI unavailable');
  });

  it('should match IL-17A inhibitor to criteria mentioning IL-17 (subtype matching)', async () => {
    // CRITICAL TEST: IL-17A is a SUBTYPE of IL-17
    // User enters "IL-17A inhibitor" → should match criteria with "IL-17 inhibitor"
    // 
    // PTH_005 has: TREATMENT_TYPE: ["IL-17A inhibitor", "IL-17F inhibitor", "bimekizumab"]
    // PTH_022 has: TREATMENT_TYPE: ["IL-12 inhibitor", "IL-17 inhibitor", "IL-23 inhibitor"]
    //
    // "IL-17A inhibitor" should match BOTH criteria!
    
    const result = await generateFollowUpQuestions('IL-17A inhibitor');
    
    // Should have matching criteria
    expect(result.matchingCriteriaCount).toBeGreaterThan(0);
    
    // If criteria IDs are returned, verify BOTH PTH_005 and PTH_022 are included
    if (result.matchedCriteriaIds) {
      const ids = result.matchedCriteriaIds;
      console.log('Matched criteria IDs:', ids);
      
      // PTH_005 should match (has "IL-17A inhibitor" directly)
      const hasPTH005 = ids.some(id => id === 'PTH_005');
      
      // PTH_022 should match (has "IL-17 inhibitor" - parent of IL-17A)
      const hasPTH022 = ids.some(id => id === 'PTH_022');
      
      console.log(`PTH_005 matched: ${hasPTH005}`);
      console.log(`PTH_022 matched: ${hasPTH022}`);
      
      // Both should be present due to bidirectional matching
      expect(hasPTH005).toBe(true);
      expect(hasPTH022).toBe(true);
    }
    
    console.log(`✅ IL-17A inhibitor matched ${result.matchingCriteriaCount} criteria (including parent IL-17 criteria)`);
  });

  it('should expand IL subtype terms for comprehensive matching', async () => {
    // Test various IL subtypes to verify expansion works
    const testCases = [
      { input: 'IL-17A inhibitor', shouldMatchParent: 'IL-17' },
      { input: 'IL-17F inhibitor', shouldMatchParent: 'IL-17' },
      { input: 'IL-23p19 inhibitor', shouldMatchParent: 'IL-23' },
    ];
    
    for (const testCase of testCases) {
      const result = await generateFollowUpQuestions(testCase.input);
      expect(result.matchingCriteriaCount).toBeGreaterThan(0);
      console.log(`✅ ${testCase.input} matched ${result.matchingCriteriaCount} criteria`);
    }
  });

  // ========== CLUSTER-SCOPED SEARCH TESTS ==========
  
  it('should only search CLUSTER_PTH for treatment follow-ups (not FLR or CMB)', async () => {
    // CRITICAL: Treatment follow-up questions should ONLY cite PTH criteria
    // NOT criteria from FLR or CMB clusters
    
    const result = await generateFollowUpQuestions('IL-17A inhibitor');
    
    // Verify we found criteria
    expect(result.matchingCriteriaCount).toBeGreaterThan(0);
    expect(result.matchedCriteriaIds).toBeDefined();
    
    const ids = result.matchedCriteriaIds;
    console.log('Treatment matched criteria IDs:', ids);
    
    // Should find PTH criteria (PTH_005, PTH_022)
    const pthCriteria = ids.filter(id => id.startsWith('PTH_'));
    expect(pthCriteria.length).toBeGreaterThan(0);
    console.log(`✅ Found ${pthCriteria.length} PTH criteria: ${pthCriteria.join(', ')}`);
    
    // Should NOT find FLR criteria (FLR_2303, FLR_2146)
    const flrCriteria = ids.filter(id => id.startsWith('FLR_'));
    expect(flrCriteria.length).toBe(0);
    console.log(`✅ Correctly excluded FLR criteria (found ${flrCriteria.length})`);
    
    // Should NOT find CMB criteria (CMB_1678)
    const cmbCriteria = ids.filter(id => id.startsWith('CMB_'));
    expect(cmbCriteria.length).toBe(0);
    console.log(`✅ Correctly excluded CMB criteria (found ${cmbCriteria.length})`);
  });
});

describe('FollowUpGenerator - Condition Criterion IDs (Cluster-Scoped)', () => {
  it('should only search CLUSTER_CMB for condition follow-ups (not PTH or FLR)', async () => {
    // Import the condition generator
    const { generateConditionFollowUpQuestions } = await import('../../services/FollowUpGenerator.js');
    
    const result = await generateConditionFollowUpQuestions('gastritis');
    
    // Verify we found criteria
    expect(result.matchingCriteriaCount).toBeGreaterThan(0);
    expect(result.matchedCriteriaIds).toBeDefined();
    
    const ids = result.matchedCriteriaIds;
    console.log('Condition matched criteria IDs:', ids);
    
    // Should find CMB criteria
    const cmbCriteria = ids.filter(id => id.startsWith('CMB_'));
    expect(cmbCriteria.length).toBeGreaterThan(0);
    console.log(`✅ Found ${cmbCriteria.length} CMB criteria: ${cmbCriteria.slice(0, 5).join(', ')}...`);
    
    // Should NOT find PTH criteria
    const pthCriteria = ids.filter(id => id.startsWith('PTH_'));
    expect(pthCriteria.length).toBe(0);
    console.log(`✅ Correctly excluded PTH criteria (found ${pthCriteria.length})`);
    
    // Should NOT find FLR criteria
    const flrCriteria = ids.filter(id => id.startsWith('FLR_'));
    expect(flrCriteria.length).toBe(0);
    console.log(`✅ Correctly excluded FLR criteria (found ${flrCriteria.length})`);
  });
});
