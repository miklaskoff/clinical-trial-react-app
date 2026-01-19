import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../components/App';

describe('App Component', () => {
  let fetchSpy;
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Mock fetch for API calls
    fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockImplementation((url) => {
      if (url.includes('/api/config/apikey/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ configured: false })
        });
      }
      if (url.includes('/api/config/apikey')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      });
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('should render the header', async () => {
      render(<App />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Clinical Trial Matching System'
      );
    });

    it('should render settings panel initially', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Configuration');
      });
    });

    it('should have AI matching enabled by default', async () => {
      render(<App />);
      await waitFor(() => {
        const checkbox = screen.getByLabelText(/Enable AI Semantic Matching/i);
        expect(checkbox).toBeChecked();
      });
    });
  });

  describe('API Key Backend Storage', () => {
    it('should check API key status from backend on mount', async () => {
      render(<App />);
      
      await waitFor(() => {
        const statusCall = fetchSpy.mock.calls.find(call => 
          call[0].includes('/api/config/apikey/status')
        );
        expect(statusCall).toBeTruthy();
      });
    });

    it('should show configured message when key exists on server', async () => {
      fetchSpy.mockImplementation((url) => {
        if (url.includes('/api/config/apikey/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ configured: true, updatedAt: '2026-01-19' })
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/stored securely on server/i)).toBeInTheDocument();
      });
    });

    it('should send API key to backend when form submitted', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).toBeInTheDocument();
      });
      
      const apiKeyInput = screen.getByLabelText(/Anthropic API Key/i);
      await user.type(apiKeyInput, 'sk-ant-new-key');
      
      const submitButton = screen.getByRole('button', { name: /Start Questionnaire/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const saveCall = fetchSpy.mock.calls.find(call => {
          const url = call[0];
          return url.includes('/api/config/apikey') && !url.includes('status');
        });
        expect(saveCall).toBeTruthy();
        expect(JSON.parse(saveCall[1].body).apiKey).toBe('sk-ant-new-key');
      });
    });

    it('should NOT store API key in localStorage', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).toBeInTheDocument();
      });
      
      const apiKeyInput = screen.getByLabelText(/Anthropic API Key/i);
      await user.type(apiKeyInput, 'sk-ant-new-key');
      
      // Verify localStorage does NOT contain the key
      expect(localStorage.getItem('anthropic_api_key')).toBeNull();
    });

    it('should clear API key from backend when cleared', async () => {
      // Setup: Key already configured on server
      fetchSpy.mockImplementation((url) => {
        if (url.includes('/api/config/apikey/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ configured: true })
          });
        }
        if (url.includes('/api/config/apikey')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });
      
      const user = userEvent.setup();
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument();
      });
      
      const clearButton = screen.getByRole('button', { name: /Clear/i });
      await user.click(clearButton);
      
      await waitFor(() => {
        const deleteCall = fetchSpy.mock.calls.find(call => {
          return call[0].includes('/api/config/apikey') && 
                 call[1]?.method === 'DELETE';
        });
        expect(deleteCall).toBeTruthy();
      });
    });
  });

  describe('Settings Panel', () => {
    it('should show API key input when AI is enabled', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).toBeInTheDocument();
      });
    });

    it('should hide API key input when AI is disabled', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Enable AI Semantic Matching/i)).toBeInTheDocument();
      });
      
      const checkbox = screen.getByLabelText(/Enable AI Semantic Matching/i);
      await user.click(checkbox);

      expect(screen.queryByLabelText(/Anthropic API Key/i)).not.toBeInTheDocument();
    });

    it('should show error when submitting without API key', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Questionnaire/i })).toBeInTheDocument();
      });
      
      const submitButton = screen.getByRole('button', { name: /Start Questionnaire/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Please enter an API key/i);
      });
    });

    it('should proceed without API key when AI is disabled', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Enable AI Semantic Matching/i)).toBeInTheDocument();
      });
      
      // Disable AI
      const checkbox = screen.getByLabelText(/Enable AI Semantic Matching/i);
      await user.click(checkbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: /Start Questionnaire/i });
      await user.click(submitButton);

      // Should move to questionnaire - check for questionnaire title
      await waitFor(() => {
        expect(screen.getByText(/Clinical Trial Eligibility Questionnaire/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to settings from questionnaire', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Enable AI Semantic Matching/i)).toBeInTheDocument();
      });
      
      // Disable AI to proceed without key
      await user.click(screen.getByLabelText(/Enable AI Semantic Matching/i));
      await user.click(screen.getByRole('button', { name: /Start Questionnaire/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Back to Settings/i })).toBeInTheDocument();
      });
      
      // Go back
      await user.click(screen.getByRole('button', { name: /Back to Settings/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Configuration');
      });
    });
  });

  describe('Error Handling', () => {
    it('should allow dismissing error', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Questionnaire/i })).toBeInTheDocument();
      });
      
      // Trigger error
      await user.click(screen.getByRole('button', { name: /Start Questionnaire/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Dismiss
      await user.click(screen.getByRole('button', { name: /Dismiss error/i }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('should display version info', async () => {
      render(<App />);
      expect(screen.getByText(/v4.0/i)).toBeInTheDocument();
    });
  });
});
