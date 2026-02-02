/**
 * @file Anthropic Prompt Caching Tests
 * TDD: Tests written BEFORE implementation
 * 
 * Feature: System prompt caching to reduce API costs
 * Expected savings: ~70% on input tokens for batch parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeClient } from '../../services/ClaudeClient.js';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: '{"test": true}' }],
          usage: {
            input_tokens: 1000,
            output_tokens: 100,
            cache_creation_input_tokens: 500,
            cache_read_input_tokens: 0
          }
        })
      }
    }))
  };
});

// Mock database
vi.mock('../../db.js', () => ({
  getDatabase: vi.fn().mockReturnValue({
    getAsync: vi.fn().mockResolvedValue({ value: 'sk-ant-test-key-12345' })
  })
}));

describe('Anthropic Prompt Caching', () => {
  let client;
  let mockCreate;

  beforeEach(async () => {
    // Reset modules to get fresh instance
    vi.resetModules();
    
    // Create client with mocked API key
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    mockCreate = vi.fn().mockResolvedValue({
      content: [{ text: '{"parsed": true}' }],
      usage: {
        input_tokens: 1000,
        output_tokens: 100,
        cache_creation_input_tokens: 18000,
        cache_read_input_tokens: 0
      }
    });
    
    Anthropic.mockImplementation(() => ({
      messages: { create: mockCreate }
    }));

    // Set env var for client initialization
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345';
    
    const { ClaudeClient: FreshClient } = await import('../../services/ClaudeClient.js');
    client = new FreshClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('should send system prompt with cache_control directive', async () => {
    const systemPrompt = 'This is a long system prompt with FIELD_CATALOG content...';
    const userPrompt = 'Parse this criterion';

    await client.complete({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4096
    });

    // Verify create was called
    expect(mockCreate).toHaveBeenCalledTimes(1);
    
    const callArgs = mockCreate.mock.calls[0][0];
    
    // CRITICAL: System should be array with cache_control
    expect(callArgs.system).toEqual([
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ]);
  });

  it('should include model and max_tokens in API call', async () => {
    await client.complete({
      system: 'system prompt',
      prompt: 'user prompt',
      maxTokens: 2048
    });

    const callArgs = mockCreate.mock.calls[0][0];
    
    expect(callArgs.model).toBeDefined();
    expect(callArgs.max_tokens).toBe(2048);
    expect(callArgs.messages).toEqual([
      { role: 'user', content: 'user prompt' }
    ]);
  });

  it('should return response text from API', async () => {
    const result = await client.complete({
      system: 'system',
      prompt: 'prompt'
    });

    expect(result).toBe('{"parsed": true}');
  });

  it('should handle cache hit in subsequent calls', async () => {
    // First call - cache creation
    mockCreate.mockResolvedValueOnce({
      content: [{ text: '{"first": true}' }],
      usage: {
        input_tokens: 1000,
        cache_creation_input_tokens: 18000,  // Cache created
        cache_read_input_tokens: 0
      }
    });

    // Second call - cache hit
    mockCreate.mockResolvedValueOnce({
      content: [{ text: '{"second": true}' }],
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 18000  // Cache hit!
      }
    });

    const consoleSpy = vi.spyOn(console, 'log');

    // First call
    await client.complete({ system: 'long system prompt', prompt: 'first' });
    
    // Second call with same system prompt
    await client.complete({ system: 'long system prompt', prompt: 'second' });

    // Both calls should use cache_control
    expect(mockCreate).toHaveBeenCalledTimes(2);
    
    // Both should have cache_control in system
    mockCreate.mock.calls.forEach(call => {
      expect(call[0].system[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    consoleSpy.mockRestore();
  });

  it('should throw error if client not configured', async () => {
    // Create client without API key
    delete process.env.ANTHROPIC_API_KEY;
    
    const { ClaudeClient: UnconfiguredClient } = await import('../../services/ClaudeClient.js');
    const unconfiguredClient = new UnconfiguredClient();
    
    // Force client to be null
    unconfiguredClient['#client'] = null;

    await expect(
      unconfiguredClient.complete({ system: 'sys', prompt: 'user' })
    ).rejects.toThrow();
  });
});
