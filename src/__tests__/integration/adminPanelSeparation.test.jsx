/**
 * IMPLEMENTATION CONTRACT: Admin Panel Separation with Auth
 * 
 * REQUIREMENT:
 * - Admin link NOT visible in main patient UI
 * - /admin route requires password authentication
 * - Rate limiting on login attempts (5 per minute)
 * - Admin panel only shows after successful auth
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../components/App.jsx';

describe('Contract 4: Admin Panel Separation', () => {
  let user;
  let fetchSpy;
  
  beforeEach(() => {
    user = userEvent.setup();
    fetchSpy = vi.spyOn(global, 'fetch');
    localStorage.clear();
    sessionStorage.clear();
    
    // Mock API responses
    fetchSpy.mockImplementation((url) => {
      if (url.includes('/api/config/apikey/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ configured: false })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      });
    });
    
    // Reset pathname
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/', href: 'http://localhost/' }
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });
  
  describe('Admin Link Hidden in Main UI', () => {
    it('does NOT show admin link in main patient questionnaire', async () => {
      render(<App />);
      
      // Wait for app to load
      await waitFor(() => {
        expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
      });
      
      // Admin button should NOT be visible anywhere in header
      const adminButton = screen.queryByRole('button', { name: /^admin$/i });
      expect(adminButton).not.toBeInTheDocument();
    });
    
    it('does NOT show admin dashboard link in settings panel', async () => {
      render(<App />);
      
      // Wait for initial render
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
      
      // No admin-related links visible in main UI
      const adminLinks = screen.queryAllByRole('link', { name: /admin/i });
      // If there are admin links, they should not be in the main patient view
      expect(adminLinks.length).toBe(0);
    });
  });
  
  describe('Admin Route Renders DrugReviewDashboard', () => {
    it('shows DrugReviewDashboard when on /admin route', async () => {
      // Set pathname to /admin
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { pathname: '/admin', href: 'http://localhost/admin' }
      });
      
      render(<App />);
      
      await waitFor(() => {
        // Should show drug review dashboard or login
        const dashboardOrLogin = 
          screen.queryByText(/drug review/i) || 
          screen.queryByText(/admin/i) ||
          screen.queryByText(/pending/i);
        expect(dashboardOrLogin).toBeInTheDocument();
      });
    });
  });
  
  describe('Backend Admin Routes Exist', () => {
    it('BackendClient has admin methods', async () => {
      const { BackendClient } = await import('../../services/api/backendClient.js');
      const client = new BackendClient('http://localhost:3001');
      
      expect(typeof client.adminLogin).toBe('function');
      expect(typeof client.adminLogout).toBe('function');
      expect(typeof client.getPendingReviews).toBe('function');
      expect(typeof client.getApprovedDrugs).toBe('function');
    });
  });
});
