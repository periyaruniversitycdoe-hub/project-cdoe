import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/imports';

function getToken() { return localStorage.getItem('adminToken') || ''; }
function authHeaders(json = false) {
    const h = { Authorization: `Bearer ${getToken()}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

export default function UnifiedImportWizard({ initialDestination, onClose, onRefresh }) {
    const [destination, setDestination] = useState(initialDestination || 'supervisors');
    const [importMode, setImportMode] = useState('update_existing'); // Mode B default
    const [stage, setStage] = useState(0); // 0: Select / Destination, 1: Mapping, 2: Preview, 3: Completed
    
    const [loading, setLoading] = useState(false);
    const [fields, setFields] = useState([]);
    const [destinationLabel, setDestinationLabel] = useState('');
    
    // File upload/mapping state
    const [pendingFile, setPendingFile] = useState(null);
    const [detectedInfo, setDetectedInfo] = useState(null);
    const [columnMapping, setColumnMapping] = useState({}); // { excel_key: db_field }
    const [importPreview, setImportPreview] = useState(null);
    const [modifiedRows, setModifiedRows] = useState([]);
    const [importSummary, setImportSummary] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    const fileRef = useRef(null);

    // Mappings list for dropdown categories
    const DEST_OPTIONS = [
        { value: 'supervisors', label: 'Supervisor Master' },
        { value: 'master_institutes', label: 'Supervisor College / Institute Master' },
        { value: 'research_centres', label: 'Research Centre Master' }
    ];

    // Load fields for selected destination
    const loadDestinationFields = useCallback(async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch(`${API_BASE}/fields/${destination}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) {
                setFields(json.fields);
                setDestinationLabel(json.label);
            } else {
                setErrorMsg(json.message || 'Failed to load fields');
            }
        } catch {
            setErrorMsg('Network error loading destination fields');
        } finally {
            setLoading(false);
        }
    }, [destination]);

    useEffect(() => {
        loadDestinationFields();
    }, [loadDestinationFields]);

    // Handle excel file upload
    async function handleFileUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setLoading(true);
        setErrorMsg('');
        
        try {
            const fd = new FormData();
            fd.append('file', file);
            
            const res = await fetch(`${API_BASE}/preview/${destination}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` },
                body: fd
            });
            const json = await res.json();
            if (json.success) {
                if (json.needs_mapping) {
                    setStage(1);
                } else {
                    setDetectedInfo(json.detected_info);
                    // Prebuild columns mapping
                    const mapping = {};
                    if (json.detected_info?.excel_headers) {
                        // reverse map auto-detected fields
                        const colToField = {};
                        for (const [dbField, colIdx] of Object.entries(json.detected_info.auto_mapped || {})) {
                            colToField[colIdx] = dbField;
                        }
                        json.detected_info.excel_headers.forEach(h => {
                            mapping[h.key] = colToField[h.col] || '';
                        });
                    }
                    setColumnMapping(mapping);
                    setImportPreview(json.preview);
                    setImportSummary(json.summary);
                    setModifiedRows((json.preview?.modified || []).map(r => ({ ...r, action: 'update' })));
                    setStage(1); // Mapped wizard always shown so admin can confirm mappings
                }
            } else {
                setErrorMsg(json.message || 'Excel analysis failed');
                setPendingFile(null);
            }
        } catch {
            setErrorMsg('Network error analyzing file');
            setPendingFile(null);
        } finally {
            setLoading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    // Apply / Confirm Dynamic Mapping Wizard
    async function handleMappingConfirm() {
        if (!pendingFile) return;
        setLoading(true);
        setErrorMsg('');
        
        try {
            // Find overrides to send
            const originalMapping = {};
            if (detectedInfo?.excel_headers) {
                const colToField = {};
                for (const [dbField, colIdx] of Object.entries(detectedInfo.auto_mapped || {})) {
                    colToField[colIdx] = dbField;
                }
                detectedInfo.excel_headers.forEach(h => {
                    originalMapping[h.key] = colToField[h.col] || '';
                });
            }

            const overrides = {};
            for (const [key, val] of Object.entries(columnMapping)) {
                if (val && val !== originalMapping[key]) overrides[key] = val;
            }

            const fd = new FormData();
            fd.append('file', pendingFile);
            if (Object.keys(overrides).length > 0) {
                fd.append('column_map', JSON.stringify(overrides));
            }

            const res = await fetch(`${API_BASE}/preview/${destination}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` },
                body: fd
            });
            const json = await res.json();
            if (json.success && json.preview) {
                setDetectedInfo(json.detected_info);
                setImportPreview(json.preview);
                setImportSummary(json.summary);
                setModifiedRows((json.preview.modified || []).map(r => ({ ...r, action: 'update' })));
                setStage(2);
            } else {
                setErrorMsg(json.message || 'Mapping error');
            }
        } catch {
            setErrorMsg('Network error applying column mapping');
        } finally {
            setLoading(false);
        }
    }

    // Modify row level custom actions (update / skip / ignore)
    function setRowAction(idx, action) {
        setModifiedRows(prev => prev.map((r, i) => i === idx ? { ...r, action } : r));
    }

    // Apply action for all modified rows
    function applyForAll(action) {
        setModifiedRows(prev => prev.map(r => ({ ...r, action })));
    }

    // Confirm dynamic bulk import
    async function handleImportConfirm() {
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch(`${API_BASE}/confirm/${destination}`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({
                    new_rows: importPreview?.new || [],
                    modified_rows: modifiedRows,
                    import_mode: importMode,
                    filename: importSummary?.filename || pendingFile?.name || '',
                    summary: importSummary
                })
            });
            const json = await res.json();
            if (json.success) {
                setImportResult(json.results);
                setStage(3);
                if (onRefresh) onRefresh();
            } else {
                setErrorMsg(json.message || 'Confirm import failed');
            }
        } catch {
            setErrorMsg('Network error performing bulk import');
        } finally {
            setLoading(false);
        }
    }

    function resetWizard() {
        setStage(0);
        setPendingFile(null);
        setDetectedInfo(null);
        setColumnMapping({});
        setImportPreview(null);
        setModifiedRows([]);
        setImportSummary(null);
        setImportResult(null);
        setErrorMsg('');
    }

    return (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content border-0 shadow-lg">
                    {/* Header */}
                    <div className="modal-header bg-primary text-white py-3">
                        <div className="d-flex align-items-center gap-2">
                            <span className="fs-4">📊</span>
                            <h5 className="modal-title fw-bold mb-0">Enterprise Consolidated Excel &amp; CSV Import Engine</h5>
                        </div>
                        <button className="btn-close btn-close-white" onClick={onClose} aria-label="Close" />
                    </div>

                    {/* Stage Steps Indicator */}
                    <div className="bg-light border-bottom px-4 py-2 d-flex gap-3 flex-wrap align-items-center">
                        {['1. Config & File', '2. Field Mapping', '3. Diff Preview', '4. Complete'].map((step, i) => (
                            <div key={i} className={`d-flex align-items-center gap-1 small fw-semibold ${stage === i ? 'text-primary' : stage > i ? 'text-success' : 'text-muted'}`}>
                                <span className={`badge rounded-pill ${stage === i ? 'bg-primary' : stage > i ? 'bg-success' : 'bg-secondary'}`}>
                                    {stage > i ? '✓' : i + 1}
                                </span>
                                <span>{step}</span>
                                {i < 3 && <span className="text-muted ms-2">&rsaquo;</span>}
                            </div>
                        ))}
                    </div>

                    {/* Body */}
                    <div className="modal-body p-4">
                        {errorMsg && <div className="alert alert-danger py-2 small fw-semibold">{errorMsg}</div>}

                        {/* STAGE 0: Configure Destination & Select File */}
                        {stage === 0 && (
                            <div className="row g-4">
                                <div className="col-md-5">
                                    <div className="card h-100 border-0 bg-light p-3">
                                        <h6 className="fw-bold text-primary mb-3">Settings & Options</h6>
                                        
                                        <div className="mb-3">
                                            <label className="form-label fw-bold small text-muted">Import Destination</label>
                                            <select className="form-select border-primary fw-semibold" value={destination} onChange={e => setDestination(e.target.value)}>
                                                {DEST_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label fw-bold small text-muted">Duplicate Handling Mode</label>
                                            <div className="d-flex flex-column gap-2 mt-1">
                                                {[
                                                    { value: 'insert_all', label: 'Mode A: Insert All (Keep duplicates)', color: 'secondary' },
                                                    { value: 'update_existing', label: 'Mode B: Update Existing (Merge file values)', color: 'info' },
                                                    { value: 'skip_existing', label: 'Mode C: Skip Existing (Ignore duplicates)', color: 'warning' },
                                                    { value: 'insert_new', label: 'Mode D: Insert New Only (Do not apply updates)', color: 'success' }
                                                ].map(mode => (
                                                    <label key={mode.value} className="d-flex align-items-center gap-2 p-2 rounded bg-white border pointer-event" style={{ cursor: 'pointer' }}>
                                                        <input type="radio" name="import_mode" value={mode.value} checked={importMode === mode.value} onChange={() => setImportMode(mode.value)} />
                                                        <span className="small fw-semibold">{mode.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white border rounded p-2 small mt-2">
                                            <div className="fw-bold text-success">⚙️ ZERO VALIDATION ACTIVE:</div>
                                            <div className="text-muted" style={{ fontSize: 11 }}>
                                                Empty values and format inconsistencies are accepted gracefully. Missing FK records (e.g. new designations, departments) will be auto-provisioned!
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-md-7">
                                    <div className="card h-100 border-2 border-dashed p-5 text-center bg-white justify-content-center d-flex flex-column align-items-center" style={{ borderStyle: 'dashed', borderColor: '#adb5bd' }}>
                                        <div className="fs-1 mb-2">📁</div>
                                        <h5 className="fw-bold mb-1">Select Data File (Excel or CSV)</h5>
                                        <p className="text-muted small mb-4">Supported extensions: .xlsx, .xls, .csv (Max 15MB)<br/>Works with dynamic columns and custom mapping wizards</p>
                                        
                                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="d-none" id="importFileUnified" onChange={handleFileUpload} />
                                        
                                        <div className="d-flex gap-2 flex-wrap justify-content-center">
                                            <button className="btn btn-outline-secondary" onClick={() => {
                                                const a = document.createElement('a');
                                                a.href = `${API_BASE}/template/${destination}?token=${getToken()}`;
                                                a.click();
                                            }}>📥 Excel Template</button>

                                            <button className="btn btn-outline-secondary" onClick={() => {
                                                const a = document.createElement('a');
                                                a.href = `${API_BASE}/template/${destination}?format=csv&token=${getToken()}`;
                                                a.click();
                                            }}>📥 CSV Template</button>
                                            
                                            <label htmlFor="importFileUnified" className={`btn btn-primary px-4 fw-bold mb-0 d-flex align-items-center ${loading ? 'disabled' : ''}`}>
                                                {loading ? '🔍 Parsing File...' : '📂 Choose Excel/CSV File'}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STAGE 1: Column / Field Mapping Wizard */}
                        {stage === 1 && detectedInfo && (
                            <div>
                                <div className="alert alert-info py-2 small mb-3">
                                    <strong>Column Mapping Wizard:</strong> Map your Excel columns on the left to target Database fields on the right. Columns with matching names are suggested automatically.
                                </div>

                                <div className="card border shadow-sm">
                                    <div className="card-header bg-white py-2">
                                        <div className="fw-bold text-primary small">Mapping Columns ({pendingFile?.name})</div>
                                    </div>
                                    <div className="card-body p-0">
                                        <div className="table-responsive" style={{ maxHeight: '350px' }}>
                                            <table className="table table-hover table-striped align-middle mb-0">
                                                <thead className="table-light sticky-top">
                                                    <tr>
                                                        <th>Excel Column Header</th>
                                                        <th>Sample Excel Value</th>
                                                        <th>Direction</th>
                                                        <th>Target Database Field</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detectedInfo.excel_headers?.map((hdr) => {
                                                        const currentMappedField = columnMapping[hdr.key] || '';
                                                        return (
                                                            <tr key={hdr.key}>
                                                                <td>
                                                                    <span className="badge bg-light text-dark border fw-bold text-break">{hdr.raw}</span>
                                                                </td>
                                                                <td className="text-muted small text-truncate" style={{ maxWidth: 200 }}>
                                                                    {hdr.key.includes('email') ? 'e.g. info@domain.com' : 'Sample Data'}
                                                                </td>
                                                                <td className="text-muted">&rarr;</td>
                                                                <td>
                                                                    <select className="form-select form-select-sm border-primary" style={{ maxWidth: 280 }} value={currentMappedField} onChange={e => {
                                                                        const val = e.target.value;
                                                                        setColumnMapping(prev => ({ ...prev, [hdr.key]: val }));
                                                                    }}>
                                                                        <option value="">-- Skip Column --</option>
                                                                        {fields.map(f => (
                                                                            <option key={f.key} value={f.key}>{f.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STAGE 2: Dry-run / Diff Preview */}
                        {stage === 2 && importPreview && (
                            <div>
                                {/* Summary stats row */}
                                <div className="row g-3 mb-4">
                                    <div className="col">
                                        <div className="card border-start border-4 border-success shadow-sm p-3">
                                            <div className="small text-muted fw-bold">NEW RECORDS (TO INSERT)</div>
                                            <div className="fs-3 fw-bold text-success">{importSummary?.new}</div>
                                        </div>
                                    </div>
                                    <div className="col">
                                        <div className="card border-start border-4 border-info shadow-sm p-3">
                                            <div className="small text-muted fw-bold">MODIFIED RECORDS (TO UPDATE)</div>
                                            <div className="fs-3 fw-bold text-info">{importSummary?.modified}</div>
                                        </div>
                                    </div>
                                    <div className="col">
                                        <div className="card border-start border-4 border-warning shadow-sm p-3">
                                            <div className="small text-muted fw-bold">EXACT DUPLICATES (TO INSERT)</div>
                                            <div className="fs-3 fw-bold text-warning">{importSummary?.duplicate}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Previewing Tables */}
                                {modifiedRows.length > 0 && (
                                    <div className="card border mb-4">
                                        <div className="card-header bg-light d-flex justify-content-between align-items-center py-2">
                                            <div className="fw-bold small text-info">🔍 Differing Rows Review (Updates Preview)</div>
                                            <div className="d-flex gap-2">
                                                <button className="btn btn-xs btn-outline-success btn-sm" onClick={() => applyForAll('update')}>Apply All Updates</button>
                                                <button className="btn btn-xs btn-outline-secondary btn-sm" onClick={() => applyForAll('ignore')}>Ignore All Updates</button>
                                            </div>
                                        </div>
                                        <div className="card-body p-0">
                                            <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                                <table className="table table-sm table-hover align-middle mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th>Excel Row</th>
                                                            <th>Name</th>
                                                            <th>Changes / Differences</th>
                                                            <th>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {modifiedRows.map((row, idx) => (
                                                            <tr key={idx} className={row.action === 'ignore' ? 'table-secondary text-muted' : ''}>
                                                                <td><code>Row {row.row_number}</code></td>
                                                                <td className="fw-bold">{row.name || row.college_name || '—'}</td>
                                                                <td>
                                                                    <div className="d-flex flex-column gap-1">
                                                                        {row.changes?.map((chg, cidx) => (
                                                                            <div key={cidx} className="small">
                                                                                <span className="badge bg-light text-dark">{chg.label}</span>: 
                                                                                <span className="text-danger text-decoration-line-through mx-1">{String(chg.old_value || '—')}</span> &rarr; 
                                                                                <span className="text-success fw-bold mx-1">{String(chg.new_value || '—')}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <select className="form-select form-select-sm" style={{ width: 120 }} value={row.action} onChange={e => setRowAction(idx, e.target.value)}>
                                                                        <option value="update">Apply Update</option>
                                                                        <option value="ignore">Ignore / Skip</option>
                                                                    </select>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* New Rows Preview */}
                                {importPreview.new?.length > 0 && (
                                    <div className="card border">
                                        <div className="card-header bg-light py-2">
                                            <div className="fw-bold small text-success">📝 New Entries Preview ({importPreview.new.length} rows)</div>
                                        </div>
                                        <div className="card-body p-0">
                                            <div className="table-responsive" style={{ maxHeight: '250px' }}>
                                                <table className="table table-sm table-striped mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th>Excel Row</th>
                                                            <th>Target Database Values</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importPreview.new.slice(0, 15).map((row, idx) => (
                                                            <tr key={idx}>
                                                                <td><code>Row {row.row_number}</code></td>
                                                                <td className="small">
                                                                    {Object.entries(row).filter(([k]) => k !== 'row_number' && k !== 'warnings').map(([k, v]) => (
                                                                        <span key={k} className="me-3 text-nowrap">
                                                                            <strong>{k}:</strong> <span className="text-muted">{String(v || '—')}</span>
                                                                        </span>
                                                                    ))}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {importPreview.new.length > 15 && (
                                                            <tr>
                                                                <td colSpan={2} className="text-center text-muted small py-2">... and {importPreview.new.length - 15} more new records ...</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STAGE 3: Completed Results Summary */}
                        {stage === 3 && importResult && (
                            <div className="text-center py-5">
                                <div className="fs-1 mb-2">✅</div>
                                <h4 className="fw-bold text-success mb-3">Bulk Data Import Succeeded!</h4>
                                
                                <div className="d-flex justify-content-center gap-3 flex-wrap mb-4" style={{ maxWidth: '650px', margin: '0 auto' }}>
                                    <div className="card p-3 shadow-sm border-0 bg-success-subtle text-success-emphasis" style={{ width: '130px' }}>
                                        <div className="small fw-bold">INSERTED</div>
                                        <div className="fs-2 fw-bold">{importResult.inserted}</div>
                                    </div>
                                    <div className="card p-3 shadow-sm border-0 bg-info-subtle text-info-emphasis" style={{ width: '130px' }}>
                                        <div className="small fw-bold">UPDATED</div>
                                        <div className="fs-2 fw-bold">{importResult.updated}</div>
                                    </div>
                                    <div className="card p-3 shadow-sm border-0 bg-warning-subtle text-warning-emphasis" style={{ width: '130px' }}>
                                        <div className="small fw-bold">IGNORED</div>
                                        <div className="fs-2 fw-bold">{importResult.ignored || 0}</div>
                                    </div>
                                    <div className="card p-3 shadow-sm border-0 bg-light border text-muted" style={{ width: '130px' }}>
                                        <div className="small fw-bold">SKIPPED</div>
                                        <div className="fs-2 fw-bold">{importResult.skipped}</div>
                                    </div>
                                </div>

                                {importResult.warnings?.length > 0 && (
                                    <div className="alert alert-warning text-start small mb-4" style={{ maxWidth: '650px', margin: '0 auto 1.5rem' }}>
                                        <strong>⚠️ {importResult.warnings.length} warning(s) handled:</strong>
                                        <ul className="mb-0 mt-1" style={{ maxHeight: 150, overflowY: 'auto' }}>
                                            {importResult.warnings.map((w, i) => (
                                                <li key={i}>Row <code>{w.row}</code>: {w.note}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="modal-footer py-2 bg-light">
                        {stage === 0 && (
                            <button className="btn btn-outline-secondary" onClick={onClose} disabled={loading}>Close</button>
                        )}
                        {stage === 1 && (
                            <>
                                <button className="btn btn-outline-secondary" onClick={resetWizard} disabled={loading}>&larr; Start Over</button>
                                <button className="btn btn-primary" onClick={handleMappingConfirm} disabled={loading}>
                                    {loading ? 'Applying Map...' : 'Confirm Mappings & Preview &rarr;'}
                                </button>
                            </>
                        )}
                        {stage === 2 && (
                            <>
                                <button className="btn btn-outline-secondary" onClick={() => setStage(1)} disabled={loading}>&larr; Adjust Map</button>
                                <button className="btn btn-success fw-bold px-4" onClick={handleImportConfirm} disabled={loading}>
                                    {loading ? '📥 Processing Chunks...' : '📥 Execute Bulk Import Now'}
                                </button>
                            </>
                        )}
                        {stage === 3 && (
                            <button className="btn btn-primary px-4 fw-bold" onClick={onClose}>Finish &amp; Close</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
