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
import { useState, useEffect, useRef } from 'react';
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
  const [progress, setProgress] = useState({ parsed: 0, total: 0, percentage: 0 });
  const [currentCost, setCurrentCost] = useState(0);
  
  // State: Results
  const [results, setResults] = useState([]);
  
  // State: Options
  const [forceReparse, setForceReparse] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState('');
  
  // State: History
  const [history, setHistory] = useState([]);
  
  // State: API Balance
  const [balance, setBalance] = useState({ totalSpent: 0 });
  
  // State: Loading/Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Polling interval ref
  const pollIntervalRef = useRef(null);

  // Fetch parser version on mount
  useEffect(() => {
    fetchVersion();
    fetchHistory();
    fetchBalance();
  }, []);

  // Fetch estimate when model changes and file is uploaded
  useEffect(() => {
    if (uploadData && selectedModel) {
      fetchEstimate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, uploadData]);

  // Poll for status when job is running
  useEffect(() => {
    if (jobId && jobStatus === 'running') {
      // Fetch immediately then poll
      fetchJobStatus();
      fetchJobResults();
      
      pollIntervalRef.current = setInterval(() => {
        fetchJobStatus();
        fetchJobResults();
      }, 2000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, jobStatus]);

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
        
        if (data.success) {
          setUploadData(data);
        } else {
          setError(data.error || 'Upload failed');
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
      if (data.success) {
        setEstimate(data);
      }
    } catch (err) {
      console.error('Failed to fetch estimate:', err);
    }
  };

  // API: Start parsing job
  const handleStartParsing = async () => {
    if (!uploadData) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/job/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterType: uploadData.clusterType,
          criteria: uploadData.criteria,
          model: selectedModel,
          forceReparse,
          budgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setJobId(data.jobId);
        setJobStatus('running');
        setProgress({ parsed: 0, total: data.totalCriteria, percentage: 0 });
      } else {
        setError(data.error || 'Failed to start parsing');
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
      if (data.success) {
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
      if (data.success) {
        setJobStatus('running');
      }
    } catch (err) {
      setError(`Failed to resume: ${err.message}`);
    }
  };

  // API: Fetch job status
  const fetchJobStatus = async () => {
    if (!jobId) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/job/${jobId}/status`);
      const data = await response.json();
      
      if (data.success) {
        setJobStatus(data.status);
        setProgress(data.progress);
        setCurrentCost(data.cost || 0);
        
        if (data.status === 'completed' || data.status === 'failed') {
          fetchHistory();
          fetchBalance();
        }
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  // API: Fetch job results
  const fetchJobResults = async () => {
    if (!jobId) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/job/${jobId}/results`);
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results || []);
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    }
  };

  // API: Fetch history
  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      const data = await response.json();
      
      if (data.success) {
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
      
      if (data.success) {
        setBalance(data);
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  // Helper: Detect cluster type from JSON
  const detectClusterType = (data) => {
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
        {parserVersion && (
          <span className="parser-version">Parser v{parserVersion}</span>
        )}
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
            <strong>Cost:</strong> ${estimate.estimatedCost.min.toFixed(2)} - ${estimate.estimatedCost.max.toFixed(2)}
          </p>
          <p>
            <strong>Time:</strong> {estimate.estimatedTime.min} - {estimate.estimatedTime.max} seconds
          </p>
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
          <div className="progress-section">
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
              <span>${currentCost.toFixed(2)} spent</span>
            </div>
          </div>
        )}
      </section>

      {results.length > 0 && (
        <section className="parser-section results-section">
          <h2>Results</h2>
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
                <span className="job-id">{job.id}</span>
                <span className={`job-status status-${job.status}`}>{job.status}</span>
                <span>{job.parsedCount}/{job.totalCriteria} criteria</span>
                <span>{new Date(job.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
