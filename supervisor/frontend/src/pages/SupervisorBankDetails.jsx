import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { INDIAN_BANKS } from '../constants/banks';

const API = (import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002') + '/api';

const S = {
  container: { maxWidth: 800, margin: '0 auto', animation: 'fadeIn 0.4s ease-out' },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748b' },
  section: { background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05), 0 2px 8px -1px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', marginBottom: 24, position: 'relative' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 24, paddingBottom: 12, borderBottom: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, letterSpacing: '0.01em' },
  input: { width: '100%', padding: '12px 16px', border: '1.5px solid #cbd5e1', borderRadius: 10, fontSize: 15, background: '#fff', outline: 'none', transition: 'all 0.2s', color: '#1e293b' },
  inputGroup: { position: 'relative' },
  group: { marginBottom: 22 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  btn: { padding: '12px 32px', background: 'linear-gradient(135deg,#4338ca,#312e81)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(67,56,202,0.25)', display: 'inline-flex', alignItems: 'center', gap: 8 },
  btnDisabled: { background: '#cbd5e1', color: '#94a3b8', cursor: 'not-allowed', boxShadow: 'none' },
  success: { background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#15803d', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 },
  errText: { color: '#dc2626', fontSize: 12, marginTop: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 },
  maskBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 },
  dropdownContainer: { position: 'relative' },
  dropdownMenu: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 10, marginTop: 6, maxHeight: 220, overflowY: 'auto', zIndex: 10, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)', listStyle: 'none', padding: 0 },
  dropdownItem: { padding: '10px 16px', fontSize: 14, cursor: 'pointer', color: '#334155', transition: 'background 0.15s' },
  noResult: { padding: '12px 16px', fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  badge: { fontSize: 11, fontWeight: 600, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 99, verticalAlign: 'middle', marginLeft: 8 },
  ifscLoader: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 },
  successIndicator: { display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', marginLeft: 6 },
  errIndicator: { display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', marginLeft: 6 },
};

export default function SupervisorBankDetails() {
  const [form, setForm] = useState({
    bank_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ifscResolving, setIfscResolving] = useState(false);
  const [isMasked, setIsMasked] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState({});
  const [ifscInfo, setIfscInfo] = useState(null);

  // Custom Searchable Dropdown state
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLockedByIFSC, setIsLockedByIFSC] = useState(false);
  const dropdownRef = useRef(null);

  // Load existing bank details on mount
  useEffect(() => {
    fetchBankDetails();
  }, []);

  // Handle click outside to close autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch saved bank details
  async function fetchBankDetails() {
    try {
      const { data } = await axios.get(`${API}/supervisor/bank-details`);
      if (data.success && data.data) {
        const fetched = data.data;
        setForm({
          bank_holder_name: fetched.bank_holder_name || '',
          bank_name: fetched.bank_name || '',
          account_number: fetched.account_number || '',
          ifsc_code: fetched.ifsc_code || ''
        });
        setSearch(fetched.bank_name || '');
        if (fetched.ifsc_code && fetched.bank_name) {
          // If loaded with a valid IFSC, check if IFSC matches format
          const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
          if (ifscRegex.test(fetched.ifsc_code)) {
            setIsLockedByIFSC(true);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load bank details.');
    } finally {
      setLoading(false);
    }
  }

  // Triggered when IFSC Code is changed
  async function handleIFSCChange(e) {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
    setForm(prev => ({ ...prev, ifsc_code: value }));
    
    // Clear validation error on type
    setErrors(prev => ({ ...prev, ifsc_code: '' }));
    setIfscInfo(null);

    // Validate format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (value.length === 11) {
      if (!ifscRegex.test(value)) {
        setErrors(prev => ({ ...prev, ifsc_code: 'Invalid IFSC format. Fifth digit must be 0.' }));
        return;
      }

      // Format is valid, start lookup
      setIfscResolving(true);
      try {
        const { data } = await axios.get(`${API}/ifsc/${value}`);
        if (data.success && data.data) {
          const resolved = data.data;
          setForm(prev => ({ ...prev, bank_name: resolved.bank_name }));
          setSearch(resolved.bank_name);
          setIsLockedByIFSC(true);
          setIfscInfo(resolved);
          toast.success(`Bank identified: ${resolved.bank_name}`);
        }
      } catch (err) {
        console.error(err);
        setErrors(prev => ({ ...prev, ifsc_code: err.response?.data?.message || 'IFSC lookup failed. Please enter details manually.' }));
        setIsLockedByIFSC(false);
      } finally {
        setIfscResolving(false);
      }
    } else {
      // If characters are less than 11, unlock selection
      setIsLockedByIFSC(false);
    }
  }

  // Filter bank master list based on search text
  const filteredBanks = INDIAN_BANKS.filter(b => 
    b.toLowerCase().includes(search.toLowerCase())
  );

  // Field validator
  function validateForm() {
    const newErrors = {};

    // Validate Holder Name
    if (!form.bank_holder_name) {
      newErrors.bank_holder_name = 'Bank Holder Name is required';
    } else if (!/^[A-Z\s]{3,}$/.test(form.bank_holder_name)) {
      newErrors.bank_holder_name = 'Name must be at least 3 uppercase characters and spaces only';
    }

    // Validate Bank Name
    if (!form.bank_name) {
      newErrors.bank_name = 'Please select a bank name from the list';
    } else if (!INDIAN_BANKS.includes(form.bank_name)) {
      newErrors.bank_name = 'Please select a valid bank from the suggestions dropdown';
    }

    // Validate Account Number
    if (!form.account_number) {
      newErrors.account_number = 'Account Number is required';
    } else if (!/^\d{9,18}$/.test(form.account_number)) {
      newErrors.account_number = 'Account Number must contain between 9 and 18 digits';
    }

    // Validate IFSC
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!form.ifsc_code) {
      newErrors.ifsc_code = 'IFSC Code is required';
    } else if (!ifscRegex.test(form.ifsc_code)) {
      newErrors.ifsc_code = 'Invalid IFSC format. Must be 11 characters (e.g. SBIN0000456)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Save changes
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please correct the errors in the form.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/supervisor/bank-details`, form);
      if (data.success) {
        toast.success(data.message || 'Bank details saved successfully!');
        setErrors({});
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save bank details.');
    } finally {
      setSaving(false);
    }
  }

  // Masking representation
  function getMaskedAccountNumber() {
    if (!form.account_number) return '';
    if (!isMasked) return form.account_number;
    const len = form.account_number.length;
    if (len <= 4) return 'X'.repeat(len);
    return 'X'.repeat(len - 4) + form.account_number.slice(-4);
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#4338ca', fontWeight: 600 }}>
        <div style={{ animation: 'spin 1s linear infinite', border: '3px solid #e2e8f0', borderTop: '3px solid #4338ca', width: 24, height: 24, borderRadius: '50%', margin: '0 auto 12px' }} />
        Loading Bank Details...
      </div>
    );
  }

  return (
    <div style={S.container}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .form-input:focus {
          border-color: #4338ca !important;
          box-shadow: 0 0 0 4px rgba(67,56,202,0.1) !important;
          background: #fff !important;
        }
        .form-input.valid {
          border-color: #22c55e !important;
        }
        .form-input.invalid {
          border-color: #ef4444 !important;
        }
        .dropdown-item:hover {
          background: #f1f5f9 !important;
        }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Bank Account Details</h1>
        <p style={S.subtitle}>Configure supervisor disbursement account settings and remittance profiles.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span>🏦 Account Remittance Profile</span>
            <span style={S.badge}>Secure Vault</span>
          </div>

          {/* Bank Holder Name */}
          <div style={S.group}>
            <label style={S.label}>
              BANK HOLDER NAME 
              {form.bank_holder_name && !errors.bank_holder_name && <span style={S.successIndicator} />}
              {errors.bank_holder_name && <span style={S.errIndicator} />}
            </label>
            <input
              type="text"
              className={`form-input ${form.bank_holder_name ? (errors.bank_holder_name ? 'invalid' : 'valid') : ''}`}
              style={S.input}
              placeholder="ENTER EXACT NAME AS APPEARS IN BANK PASSBOOK"
              value={form.bank_holder_name}
              onChange={e => {
                const upperVal = e.target.value.toUpperCase().replace(/[^A-Z\s]/g, '');
                setForm(prev => ({ ...prev, bank_holder_name: upperVal }));
                if (errors.bank_holder_name) setErrors(prev => ({ ...prev, bank_holder_name: '' }));
              }}
              required
            />
            {errors.bank_holder_name && (
              <div style={S.errText}>
                <span>⚠️</span> {errors.bank_holder_name}
              </div>
            )}
          </div>

          <div style={S.row}>
            {/* IFSC Code */}
            <div style={S.group}>
              <label style={S.label}>
                IFSC CODE 
                {form.ifsc_code && !errors.ifsc_code && <span style={S.successIndicator} />}
                {errors.ifsc_code && <span style={S.errIndicator} />}
              </label>
              <div style={S.inputGroup}>
                <input
                  type="text"
                  className={`form-input ${form.ifsc_code ? (errors.ifsc_code ? 'invalid' : 'valid') : ''}`}
                  style={{ ...S.input, paddingRight: 40 }}
                  placeholder="e.g. SBIN0000456"
                  value={form.ifsc_code}
                  onChange={handleIFSCChange}
                  required
                />
                {ifscResolving && (
                  <div style={S.ifscLoader}>
                    <div style={{ animation: 'spin 0.8s linear infinite', border: '2px solid #cbd5e1', borderTop: '2px solid #4338ca', width: 16, height: 16, borderRadius: '50%' }} />
                  </div>
                )}
              </div>
              {errors.ifsc_code && (
                <div style={S.errText}>
                  <span>⚠️</span> {errors.ifsc_code}
                </div>
              )}
              {ifscInfo && (
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>
                  ✓ {ifscInfo.branch} Branch ({ifscInfo.city}, {ifscInfo.state})
                </div>
              )}
            </div>

            {/* Bank Name Searchable Dropdown */}
            <div style={S.group}>
              <label style={S.label}>
                BANK NAME
                {form.bank_name && !errors.bank_name && <span style={S.successIndicator} />}
                {errors.bank_name && <span style={S.errIndicator} />}
              </label>
              <div style={S.dropdownContainer} ref={dropdownRef}>
                <input
                  type="text"
                  className={`form-input ${form.bank_name ? (errors.bank_name ? 'invalid' : 'valid') : ''}`}
                  style={{ 
                    ...S.input, 
                    background: isLockedByIFSC ? '#f1f5f9' : '#fff',
                    color: isLockedByIFSC ? '#64748b' : '#1e293b',
                    cursor: isLockedByIFSC ? 'not-allowed' : 'text'
                  }}
                  placeholder="SEARCH OR SELECT BANK NAME"
                  value={search}
                  disabled={isLockedByIFSC}
                  onChange={e => {
                    const upperVal = e.target.value.toUpperCase();
                    setSearch(upperVal);
                    setForm(prev => ({ ...prev, bank_name: '' })); // Reset selected until clicked
                    setShowDropdown(true);
                    if (errors.bank_name) setErrors(prev => ({ ...prev, bank_name: '' }));
                  }}
                  onFocus={() => {
                    if (!isLockedByIFSC) setShowDropdown(true);
                  }}
                />
                
                {isLockedByIFSC && (
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#0369a1', fontWeight: 700 }}>
                    AUTO-LOCKED
                  </div>
                )}

                {showDropdown && !isLockedByIFSC && (
                  <ul style={S.dropdownMenu}>
                    {filteredBanks.length > 0 ? (
                      filteredBanks.map(b => (
                        <li 
                          key={b} 
                          className="dropdown-item" 
                          style={S.dropdownItem}
                          onClick={() => {
                            setForm(prev => ({ ...prev, bank_name: b }));
                            setSearch(b);
                            setShowDropdown(false);
                          }}
                        >
                          {b}
                        </li>
                      ))
                    ) : (
                      <li style={S.noResult}>No matching bank found</li>
                    )}
                  </ul>
                )}
              </div>
              {errors.bank_name && (
                <div style={S.errText}>
                  <span>⚠️</span> {errors.bank_name}
                </div>
              )}
            </div>
          </div>

          {/* Account Number */}
          <div style={S.group}>
            <label style={S.label}>
              ACCOUNT NUMBER 
              {form.account_number && !errors.account_number && <span style={S.successIndicator} />}
              {errors.account_number && <span style={S.errIndicator} />}
            </label>
            <div style={S.inputGroup}>
              <input
                type={isMasked ? "text" : "text"} // Render standard text, but swap values for masking representation
                className={`form-input ${form.account_number ? (errors.account_number ? 'invalid' : 'valid') : ''}`}
                style={{ ...S.input, paddingRight: 50, fontFamily: isMasked ? 'monospace' : 'inherit', letterSpacing: isMasked ? '0.15em' : 'normal' }}
                placeholder="ENTER 9 TO 18 DIGIT ACCOUNT NUMBER"
                value={isMasked ? getMaskedAccountNumber() : form.account_number}
                onChange={e => {
                  let rawVal = e.target.value;
                  // If currently masked, don't allow typing straight inside masked view to avoid corrupting data.
                  // Instead, toggle masking off or let them backspace to clear completely
                  if (isMasked) {
                    setIsMasked(false);
                    rawVal = '';
                  }
                  
                  const cleanVal = rawVal.replace(/[^\d]/g, '').slice(0, 18);
                  setForm(prev => ({ ...prev, account_number: cleanVal }));
                  if (errors.account_number) setErrors(prev => ({ ...prev, account_number: '' }));
                }}
                onFocus={() => {
                  // Reveal account number automatically when editing/focusing to make typing easy
                  if (isMasked) setIsMasked(false);
                }}
                onBlur={() => {
                  // Auto-mask on blur
                  setIsMasked(true);
                }}
                required
              />
              {form.account_number && (
                <button
                  type="button"
                  style={S.maskBtn}
                  onClick={() => setIsMasked(prev => !prev)}
                  onMouseDown={e => e.preventDefault()} // Prevents blur trigger
                  title={isMasked ? "Show account number" : "Hide account number"}
                >
                  {isMasked ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
            {errors.account_number && (
              <div style={S.errText}>
                <span>⚠️</span> {errors.account_number}
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div style={{ textAlign: 'right' }}>
          <button 
            type="submit" 
            style={saving ? { ...S.btn, ...S.btnDisabled } : S.btn}
            disabled={saving}
          >
            {saving ? (
              <>
                <div style={{ animation: 'spin 0.8s linear infinite', border: '2.5px solid rgba(255,255,255,0.2)', borderTop: '2.5px solid #fff', width: 14, height: 14, borderRadius: '50%' }} />
                Saving Account Details...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Bank Details
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
