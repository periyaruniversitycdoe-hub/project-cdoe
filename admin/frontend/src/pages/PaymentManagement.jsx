import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CreditCard, RefreshCw, Download, FileDown,
  MoreVertical, Eye, Edit3, Clock, Shield,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  X, Zap, AlertCircle, CheckCircle,
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

// ── Status badge config ────────────────────────────────────────────────────────
const STATUS_BADGE = {
  PENDING:                      { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  INITIATED:                    { bg: '#dbeafe', color: '#1e40af', label: 'Initiated' },
  PROCESSING:                   { bg: '#dbeafe', color: '#1e40af', label: 'Processing' },
  AWAITING_CONFIRMATION:        { bg: '#fef3c7', color: '#92400e', label: 'Awaiting Confirmation' },
  SUCCESS:                      { bg: '#d1fae5', color: '#065f46', label: 'Success / Paid' },
  FAILED:                       { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
  CANCELLED:                    { bg: '#f3f4f6', color: '#374151', label: 'Cancelled' },
  REFUNDED:                     { bg: '#dbeafe', color: '#1e40af', label: 'Refunded' },
  EXPIRED:                      { bg: '#f3f4f6', color: '#374151', label: 'Expired' },
  MANUAL_VERIFICATION_REQUIRED: { bg: '#ffedd5', color: '#9a3412', label: 'Manual Verification' },
  PARTIALLY_PAID:               { bg: '#ccfbf1', color: '#115e59', label: 'Partially Paid' },
};

const SOURCE_BADGE = {
  GATEWAY: { bg: '#dbeafe', color: '#1e40af', label: 'Gateway' },
  MANUAL:  { bg: '#f3e8ff', color: '#6b21a8', label: 'Manual' },
};

const STATUS_OPTIONS = Object.keys(STATUS_BADGE);

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { bg: '#f3f4f6', color: '#374151', label: status || '—' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}

function SourceBadge({ source }) {
  const cfg = SOURCE_BADGE[source] || { bg: '#f3f4f6', color: '#374151', label: source || '—' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}

function ModalBackdrop({ onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 1060, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function ModalCard({ title, onClose, maxWidth = 560, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, width: '100%', maxWidth,
      maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0,
        background: '#fff', borderRadius: '12px 12px 0 0', zIndex: 1,
      }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>{title}</h3>
        <button onClick={onClose} style={{
          border: 'none', background: '#f3f4f6', borderRadius: 6, padding: '4px 8px',
          cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center',
        }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Spinner({ size = 18 }) {
  return (
    <div style={{
      width: size, height: size, border: `2px solid #e5e7eb`,
      borderTopColor: '#3b82f6', borderRadius: '50%',
      animation: 'pmSpin 0.7s linear infinite', display: 'inline-block',
    }} />
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
      <span style={{ color: '#6b7280', minWidth: 160, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#111', fontWeight: 500, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  );
}

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PaymentManagement() {
  const token   = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  // ── Data state ───────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [totalCount, setTotalCount]     = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [page, setPage]                 = useState(1);
  const [limit, setLimit]               = useState(30);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus]       = useState('');
  const [filterMethod, setFilterMethod]       = useState('');
  const [filterSource, setFilterSource]       = useState('');
  const [filterDateFrom, setFilterDateFrom]   = useState('');
  const [filterDateTo, setFilterDateTo]       = useState('');
  const [filterCourse, setFilterCourse]       = useState('');
  const [filterAppNumber, setFilterAppNumber] = useState('');
  const [filterTxnId, setFilterTxnId]         = useState('');

  // ── Export state ─────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(null);

  // ── Actions dropdown ──────────────────────────────────────────────────────────
  const [openActionRow, setOpenActionRow] = useState(null);
  const actionDropdownRef = useRef(null);

  // ── Update Status modal ───────────────────────────────────────────────────────
  const [statusModal, setStatusModal]           = useState(false);
  const [statusModalTxn, setStatusModalTxn]     = useState(null);
  const [statusForm, setStatusForm]             = useState({ newStatus: '', reason: '', remarks: '' });
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // ── View Details modal ────────────────────────────────────────────────────────
  const [detailsModal, setDetailsModal]     = useState(false);
  const [detailsData, setDetailsData]       = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // ── Payment History modal ─────────────────────────────────────────────────────
  const [historyModal, setHistoryModal]       = useState(false);
  const [historyOrderId, setHistoryOrderId]   = useState(null);
  const [historyData, setHistoryData]         = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  // ── Audit Trail modal ─────────────────────────────────────────────────────────
  const [auditModal, setAuditModal]     = useState(false);
  const [auditOrderId, setAuditOrderId] = useState(null);
  const [auditData, setAuditData]       = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Build filter params ──────────────────────────────────────────────────────
  const buildFilterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (filterStatus)     p.append('status', filterStatus);
    if (filterMethod)     p.append('method', filterMethod);
    if (filterSource)     p.append('source', filterSource);
    if (filterDateFrom)   p.append('date_from', filterDateFrom);
    if (filterDateTo)     p.append('date_to', filterDateTo);
    if (filterCourse)     p.append('course', filterCourse);
    if (filterAppNumber)  p.append('application_number', filterAppNumber);
    if (filterTxnId)      p.append('transaction_id', filterTxnId);
    return p;
  }, [filterStatus, filterMethod, filterSource, filterDateFrom, filterDateTo,
      filterCourse, filterAppNumber, filterTxnId]);

  // ── Fetch transactions ────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = buildFilterParams();
      params.append('page', targetPage);
      params.append('limit', limit);
      const res = await axios.get(
        `${API_URL}/payment-management/transactions?${params}`,
        { headers }
      );
      setTransactions(res.data.data || []);
      setTotalCount(res.data.total || 0);
      setTotalPages(Math.ceil((res.data.total || 0) / limit) || 1);
    } catch {
      toast.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildFilterParams, limit]);

  // Reset page when filters change
  useEffect(() => { setPage(1); },
    [filterStatus, filterMethod, filterSource, filterDateFrom, filterDateTo,
     filterCourse, filterAppNumber, filterTxnId, limit]);

  // Debounced fetch
  useEffect(() => {
    const t = setTimeout(() => fetchTransactions(page), 350);
    return () => clearTimeout(t);
  }, [fetchTransactions, page]);

  // Close action dropdown on outside click
  useEffect(() => {
    if (!openActionRow) return;
    const handler = (e) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target)) {
        setOpenActionRow(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openActionRow]);

  // ── Update Status ────────────────────────────────────────────────────────────
  const openStatusModal = (txn) => {
    setStatusModalTxn(txn);
    setStatusForm({ newStatus: txn.payment_status || '', reason: '', remarks: '' });
    setStatusModal(true);
    setOpenActionRow(null);
  };

  const submitStatusUpdate = async (e) => {
    e.preventDefault();
    if (!statusForm.newStatus) { toast.error('Please select a new status'); return; }
    if (!statusForm.reason.trim() || statusForm.reason.trim().length < 3) {
      toast.error('Reason must be at least 3 characters'); return;
    }
    setStatusSubmitting(true);
    try {
      await axios.put(
        `${API_URL}/payment-management/transactions/${statusModalTxn.order_id}/status`,
        statusForm,
        { headers }
      );
      toast.success('Payment status updated successfully');
      setStatusModal(false);
      fetchTransactions(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // ── View Details ──────────────────────────────────────────────────────────────
  const openDetailsModal = async (txn) => {
    setOpenActionRow(null);
    setDetailsModal(true);
    setDetailsLoading(true);
    setDetailsData(null);
    try {
      const res = await axios.get(
        `${API_URL}/payment-management/transactions/${txn.order_id}`,
        { headers }
      );
      setDetailsData(res.data.data);
    } catch {
      toast.error('Failed to load transaction details');
      setDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  // ── Payment History ───────────────────────────────────────────────────────────
  const openHistoryModal = async (orderId) => {
    setOpenActionRow(null);
    setHistoryOrderId(orderId);
    setHistoryData([]);
    setHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/payment-management/transactions/${orderId}/history`,
        { headers }
      );
      setHistoryData(res.data.data || []);
    } catch {
      toast.error('Failed to load payment history');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Audit Trail ───────────────────────────────────────────────────────────────
  const openAuditModal = async (orderId) => {
    setOpenActionRow(null);
    setAuditOrderId(orderId);
    setAuditData([]);
    setAuditModal(true);
    setAuditLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/payment-management/audit-logs/${orderId}`,
        { headers }
      );
      setAuditData(res.data.data || []);
    } catch {
      toast.error('Failed to load audit trail');
    } finally {
      setAuditLoading(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport = async (format) => {
    setExporting(format);
    try {
      const params = buildFilterParams();
      params.append('format', format);
      const res = await axios.get(
        `${API_URL}/payment-management/export?${params}`,
        { headers, responseType: 'blob' }
      );
      const ext  = format === 'csv' ? 'csv' : 'xlsx';
      const mime = format === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `payment_export_${Date.now()}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Export downloaded (${format.toUpperCase()})`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  // ── Download Receipt ─────────────────────────────────────────────────────────
  const [downloadingReceipt, setDownloadingReceipt] = useState(null);

  const handleDownloadReceipt = async (orderId, receiptNumber) => {
    setDownloadingReceipt(orderId);
    try {
      const res = await axios.get(
        `${API_URL}/payment-management/receipt/${orderId}`,
        { headers, responseType: 'blob' }
      );
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Payment_Receipt_${receiptNumber || orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Receipt downloaded successfully');
    } catch (err) {
      toast.error('Failed to download receipt PDF');
    } finally {
      setDownloadingReceipt(null);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const clearFilters = () => {
    setFilterStatus(''); setFilterMethod(''); setFilterSource('');
    setFilterDateFrom(''); setFilterDateTo('');
    setFilterCourse(''); setFilterAppNumber(''); setFilterTxnId('');
  };

  const activeFilterCount = [
    filterStatus, filterMethod, filterSource, filterDateFrom,
    filterDateTo, filterCourse, filterAppNumber, filterTxnId,
  ].filter(Boolean).length;

  const inputStyle = {
    border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
    background: '#fff',
  };

  const timelineIcon = (sourceType) => {
    if (sourceType === 'audit')   return <Shield size={14} color="#3b82f6" />;
    if (sourceType === 'attempt') return <RefreshCw size={14} color="#f59e0b" />;
    if (sourceType === 'webhook') return <Zap size={14} color="#10b981" />;
    return <Clock size={14} color="#6b7280" />;
  };

  const timelineColor = (sourceType) => {
    if (sourceType === 'audit')   return '#eff6ff';
    if (sourceType === 'attempt') return '#fffbeb';
    if (sourceType === 'webhook') return '#f0fdf4';
    return '#f9fafb';
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, fontFamily: 'inherit' }}>
      <style>{`@keyframes pmSpin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={22} color="#2563eb" /> Payment Management
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            {totalCount} record{totalCount !== 1 ? 's' : ''}
            {activeFilterCount > 0 && (
              <span style={{ marginLeft: 8, color: '#2563eb' }}>
                ({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchTransactions(page)}
            style={{ border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={!!exporting}
            style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: exporting === 'xlsx' ? 0.7 : 1 }}
          >
            {exporting === 'xlsx' ? <Spinner size={14} /> : <FileDown size={14} />} Excel
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={!!exporting}
            style={{ background: '#0891b2', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: exporting === 'csv' ? 0.7 : 1 }}
          >
            {exporting === 'csv' ? <Spinner size={14} /> : <Download size={14} />} CSV
          </button>
        </div>
      </div>

      {/* ── Filter card ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={inputStyle}>
            <option value="">All Methods</option>
            <option value="card">Card</option>
            <option value="upi_qr">UPI QR</option>
            <option value="upi_intent">UPI Intent</option>
            <option value="upi_id">UPI ID</option>
            <option value="netbanking">Net Banking</option>
            <option value="wallet">Wallet</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={inputStyle}>
            <option value="">All Sources</option>
            <option value="GATEWAY">Gateway</option>
            <option value="MANUAL">Manual</option>
          </select>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={inputStyle} title="From date" />
          <input type="date" value={filterDateTo}   onChange={e => setFilterDateTo(e.target.value)}   style={inputStyle} title="To date" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <input placeholder="Course / Subject"    value={filterCourse}     onChange={e => setFilterCourse(e.target.value)}     style={inputStyle} />
          <input placeholder="Application Number"  value={filterAppNumber}  onChange={e => setFilterAppNumber(e.target.value)}  style={inputStyle} />
          <input placeholder="Transaction ID"      value={filterTxnId}      onChange={e => setFilterTxnId(e.target.value)}      style={inputStyle} />
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={inputStyle}>
            {[10, 20, 30, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table card ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['#', 'Application ID', 'Applicant', 'Transaction ID', 'Amount', 'Method', 'Source', 'Status', 'Last Updated', 'Receipt', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Spinner size={28} />
                      <span style={{ color: '#6b7280', fontSize: 13 }}>Loading transactions…</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    No payment records found.
                  </td>
                </tr>
              ) : transactions.map((txn, idx) => (
                <tr
                  key={txn.order_id}
                  style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                >
                  <td style={{ padding: '10px 12px', color: '#9ca3af', fontWeight: 500 }}>
                    {(page - 1) * limit + idx + 1}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
                    {txn.application_id || <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#111' }}>{txn.applicant_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{txn.email || ''}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {txn.gateway_transaction_id || <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>
                    ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151', textTransform: 'capitalize' }}>
                    {(txn.payment_method || '—').replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <SourceBadge source={txn.payment_source || 'GATEWAY'} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={txn.payment_status} />
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmt(txn.updated_at || txn.created_at)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {txn.receipt_number || txn.payment_status === 'SUCCESS' ? (
                      <button
                        onClick={() => handleDownloadReceipt(txn.order_id, txn.receipt_number || txn.order_id)}
                        disabled={downloadingReceipt === txn.order_id}
                        style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: downloadingReceipt === txn.order_id ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease-in-out',
                          opacity: downloadingReceipt === txn.order_id ? 0.7 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (downloadingReceipt !== txn.order_id) {
                            e.currentTarget.style.background = '#dbeafe';
                            e.currentTarget.style.borderColor = '#93c5fd';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (downloadingReceipt !== txn.order_id) {
                            e.currentTarget.style.background = '#eff6ff';
                            e.currentTarget.style.borderColor = '#bfdbfe';
                          }
                        }}
                      >
                        {downloadingReceipt === txn.order_id ? <Spinner size={12} /> : <FileDown size={14} />}
                        e-Receipt
                      </button>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenActionRow(openActionRow === txn.order_id ? null : txn.order_id);
                      }}
                      style={{ border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <MoreVertical size={15} color="#374151" />
                    </button>

                    {openActionRow === txn.order_id && (
                      <div
                        ref={actionDropdownRef}
                        style={{
                          position: 'absolute', right: 8, top: '110%', zIndex: 200,
                          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 210, overflow: 'hidden',
                        }}
                      >
                        {[
                          { icon: <Eye size={14} />,    label: 'View Details',          fn: () => openDetailsModal(txn) },
                          { icon: <Edit3 size={14} />,  label: 'Update Payment Status', fn: () => openStatusModal(txn) },
                          { icon: <Clock size={14} />,  label: 'View Payment History',  fn: () => openHistoryModal(txn.order_id) },
                          { icon: <Shield size={14} />, label: 'View Audit Trail',       fn: () => openAuditModal(txn.order_id) },
                        ].map(item => (
                          <button
                            key={item.label}
                            onClick={(e) => { e.stopPropagation(); item.fn(); }}
                            style={{ width: '100%', border: 'none', background: 'none', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#374151' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            {item.icon} {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              Page {page} of {totalPages} &nbsp;·&nbsp; {totalCount} total records
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { icon: <ChevronsLeft size={14} />,  fn: () => setPage(1),                                  disabled: page === 1 },
                { icon: <ChevronLeft size={14} />,   fn: () => setPage(p => Math.max(1, p - 1)),            disabled: page === 1 },
                { icon: <ChevronRight size={14} />,  fn: () => setPage(p => Math.min(totalPages, p + 1)),   disabled: page === totalPages },
                { icon: <ChevronsRight size={14} />, fn: () => setPage(totalPages),                         disabled: page === totalPages },
              ].map((btn, i) => (
                <button
                  key={i} onClick={btn.fn} disabled={btn.disabled}
                  style={{ border: '1px solid #e5e7eb', background: btn.disabled ? '#f9fafb' : '#fff', borderRadius: 6, padding: '5px 9px', cursor: btn.disabled ? 'not-allowed' : 'pointer', color: btn.disabled ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center' }}
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MODAL 1 — Update Payment Status
      ════════════════════════════════════════════════════════════════ */}
      {statusModal && (
        <ModalBackdrop onClose={() => setStatusModal(false)}>
          <ModalCard title="Update Payment Status" onClose={() => setStatusModal(false)} maxWidth={500}>
            {statusModalTxn && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <div style={{ color: '#6b7280' }}>
                  Order: <strong style={{ color: '#111', fontFamily: 'monospace' }}>{statusModalTxn.order_id}</strong>
                </div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#6b7280' }}>Current:</span>
                  <StatusBadge status={statusModalTxn.payment_status} />
                </div>
              </div>
            )}
            <form onSubmit={submitStatusUpdate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  New Payment Status <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={statusForm.newStatus}
                  onChange={e => setStatusForm(f => ({ ...f, newStatus: e.target.value }))}
                  required
                  style={inputStyle}
                >
                  <option value="">— Select new status —</option>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{STATUS_BADGE[s]?.label || s}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Reason <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Why is this status being changed? (min 3 chars)"
                  value={statusForm.reason}
                  onChange={e => setStatusForm(f => ({ ...f, reason: e.target.value }))}
                  required
                  minLength={3}
                  maxLength={500}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Remarks <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  placeholder="Additional notes, reference numbers, etc."
                  value={statusForm.remarks}
                  onChange={e => setStatusForm(f => ({ ...f, remarks: e.target.value }))}
                  maxLength={1000}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setStatusModal(false)}
                  style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: '#374151' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: statusSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: statusSubmitting ? 0.7 : 1 }}
                >
                  {statusSubmitting ? <><Spinner size={14} /> Updating…</> : <><CheckCircle size={14} /> Update Status</>}
                </button>
              </div>
            </form>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 2 — View Details
      ════════════════════════════════════════════════════════════════ */}
      {detailsModal && (
        <ModalBackdrop onClose={() => setDetailsModal(false)}>
          <ModalCard title="Transaction Details" onClose={() => setDetailsModal(false)} maxWidth={620}>
            {detailsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={28} /></div>
            ) : detailsData ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Status</div>
                    <StatusBadge status={detailsData.payment_status} />
                  </div>
                  <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Source</div>
                    <SourceBadge source={detailsData.payment_source || 'GATEWAY'} />
                  </div>
                </div>
                <DetailRow label="Order ID"         value={detailsData.order_id} />
                <DetailRow label="Application ID"   value={detailsData.application_id} />
                <DetailRow label="Applicant"        value={`${detailsData.applicant_name || ''} ${detailsData.applicant_initial || ''}`.trim()} />
                <DetailRow label="Email"            value={detailsData.email} />
                <DetailRow label="Mobile"           value={detailsData.mobile} />
                <DetailRow label="Amount"           value={detailsData.amount ? `₹${Number(detailsData.amount).toLocaleString('en-IN')}` : '—'} />
                <DetailRow label="Payment Method"   value={(detailsData.payment_method || '').replace(/_/g, ' ')} />
                <DetailRow label="Provider"         value={detailsData.provider_name} />
                <DetailRow label="Gateway Txn ID"   value={detailsData.gateway_transaction_id} />
                <DetailRow label="Receipt Number"   value={detailsData.receipt_number} />
                <DetailRow label="Failure Reason"   value={detailsData.failure_reason} />
                <DetailRow label="Initiated At"     value={fmt(detailsData.initiated_at)} />
                <DetailRow label="Completed At"     value={fmt(detailsData.completed_at)} />
                <DetailRow label="Verified At"      value={fmt(detailsData.verified_at)} />
                <DetailRow label="Created At"       value={fmt(detailsData.created_at)} />
                <DetailRow label="Last Updated"     value={fmt(detailsData.updated_at)} />
                <DetailRow label="Reconciliation"   value={detailsData.reconciliation_status} />
                <DetailRow label="App Status"       value={detailsData.app_status} />
              </>
            ) : (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No data available.</p>
            )}
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 3 — Payment History
      ════════════════════════════════════════════════════════════════ */}
      {historyModal && (
        <ModalBackdrop onClose={() => setHistoryModal(false)}>
          <ModalCard title="Payment History" onClose={() => setHistoryModal(false)} maxWidth={680}>
            {historyOrderId && (
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 0, marginBottom: 16, fontFamily: 'monospace' }}>
                Order: {historyOrderId}
              </p>
            )}
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={28} /></div>
            ) : historyData.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No history found.</p>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />
                {historyData.map((evt, idx) => (
                  <div key={idx} style={{ marginBottom: 16, position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: -28, top: 6,
                      width: 22, height: 22, borderRadius: '50%',
                      background: timelineColor(evt.source_type),
                      border: '2px solid #e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {timelineIcon(evt.source_type)}
                    </div>
                    <div style={{ background: timelineColor(evt.source_type), border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
                          {String(evt.action || '').replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{fmt(evt.event_time)}</span>
                      </div>
                      {evt.source_type === 'audit' && (
                        <div style={{ fontSize: 12, marginTop: 6 }}>
                          {evt.old_status && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <StatusBadge status={evt.old_status} />
                              <span style={{ color: '#9ca3af', margin: '0 4px' }}>→</span>
                              <StatusBadge status={evt.new_status} />
                            </span>
                          )}
                          {evt.actor && <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 11 }}>by {evt.actor}</span>}
                          {evt.details && (() => {
                            try {
                              const d = typeof evt.details === 'string' ? JSON.parse(evt.details) : evt.details;
                              return d?.reason ? <div style={{ marginTop: 4, color: '#374151' }}>Reason: {d.reason}</div> : null;
                            } catch { return null; }
                          })()}
                        </div>
                      )}
                      {evt.source_type === 'attempt' && evt.error_message && (
                        <div style={{ fontSize: 12, color: '#991b1b', marginTop: 4 }}>{evt.error_message}</div>
                      )}
                      {evt.source_type === 'webhook' && (
                        <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
                          {evt.provider_name} · Verified: {evt.is_verified ? '✓' : '✗'} · Processed: {evt.is_processed ? '✓' : '✗'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 4 — Audit Trail
      ════════════════════════════════════════════════════════════════ */}
      {auditModal && (
        <ModalBackdrop onClose={() => setAuditModal(false)}>
          <ModalCard title="Audit Trail" onClose={() => setAuditModal(false)} maxWidth={860}>
            {auditOrderId && (
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 0, marginBottom: 16, fontFamily: 'monospace' }}>
                Order: {auditOrderId}
              </p>
            )}
            {auditLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spinner size={28} /></div>
            ) : auditData.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No audit records found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                      {['Time', 'Action', 'Actor', 'Status Change', 'IP', 'Reason / Remarks'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.map((log, idx) => {
                      let detailStr = '';
                      try {
                        const d = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
                        detailStr = [d?.reason, d?.remarks].filter(Boolean).join(' | ');
                      } catch { /* ignore */ }
                      return (
                        <tr key={log.id || idx} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#374151' }}>{fmt(log.created_at)}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: '#111' }}>{String(log.action || '').replace(/_/g, ' ')}</td>
                          <td style={{ padding: '9px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>{log.actor || '—'}</td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            {log.old_status ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <StatusBadge status={log.old_status} />
                                <span style={{ color: '#9ca3af' }}>→</span>
                                <StatusBadge status={log.new_status} />
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#6b7280', fontSize: 11 }}>{log.ip_address || '—'}</td>
                          <td style={{ padding: '9px 12px', color: '#374151', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={detailStr}>
                            {detailStr || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: 14, padding: '8px 12px', background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={13} /> Audit records are permanent and cannot be deleted or modified.
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}
    </div>
  );
}
