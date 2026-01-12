import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../components/App';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial Render', () => {
    it('should render the header', () => {
      render(<App />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Clinical Trial Matching System'
      );
    });

    it('should render settings panel initially', () => {
      render(<App />);
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Configuration');
    });

    it('should have AI matching enabled by default', () => {
      render(<App />);
      const checkbox = screen.getByLabelText(/Enable AI Semantic Matching/i);
      expect(checkbox).toBeChecked();
    });
  });

  describe('API Key Persistence', () => {
    it('should load saved API key from localStorage', () => {
      localStorage.setItem('anthropic_api_key', 'sk-ant-test-key');
      render(<App />);
      
      const apiKeyInput = screen.getByLabelText(/Anthropic API Key/i);
      expect(apiKeyInput).toHaveValue('sk-ant-test-key');
    });

    it('should save API key to localStorage when changed', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const apiKeyInput = screen.getByLabelText(/Anthropic API Key/i);
      await user.type(apiKeyInput, 'sk-ant-new-key');
      
      expect(localStorage.getItem('anthropic_api_key')).toBe('sk-ant-new-key');
    });

    it('should clear API key from localStorage when cleared', async () => {
      const user = userEvent.setup();
      localStorage.setItem('anthropic_api_key', 'sk-ant-test-key');
      render(<App />);
      
      const clearButton = screen.getByRole('button', { name: /Clear/i });
      await user.click(clearButton);
      
      expect(localStorage.getItem('anthropic_api_key')).toBeNull();
    });

    it('should show hint when API key is saved', () => {
      localStorage.setItem('anthropic_api_key', 'sk-ant-test-key');
      render(<App />);
      
      expect(screen.getByText(/API key saved locally/i)).toBeInTheDocument();
    });
  });

  describe('Settings Panel', () => {
    it('should show API key input when AI is enabled', () => {
      render(<App />);
      expect(screen.getByLabelText(/Anthropic API Key/i)).toBeInTheDocument();
    });

    it('should hide API key input when AI is disabled', async () => {
      const user = userEvent.setup();
      render(<App />);

      const checkbox = screen.getByLabelText(/Enable AI Semantic Matching/i);
      await user.click(checkbox);

      expect(screen.queryByLabelText(/Anthropic API Key/i)).not.toBeInTheDocument();
    });

    it('should show error when submitting without API key', async () => {
      const user = userEvent.setup();
      render(<App />);

      const submitButton = screen.getByRole('button', { name: /Start Questionnaire/i });
      await user.click(submitButton);

      expect(screen.getByRole('alert')).toHaveTextContent(/Please enter an API key/i);
    });

    it('should proceed without API key when AI is disabled', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Disable AI
      const checkbox = screen.getByLabelText(/Enable AI Semantic Matching/i);
      await user.click(checkbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: /Start Questionnaire/i });
      await user.click(submitButton);

      // Should move to questionnaire - check for questionnaire title
      expect(screen.getByText(/Clinical Trial Eligibility Questionnaire/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to settings from questionnaire', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Disable AI to proceed without key
      await user.click(screen.getByLabelText(/Enable AI Semantic Matching/i));
      await user.click(screen.getByRole('button', { name: /Start Questionnaire/i }));

      // Go back
      await user.click(screen.getByRole('button', { name: /Back to Settings/i }));

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Configuration');
    });
  });

  describe('Error Handling', () => {
    it('should allow dismissing error', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Trigger error
      await user.click(screen.getByRole('button', { name: /Start Questionnaire/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Dismiss
      await user.click(screen.getByRole('button', { name: /Dismiss error/i }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('should display version info', () => {
      render(<App />);
      expect(screen.getByText(/v4.0/i)).toBeInTheDocument();
    });
  });
});
