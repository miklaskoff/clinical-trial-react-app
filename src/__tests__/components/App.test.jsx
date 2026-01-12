import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../components/App';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      // Should move to questionnaire
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Patient Questionnaire');
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
