import React, { useState, useEffect, useCallback } from 'react';

/**
 * Backend API URL
 */
const BACKEND_URL = 'http://localhost:3001';

/**
 * Admin Settings component for API key configuration
 * 
 * Allows admins to:
 * - Check if API key is configured
 * - Enter and save new API key
 * - See status with timestamp
 */
function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState({ configured: false, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  /**
   * Check API key status on mount
   */
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/config/apikey/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error checking API key status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  /**
   * Save API key to backend
   */
  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    // Basic validation
    if (!apiKey.startsWith('sk-ant-')) {
      setMessage({ type: 'error', text: 'Invalid API key format. Key should start with "sk-ant-"' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/config/apikey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'API key saved successfully!' });
        setApiKey(''); // Clear input for security
        await checkStatus(); // Refresh status
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save API key' });
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      setMessage({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Remove API key from backend
   */
  const handleRemove = async () => {
    if (!window.confirm('Are you sure you want to remove the API key?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/config/apikey`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'API key removed' });
        await checkStatus();
      } else {
        setMessage({ type: 'error', text: 'Failed to remove API key' });
      }
    } catch (error) {
      console.error('Error removing API key:', error);
      setMessage({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="api-key-settings" data-testid="api-key-settings">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="api-key-settings" data-testid="api-key-settings">
      <h2>API Configuration</h2>
      
      {/* Status Indicator */}
      <div className="status-section">
        <h3>Anthropic API Key Status</h3>
        <div className={`status-indicator ${status.configured ? 'configured' : 'not-configured'}`}>
          {status.configured ? (
            <>
              <span className="status-icon">✅</span>
              <span className="status-text">Configured</span>
              {status.updatedAt && (
                <span className="status-date">
                  Last updated: {new Date(status.updatedAt).toLocaleString()}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="status-icon">❌</span>
              <span className="status-text">Not Configured</span>
              <p className="status-warning">
                AI features are disabled. Enter your Anthropic API key below.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`alert alert-${message.type}`} role="alert">
          {message.text}
        </div>
      )}

      {/* API Key Input Form */}
      <div className="input-section">
        <label htmlFor="anthropic-api-key">Anthropic API Key</label>
        <input
          id="anthropic-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          disabled={saving}
          autoComplete="off"
        />
        <p className="input-hint">
          Get your API key from{' '}
          <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
            console.anthropic.com
          </a>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="actions-section">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
        >
          {saving ? 'Saving...' : 'Save API Key'}
        </button>
        
        {status.configured && (
          <button
            className="btn-danger"
            onClick={handleRemove}
            disabled={saving}
          >
            Remove API Key
          </button>
        )}
      </div>
    </div>
  );
}

export default ApiKeySettings;
