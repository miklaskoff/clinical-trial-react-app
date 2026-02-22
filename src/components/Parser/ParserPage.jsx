/**
 * Parser Testing UI - Main Page Component
 * 
 * Features:
 * - Upload JSON file with criteria
 * - Select AI model (Opus/Sonnet/Haiku)
 * - Cost and time estimation
 * - Start/Pause/Resume parsing
 * - Progress tracking
 * - Results display
 * - Skip already-parsed criteria
 * - Budget limit enforcement
 * - History of past jobs
 * - API balance display
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import './ParserPage.css';

// API base URL
const API_BASE = 'http://localhost:3001/api/parser';

// Available models
const MODELS = [
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable, highest cost' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance (default)' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5', description: 'Fastest, lowest cost' }
];

export default function ParserPage() {
  // State: Parser version
  const [parserVersion, setParserVersion] = useState('');
  
  // State: File upload
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  
  // State: Model selection
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  
  // State: Cost estimation
  const [estimate, setEstimate] = useState(null);
  
  // State: Job control
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // 'running' | 'paused' | 'completed' | 'failed'
  const [progress, setProgress] = useState({ parsed: 0, total: 0, percentage: 0, skipped: 0 });
  const [currentCost, setCurrentCost] = useState(0);
  const [parseErrors, setParseErrors] = useState([]);  // Errors from parsing
  
  // State: Results
  const [results, setResults] = useState([]);
  
  // State: Options
  const [forceReparse, setForceReparse] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [parseLimit, setParseLimit] = useState('');
  
  // State: History
  const [history, setHistory] = useState([]);
  
  // State: API Balance
  const [balance, setBalance] = useState({ totalSpent: 0 });
  
  // State: Loading/Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  
  // Polling interval ref
  const pollIntervalRef = useRef(null);

  // API: Fetch job status (defined early for useEffect dependency)
  const fetchJobStatus = useCallback(async () => {
    if (!jobId) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/job/${jobId}/status`);
      const data = await response.json();
      
      console.info('[ParserPage] fetchJobStatus response:', data); // Debug log
      
      if (response.ok && !data.error) {
        setJobStatus(data.status);
        const total = data.total || 0;
        const parsed = data.parsed || 0;
        const skipped = data.skipped || 0;
        const percentage = total > 0 ? Math.round((parsed / total) * 100) : 0;
        setProgress({ parsed, total, percentage, skipped });
        
        // Ensure actualCost is a number (backend might return string)
        const cost = typeof data.actualCost === 'string' 
          ? parseFloat(data.actualCost) 
          : (data.actualCost || 0);
        console.info('[ParserPage] Setting currentCost to:', cost); // Debug log
        setCurrentCost(cost);
        
        // Capture parse errors if any
        if (data.errors && data.errors.length > 0) {
          setParseErrors(data.errors);
        }
        if (data.failedCount > 0) {
          console.warn(`[ParserPage] ${data.failedCount} criteria failed to parse`);
        }
      } else if (response.status === 404 || data.error === 'Job not found') {
        // Job doesn't exist anymore - clear state
        console.warn('[ParserPage] Job not found, clearing state');
        setJobId(null);
        setJobStatus('idle');
        setProgress({ parsed: 0, total: 0, percentage: 0, skipped: 0 });
        setCurrentCost(0);
        setResults([]);
        setParseErrors([]);
        localStorage.removeItem('parserJobId');
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, [jobId]);

  // API: Fetch job results (defined early for useEffect dependency)
  const fetchJobResults = useCallback(async () => {
    if (!jobId) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/job/${jobId}/results`);
      const data = await response.json();
      
      console.info('[ParserPage] fetchJobResults response:', data); // Debug log
      
      if (response.ok && !data.error) {
        setResults(data.results || []);
        console.info('[ParserPage] Set results count:', data.results?.length || 0); // Debug log
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    }
  }, [jobId]);

  // Fetch parser version on mount + check backend status
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_BASE}/version`, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        setBackendStatus(response.ok ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    
    checkBackend();
    fetchVersion();
    fetchHistory();
    fetchBalance();
    
    // Re-check backend every 10 seconds
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch estimate when model changes and file is uploaded
  useEffect(() => {
    if (uploadData && selectedModel) {
      fetchEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, uploadData]);

  // Poll for status when job is running or processing
  useEffect(() => {
    // Store current jobId to avoid stale closure issues
    const currentJobId = jobId;
    
    // Start polling for active job states
    if (currentJobId && (jobStatus === 'running' || jobStatus === 'processing')) {
      // Fetch immediately then poll
      fetchJobStatus();
      fetchJobResults();
      
      pollIntervalRef.current = setInterval(() => {
        fetchJobStatus();
        fetchJobResults();
      }, 2000);
    }
    
    // Stop polling only when job is truly finished
    if (jobStatus === 'completed' || jobStatus === 'failed') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // CRITICAL: Fetch BOTH status (for cost) and results AFTER clearing polling
      // This ensures we get the final cost and results
      if (currentJobId) {
        // Fetch final status to get actualCost from DB
        fetchJobStatus();
        fetchJobResults();
        fetchHistory();
        fetchBalance();
      }
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, jobStatus, fetchJobStatus, fetchJobResults]);

  // API: Fetch parser version
  const fetchVersion = async () => {
    try {
      const response = await fetch(`${API_BASE}/version`);
      const data = await response.json();
      setParserVersion(data.parserVersion);
    } catch (err) {
      console.error('Failed to fetch version:', err);
    }
  };

  // API: Upload file
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    
    setUploadedFile(file);
    setError(null);
    setLoading(true);
    
    // Read file content using FileReader for better JSDOM compatibility
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const fileContent = e.target.result;
        const jsonData = JSON.parse(fileContent);
        
        const response = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: jsonData,
            filename: file.name
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          setError(data.error || `Upload failed: ${response.status}`);
        } else if (data.error) {
          setError(data.error);
        } else {
          setUploadData(data);
        }
      } catch (err) {
        setError(`Failed to parse JSON file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    
    reader.readAsText(file);
  };

  // API: Fetch cost estimate
  const fetchEstimate = async () => {
    if (!uploadData) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteriaCount: uploadData.needsParsing,
          model: selectedModel
        })
      });
      
      const data = await response.json();
      if (response.ok && !data.error) {
        setEstimate(data);
      }
    } catch (err) {
      console.error('Failed to fetch estimate:', err);
    }
  };

  // API: Start parsing job
  const handleStartParsing = async () => {
    if (!uploadData || !uploadData.jobId) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/job/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: uploadData.jobId,
          model: selectedModel,
          forceReparse,
          budgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined,
          parseLimit: parseLimit ? parseInt(parseLimit, 10) : undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || `Failed to start: ${response.status}`);
      } else if (data.error) {
        setError(data.error);
      } else {
        const effectiveTotal = parseLimit ? Math.min(parseInt(parseLimit, 10), uploadData.needsParsing) : uploadData.needsParsing;
        setJobId(data.jobId || uploadData.jobId);
        setJobStatus('running');
        setProgress({ parsed: 0, total: effectiveTotal, percentage: 0, skipped: 0 });
      }
    } catch (err) {
      setError(`Failed to start parsing: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // API: Pause parsing job
  const handlePauseParsing = async () => {
    if (!jobId) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/job/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      
      const data = await response.json();
      if (response.ok && !data.error) {
        setJobStatus('paused');
      }
    } catch (err) {
      setError(`Failed to pause: ${err.message}`);
    }
  };

  // API: Resume parsing job
  const handleResumeParsing = async () => {
    if (!jobId) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/job/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      
      const data = await response.json();
      if (response.ok && !data.error) {
        setJobStatus('running');
      }
    } catch (err) {
      setError(`Failed to resume: ${err.message}`);
    }
  };

  // Download results as JSON
  const handleDownloadResults = () => {
    if (results.length === 0) {
      return;
    }
    
    const exportData = {
      jobId,
      parserVersion: parserVersion,
      exportedAt: new Date().toISOString(),
      criteriaCount: results.length,
      results: results.map(r => ({
        criterionId: r.criterionId,
        nctId: r.nctId,
        clusterType: r.clusterType,
        parsedOutput: r.parsedOutput,
        validationStatus: r.validationStatus,
        parsedAt: r.parsedAt
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parsed-results-${jobId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // API: Fetch history
  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      const data = await response.json();
      
      if (response.ok && !data.error) {
        setHistory(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  // API: Fetch balance
  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API_BASE}/balance`);
      const data = await response.json();
      
      if (response.ok && !data.error) {
        setBalance({ totalSpent: data.usedAmount || 0 });
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  // Helper: Detect cluster type from JSON (prefixed with _ to mark as intentionally unused for now)
  const _detectClusterType = (data) => {
    const firstCriterion = (data.criteria || data)[0];
    if (!firstCriterion) {
      return 'CLUSTER_AIC';
    }
    
    const id = firstCriterion.criterion_id || '';
    if (id.startsWith('PTH')) {
      return 'CLUSTER_PTH';
    }
    if (id.startsWith('CMB')) {
      return 'CLUSTER_CMB';
    }
    if (id.startsWith('BMI')) {
      return 'CLUSTER_BMI';
    }
    if (id.startsWith('AIC')) {
      return 'CLUSTER_AIC';
    }
    return 'CLUSTER_AIC';
  };

  return (
    <div className="parser-page">
      <header className="parser-header">
        <h1>Parser Testing UI</h1>
        <div className="header-status">
          {parserVersion && (
            <span className="parser-version">Parser v{parserVersion}</span>
          )}
          <span className={`backend-status status-${backendStatus}`} data-testid="backend-status">
            {backendStatus === 'online' && '🟢 Backend Online'}
            {backendStatus === 'offline' && '🔴 Backend Offline'}
            {backendStatus === 'checking' && '⏳ Checking...'}
          </span>
        </div>
      </header>

      {error && (
        <div className="parser-error" role="alert">
          {error}
        </div>
      )}

      <section className="parser-section">
        <h2>Upload Criteria File</h2>
        <div className="upload-area">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            data-testid="file-input"
            id="file-input"
          />
          <label htmlFor="file-input" className="upload-label">
            {uploadedFile ? uploadedFile.name : 'Upload JSON'}
          </label>
        </div>

        {uploadData && (
          <div className="upload-summary">
            <p><strong>{uploadData.criteriaCount}</strong> criteria total</p>
            <p><strong>{uploadData.alreadyParsed}</strong> already parsed</p>
            <p><strong>{uploadData.needsParsing}</strong> need parsing</p>
          </div>
        )}
      </section>

      <section className="parser-section">
        <h2>Configuration</h2>
        
        <div className="config-row">
          <label htmlFor="model-select">Model</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {MODELS.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>
        </div>

        <div className="config-row">
          <label htmlFor="budget-limit">Budget Limit ($)</label>
          <input
            type="number"
            id="budget-limit"
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(e.target.value)}
            placeholder="No limit"
            min="0"
            step="0.01"
          />
        </div>

        <div className="config-row">
          <label htmlFor="parse-limit">Parse Limit (criteria count)</label>
          <input
            type="number"
            id="parse-limit"
            value={parseLimit}
            onChange={(e) => setParseLimit(e.target.value)}
            placeholder={uploadData ? `All ${uploadData.needsParsing}` : 'No limit'}
            min="1"
            max={uploadData?.needsParsing || undefined}
          />
        </div>

        <div className="config-row">
          <label>
            <input
              type="checkbox"
              checked={forceReparse}
              onChange={(e) => setForceReparse(e.target.checked)}
            />
            Force Re-parse (ignore already-parsed criteria)
          </label>
        </div>
      </section>

      {estimate && (
        <section className="parser-section estimate-section">
          <h2>Estimate</h2>
          <p>
            <strong>Cost:</strong> ${typeof estimate.estimatedCost === 'number' 
              ? estimate.estimatedCost.toFixed(3)
              : `${estimate.estimatedCost.min.toFixed(2)} - ${estimate.estimatedCost.max.toFixed(2)}`}
          </p>
          <p>
            <strong>Time:</strong> {typeof estimate.estimatedTime === 'number'
              ? `~${estimate.estimatedTime}`
              : `${estimate.estimatedTime.min} - ${estimate.estimatedTime.max}`} seconds
          </p>
          {estimate.cacheSavings > 0 && (
            <p>
              <strong>Cache savings:</strong> ~{estimate.cacheSavings}%
            </p>
          )}
        </section>
      )}

      <section className="parser-section controls-section">
        <h2>Parsing Controls</h2>
        
        {!jobId && uploadData && (
          <button
            className="btn btn-primary"
            onClick={handleStartParsing}
            disabled={loading || uploadData.needsParsing === 0}
          >
            Start Parsing
          </button>
        )}

        {jobStatus === 'running' && (
          <button
            className="btn btn-warning"
            onClick={handlePauseParsing}
          >
            Pause
          </button>
        )}

        {jobStatus === 'paused' && (
          <button
            className="btn btn-success"
            onClick={handleResumeParsing}
          >
            Resume
          </button>
        )}

        {jobStatus && (
          <div className="progress-section" data-testid="progress-section">
            <div className="job-status" data-testid="job-status">Status: {jobStatus}</div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                role="progressbar"
                aria-valuenow={progress.percentage}
                aria-valuemin="0"
                aria-valuemax="100"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="progress-stats">
              <span>{progress.parsed} / {progress.total} parsed</span>
              <span data-testid="cost-display">${currentCost.toFixed(2)} spent</span>
            </div>
            
            {/* Show parse errors if any */}
            {parseErrors.length > 0 && (
              <div className="parse-errors" data-testid="parse-errors" style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                color: '#856404'
              }}>
                <strong>⚠️ {parseErrors.length} criteria failed to parse:</strong>
                <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
                  {parseErrors.slice(0, 3).map((err, idx) => (
                    <li key={idx} style={{ fontSize: '0.9rem' }}>
                      <code>{err.criterionId}</code>: {err.error.includes('credit balance') 
                        ? 'Anthropic API: insufficient credits' 
                        : err.error.substring(0, 100)}
                    </li>
                  ))}
                  {parseErrors.length > 3 && (
                    <li style={{ fontStyle: 'italic' }}>...and {parseErrors.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Show message when job completed but no results */}
      {jobStatus === 'completed' && results.length === 0 && (
        <section className="parser-section" data-testid="no-results-section" style={{
          backgroundColor: progress.skipped > 0 && parseErrors.length === 0 ? '#fff3cd' : '#f8d7da',
          border: `1px solid ${progress.skipped > 0 && parseErrors.length === 0 ? '#ffc107' : '#f5c6cb'}`,
          borderRadius: '8px',
          padding: '1rem'
        }}>
          {progress.skipped > 0 && parseErrors.length === 0 ? (
            <>
              <h2 style={{ color: '#856404', margin: '0 0 0.5rem 0' }}>⚠️ All Criteria Already Parsed</h2>
              <p style={{ color: '#856404', margin: 0 }}>
                {progress.skipped} criteria were skipped because they are already in the database.
                {' '}To re-parse them, enable <strong>"Force Re-parse"</strong> checkbox.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ color: '#721c24', margin: '0 0 0.5rem 0' }}>❌ No Results</h2>
              <p style={{ color: '#721c24', margin: 0 }}>
                {parseErrors.length > 0 
                  ? `Parsing failed for ${parseErrors.length} criteria. Check errors above.`
                  : 'Parsing completed but no criteria were parsed. Check your Anthropic API key and credit balance.'}
              </p>
            </>
          )}
        </section>
      )}

      {results.length > 0 && (
        <section className="parser-section results-section" data-testid="results-section">
          <h2>Results</h2>
          <div className="results-header">
            <span>{results.length} criteria parsed</span>
            <button
              className="btn btn-secondary"
              onClick={handleDownloadResults}
              data-testid="download-button"
            >
              📥 Download JSON
            </button>
          </div>
          <table className="results-table">
            <thead>
              <tr>
                <th>Criterion ID</th>
                <th>NCT ID</th>
                <th>Status</th>
                <th>Parsed At</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => (
                <tr key={result.criterionId || idx}>
                  <td>{result.criterionId}</td>
                  <td>{result.nctId}</td>
                  <td className={`status-${result.status}`}>{result.status}</td>
                  <td>{new Date(result.parsedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="parser-section balance-section">
        <h2>API Usage</h2>
        <p><strong>Total Spent:</strong> ${balance.totalSpent.toFixed(2)}</p>
      </section>

      <section className="parser-section history-section">
        <h2>History</h2>
        {history.length === 0 ? (
          <p>No parsing history yet.</p>
        ) : (
          <ul className="history-list">
            {history.map(job => (
              <li key={job.id}>
                <span className="job-id" title={job.id}>
                  {job.inputFile || job.clusterType || job.id.substring(0, 8)}
                </span>
                <span className={`job-status status-${job.status}`}>{job.status}</span>
                <span>{job.parsedCount}/{job.totalCriteria} criteria</span>
                <span>${(job.actualCost || 0).toFixed(3)}</span>
                <span>{new Date(job.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
