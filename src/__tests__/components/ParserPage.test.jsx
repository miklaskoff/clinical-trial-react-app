/**
 * Parser Testing UI - Frontend Component Tests (TDD)
 * 
 * Tests written FIRST as per TDD requirements.
 * These tests should FAIL initially until the component is implemented.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParserPage from '../../components/Parser/ParserPage';

describe('Parser Testing UI', () => {
  let fetchSpy;
  const mockJobId = 'test-job-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for all API calls
    fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockImplementation((url, options) => {
      // GET /api/parser/version
      if (url.includes('/api/parser/version') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            parserVersion: '2.2.0',
            fieldCatalogVersion: '2.2'
          })
        });
      }
      
      // POST /api/parser/upload
      if (url.includes('/api/parser/upload') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            jobId: mockJobId,
            clusterType: 'CLUSTER_PTH',
            criteriaCount: 30,
            alreadyParsed: 10,
            needsParsing: 20,
            criteria: Array(30).fill().map((_, i) => ({
              criterion_id: `PTH_${String(i + 1).padStart(3, '0')}`,
              raw_text: `Test criterion ${i + 1}`,
              nct_id: `NCT0000000${i + 1}`
            }))
          })
        });
      }
      
      // POST /api/parser/estimate
      if (url.includes('/api/parser/estimate') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            criteriaCount: 20,
            estimatedCost: { min: 0.15, max: 0.25 },
            estimatedTime: { min: 60, max: 100 },
            model: 'claude-sonnet-4-20250514'
          })
        });
      }
      
      // POST /api/parser/job/start
      if (url.includes('/api/parser/job/start') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            jobId: mockJobId,
            status: 'running',
            totalCriteria: 20,
            message: 'Parser job started'
          })
        });
      }
      
      // POST /api/parser/job/pause
      if (url.includes('/api/parser/job/pause') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            status: 'paused'
          })
        });
      }
      
      // POST /api/parser/job/resume
      if (url.includes('/api/parser/job/resume') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            status: 'running'
          })
        });
      }
      
      // GET /api/parser/job/:jobId/status
      if (url.includes('/api/parser/job/') && url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'running',
            total: 20,
            fullTotal: 30,
            parsed: 5,
            skipped: 0,
            clusterType: 'CLUSTER_PTH',
            currentCriterion: 'PTH_005',
            actualCost: 0.05
          })
        });
      }
      
      // GET /api/parser/job/:jobId/results
      if (url.includes('/api/parser/job/') && url.includes('/results')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            results: [
              { criterionId: 'PTH_001', nctId: 'NCT00000001', status: 'success', parsedAt: new Date().toISOString() },
              { criterionId: 'PTH_002', nctId: 'NCT00000002', status: 'success', parsedAt: new Date().toISOString() }
            ]
          })
        });
      }
      
      // GET /api/parser/history
      if (url.includes('/api/parser/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            jobs: [
              { id: 'job-1', status: 'completed', totalCriteria: 30, parsedCount: 30, createdAt: new Date().toISOString() },
              { id: 'job-2', status: 'completed', totalCriteria: 20, parsedCount: 20, createdAt: new Date().toISOString() }
            ]
          })
        });
      }
      
      // GET /api/parser/balance
      if (url.includes('/api/parser/balance')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            usedAmount: 1.25,
            budgetLimit: 100,
            remaining: 98.75
          })
        });
      }
      
      // Default
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('T01: should display page title "Parser Testing UI"', async () => {
      render(<ParserPage />);
      expect(screen.getByText(/Parser Testing UI/i)).toBeInTheDocument();
    });

    it('T02: should display current parser version', async () => {
      render(<ParserPage />);
      await waitFor(() => {
        expect(screen.getByText(/2\.2\.0/)).toBeInTheDocument();
      });
    });

    it('T03: should display file upload area', () => {
      render(<ParserPage />);
      expect(screen.getByText(/Upload JSON/i)).toBeInTheDocument();
    });

    it('T04: should display model selector', () => {
      render(<ParserPage />);
      expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('T05: should accept JSON file upload', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(
        [JSON.stringify({ criteria: [] })],
        'test-criteria.json',
        { type: 'application/json' }
      );
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText(/test-criteria\.json/i)).toBeInTheDocument();
      });
    });

    it('T06: should display criteria count after upload', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(
        [JSON.stringify({ criteria: Array(30).fill({ raw_text: 'test' }) })],
        'test.json',
        { type: 'application/json' }
      );
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        // Text is split: <strong>30</strong> criteria total
        expect(screen.getByText(/criteria total/i)).toBeInTheDocument();
        // Check the number separately
        const summary = screen.getByText(/criteria total/i).closest('p');
        expect(summary).toHaveTextContent('30');
      });
    });

    it('T07: should show already-parsed count', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(
        [JSON.stringify({ criteria: [] })],
        'test.json',
        { type: 'application/json' }
      );
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        // Text is split: <strong>10</strong> already parsed
        expect(screen.getByText(/already parsed/i)).toBeInTheDocument();
        const summary = screen.getByText(/already parsed/i).closest('p');
        expect(summary).toHaveTextContent('10');
      });
    });
  });

  describe('Model Selection', () => {
    it('T08: should have three model options', () => {
      render(<ParserPage />);
      
      const modelSelect = screen.getByLabelText(/Model/i);
      expect(modelSelect).toBeInTheDocument();
      
      // Check options exist
      expect(screen.getByRole('option', { name: /Opus/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Sonnet/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Haiku/i })).toBeInTheDocument();
    });

    it('T09: should default to Sonnet model', () => {
      render(<ParserPage />);
      
      const modelSelect = screen.getByLabelText(/Model/i);
      expect(modelSelect.value).toContain('sonnet');
    });
  });

  describe('Cost Estimation', () => {
    it('T10: should display cost estimate after upload', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(
        [JSON.stringify({ criteria: [] })],
        'test.json',
        { type: 'application/json' }
      );
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText(/\$0\.15.*\$0\.25/)).toBeInTheDocument();
      });
    });

    it('T11: should display time estimate', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(
        [JSON.stringify({ criteria: [] })],
        'test.json',
        { type: 'application/json' }
      );
      
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByText(/60.*100.*seconds/i)).toBeInTheDocument();
      });
    });

    it('T12: should update estimate when model changes', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload file first
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      // Change model
      const modelSelect = screen.getByLabelText(/Model/i);
      await user.selectOptions(modelSelect, 'claude-opus-4-20250514');
      
      // Verify estimate API was called with new model
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/parser/estimate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('opus')
          })
        );
      });
    });
  });

  describe('Parsing Job Control', () => {
    it('T13: should have Start Parsing button', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload file first
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
    });

    it('T14: should show Pause button after starting', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload file
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      // Start parsing
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
      });
    });

    it('T15: should show Resume button after pausing', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload and start
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
      });
      
      // Pause
      await user.click(screen.getByRole('button', { name: /Pause/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument();
      });
    });
  });

  describe('Progress Display', () => {
    it('T16: should display progress bar during parsing', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload and start
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('T17: should show parsed/total count', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload and start
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/5.*\/.*20/)).toBeInTheDocument();
      });
    });

    it('T18: should show current cost', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload and start
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/\$0\.05/)).toBeInTheDocument();
      });
    });
  });

  describe('Results Display', () => {
    it('T19: should display results table', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload and start
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('T20: should show criterion ID in results', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload and start
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/PTH_001/)).toBeInTheDocument();
      });
    });

    it('T21: should show NCT ID in results', async () => {
      const user = userEvent.setup();
      render(<ParserPage />);
      
      // Upload and start
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File([JSON.stringify({ criteria: [] })], 'test.json', { type: 'application/json' });
      await user.upload(fileInput, testFile);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Parsing/i })).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Start Parsing/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/NCT00000001/)).toBeInTheDocument();
      });
    });
  });

  describe('Skip Already Parsed', () => {
    it('T22: should have "Force Re-parse" checkbox', async () => {
      render(<ParserPage />);
      expect(screen.getByRole('checkbox', { name: /Force.*Re-?parse/i })).toBeInTheDocument();
    });

    it('T23: should be unchecked by default (skip already parsed)', () => {
      render(<ParserPage />);
      const checkbox = screen.getByRole('checkbox', { name: /Force.*Re-?parse/i });
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('History Section', () => {
    it('T24: should display parsing history', async () => {
      render(<ParserPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/History/i)).toBeInTheDocument();
      });
    });

    it('T25: should show previous jobs', async () => {
      render(<ParserPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/job-1/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Balance', () => {
    it('T26: should display API usage balance', async () => {
      render(<ParserPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/Total Spent/i)).toBeInTheDocument();
        expect(screen.getByText(/\$1\.25/)).toBeInTheDocument();
      });
    });
  });

  describe('Budget Limit', () => {
    it('T27: should have budget limit input', () => {
      render(<ParserPage />);
      expect(screen.getByLabelText(/Budget Limit/i)).toBeInTheDocument();
    });

    it('T28: should default to no limit', () => {
      render(<ParserPage />);
      const budgetInput = screen.getByLabelText(/Budget Limit/i);
      expect(budgetInput.value).toBe('');
    });
  });
});
