import { useEffect, useState, useCallback } from 'react';

const BASE = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/masters';
const cache = {};

export default function DynamicDropdown({
    type,
    value,
    onChange,
    name,
    label,
    required = false,
    disabled = false,
    placeholder = '-- Select --',
    activeOnly = true,
    className = '',
    error = '',
}) {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (cache[type]) { setOptions(cache[type]); return; }
        setLoading(true);
        try {
            const res = await fetch(`${BASE}/${type}${activeOnly ? '?active_only=true' : ''}`);
            const json = await res.json();
            if (json.success) { cache[type] = json.data; setOptions(json.data); }
        } catch { /* network error — options stay empty */ }
        finally { setLoading(false); }
    }, [type, activeOnly]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className={`form-group ${className}`}>
            {label && (
                <label className="form-label">
                    {label}{required && <span className="text-danger ms-1">*</span>}
                </label>
            )}
            <select
                name={name}
                value={value ?? ''}
                onChange={onChange}
                disabled={disabled || loading}
                required={required}
                className={`form-select ${error ? 'is-invalid' : ''}`}
            >
                <option value="">{loading ? 'Loading...' : placeholder}</option>
                {options.map(o => (
                    <option key={o.id} value={o.id}>{o.name}{o.abbreviation ? ` (${o.abbreviation})` : ''}</option>
                ))}
            </select>
            {error && <div className="invalid-feedback">{error}</div>}
        </div>
    );
}

export function invalidateDropdownCache(type) {
    if (type) delete cache[type];
    else Object.keys(cache).forEach(k => delete cache[k]);
}
