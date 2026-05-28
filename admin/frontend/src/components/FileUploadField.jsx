import { useRef, useState } from 'react';

const ADMIN_BASE = ((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '');

export default function FileUploadField({
    name,
    label,
    accept = 'image/*,application/pdf',
    maxSizeMB = 5,
    currentUrl = null,
    onChange,
    required = false,
    error = '',
    hint = '',
}) {
    const ref = useRef();
    const [preview, setPreview] = useState(null);
    const [fileName, setFileName] = useState('');
    const [sizeError, setSizeError] = useState('');

    const maxBytes = maxSizeMB * 1024 * 1024;

    function handleChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > maxBytes) {
            setSizeError(`File too large. Max ${maxSizeMB} MB allowed.`);
            e.target.value = '';
            return;
        }
        setSizeError('');
        setFileName(file.name);

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => setPreview(ev.target.result);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }

        if (onChange) onChange(e);
    }

    function handleRemove() {
        setPreview(null);
        setFileName('');
        if (ref.current) ref.current.value = '';
        if (onChange) onChange({ target: { name, files: [] } });
    }

    const effectiveError = error || sizeError;
    const existingUrl = currentUrl ? `${ADMIN_BASE}${currentUrl}` : null;
    const isImage = name => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

    return (
        <div className="mb-3">
            {label && (
                <label className="form-label fw-semibold">
                    {label}{required && <span className="text-danger ms-1">*</span>}
                </label>
            )}

            {/* Current file preview */}
            {!preview && existingUrl && (
                <div className="mb-2 border rounded p-2 bg-light d-inline-block">
                    {isImage(currentUrl) ? (
                        <img src={existingUrl} alt="current" style={{ maxHeight: 80, maxWidth: 160, objectFit: 'contain' }} />
                    ) : (
                        <a href={existingUrl} target="_blank" rel="noreferrer" className="text-primary small">
                            <i className="bi bi-file-earmark-pdf me-1"></i>View existing file
                        </a>
                    )}
                    <div className="text-muted" style={{ fontSize: 11 }}>Current file (will be replaced on upload)</div>
                </div>
            )}

            {/* New file preview */}
            {preview && (
                <div className="mb-2 border rounded p-2 bg-light d-inline-block">
                    <img src={preview} alt="preview" style={{ maxHeight: 80, maxWidth: 160, objectFit: 'contain' }} />
                    <div className="text-muted" style={{ fontSize: 11 }}>{fileName}</div>
                </div>
            )}

            <div className="d-flex align-items-center gap-2">
                <input
                    ref={ref}
                    type="file"
                    name={name}
                    accept={accept}
                    onChange={handleChange}
                    required={required && !currentUrl}
                    className={`form-control ${effectiveError ? 'is-invalid' : ''}`}
                    style={{ maxWidth: 340 }}
                />
                {(preview || fileName) && (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleRemove}>
                        Remove
                    </button>
                )}
            </div>

            {hint && <div className="form-text text-muted">{hint}</div>}
            {effectiveError && <div className="text-danger small mt-1">{effectiveError}</div>}
        </div>
    );
}
