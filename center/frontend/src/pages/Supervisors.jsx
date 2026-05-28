import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = (import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003') + '/api';

const S = {
  section: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  td: { padding: '11px 12px', borderBottom: '1px solid #f1f5f9', color: '#374151' },
  badge: (s) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s === 'Active' ? '#dcfce7' : s === 'Inactive' ? '#fee2e2' : '#fef9c3', color: s === 'Active' ? '#16a34a' : s === 'Inactive' ? '#dc2626' : '#854d0e' }),
  search: { padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 260, outline: 'none', marginBottom: 16 },
  noData: { textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 },
};

export default function Supervisors() {
  const [supervisors, setSupervisors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/portal/supervisors`).then(r => setSupervisors(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = supervisors.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.supervisor_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.department_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#0891b2' }}>Loading supervisors...</div>;

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>Supervisors Under This Centre ({supervisors.length})</div>
      <input style={S.search} placeholder="Search by name, no., department..." value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.length === 0 ? (
        <div style={S.noData}>
          {supervisors.length === 0 ? 'No supervisors found. Your centre may not be linked yet.' : 'No results match your search.'}
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>#</th>
              <th style={S.th}>Name</th>
              <th style={S.th}>Supervisor No.</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Designation</th>
              <th style={S.th}>Department</th>
              <th style={S.th}>Max</th>
              <th style={S.th}>Vacancy</th>
              <th style={S.th}>FT/PT</th>
              <th style={S.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sv, i) => (
              <tr key={sv.id}>
                <td style={S.td}>{i + 1}</td>
                <td style={S.td}><strong>{sv.name}</strong></td>
                <td style={S.td}>{sv.supervisor_no || '—'}</td>
                <td style={S.td}>{sv.email || '—'}</td>
                <td style={S.td}>{sv.designation_name || '—'}</td>
                <td style={S.td}>{sv.department_name || '—'}</td>
                <td style={S.td}>{sv.max_candidates}</td>
                <td style={S.td}>{sv.current_vacancy}</td>
                <td style={S.td}>{sv.max_full_time}F / {sv.max_part_time}P</td>
                <td style={S.td}><span style={S.badge(sv.status)}>{sv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
