import { useEffect, useState } from 'react';
import DynamicDropdown from '@admin/components/DynamicDropdown';

const EMPTY_ROW = () => ({
    _key: Math.random(),
    type: 'Primary',
    discipline_id: '',
    centre_id: '',
    recognition_date: '',
});

export default function DisciplineRepeater({ value = [], onChange, centres = [] }) {
    const [rows, setRows] = useState(value.length ? value.map(r => ({ ...r, _key: Math.random() })) : [EMPTY_ROW()]);

    useEffect(() => {
        onChange(rows.map(({ _key, ...rest }) => rest));
    }, [rows]); // eslint-disable-line

    function add() { setRows(prev => [...prev, EMPTY_ROW()]); }

    function remove(key) {
        setRows(prev => prev.length > 1 ? prev.filter(r => r._key !== key) : prev);
    }

    function update(key, field, val) {
        setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));
    }

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold text-secondary" style={{ fontSize: 13 }}>
                    Discipline Registrations
                </span>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={add}>
                    + Add More
                </button>
            </div>

            {rows.map((row, idx) => (
                <div key={row._key} className="border rounded p-3 mb-2 bg-light">
                    <div className="row g-2 align-items-end">
                        <div className="col-md-2">
                            <label className="form-label small mb-1">Type</label>
                            <select
                                className="form-select form-select-sm"
                                value={row.type}
                                onChange={e => update(row._key, 'type', e.target.value)}
                            >
                                <option value="Primary">Primary</option>
                                <option value="Additional">Additional</option>
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label small mb-1">Discipline</label>
                            <select
                                className="form-select form-select-sm"
                                value={row.discipline_id}
                                onChange={e => update(row._key, 'discipline_id', e.target.value)}
                            >
                                <option value="">-- Select --</option>
                                {/* populated by DynamicDropdown inline equivalent */}
                            </select>
                            {/* Use a native select backed by DynamicDropdown cache */}
                            <DisciplineSelect
                                value={row.discipline_id}
                                onChange={v => update(row._key, 'discipline_id', v)}
                            />
                        </div>

                        <div className="col-md-3">
                            <label className="form-label small mb-1">Centre</label>
                            <select
                                className="form-select form-select-sm"
                                value={row.centre_id}
                                onChange={e => update(row._key, 'centre_id', e.target.value)}
                            >
                                <option value="">-- Select Centre --</option>
                                {centres.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label small mb-1">Recognition Date</label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={row.recognition_date || ''}
                                onChange={e => update(row._key, 'recognition_date', e.target.value)}
                            />
                        </div>

                        <div className="col-md-1 text-end">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => remove(row._key)}
                                disabled={rows.length === 1}
                                title="Remove row"
                            >
                                &times;
                            </button>
                        </div>
                    </div>
                    <div className="mt-1">
                        <span className={`badge ${row.type === 'Primary' ? 'bg-primary' : 'bg-secondary'}`} style={{ fontSize: 10 }}>
                            {idx === 0 ? 'Row 1' : `Row ${idx + 1}`} — {row.type}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function DisciplineSelect({ value, onChange }) {
    const [options, setOptions] = useState([]);

    useEffect(() => {
        fetch((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/masters/disciplines?active_only=true')
            .then(r => r.json())
            .then(j => { if (j.success) setOptions(j.data); })
            .catch(() => {});
    }, []);

    return (
        <select
            className="form-select form-select-sm mt-1"
            value={value}
            onChange={e => onChange(e.target.value)}
        >
            <option value="">-- Select Discipline --</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
    );
}
