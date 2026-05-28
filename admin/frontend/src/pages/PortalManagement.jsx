import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  Plus, Edit2, Trash2, ShieldAlert, ArrowUp, ArrowDown, 
  ToggleLeft, ToggleRight, Loader2, Save, X, Image as ImageIcon,
  CheckCircle, Globe, HelpCircle
} from 'lucide-react';
import * as Icons from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/portals';
const token = () => localStorage.getItem('adminToken');
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

// Lucide Icon Options for Portal Cards
const ICON_OPTIONS = [
  'GraduationCap', 'Users', 'Building2', 'LayoutDashboard', 'FileText',
  'CreditCard', 'Ticket', 'UserCheck', 'BookOpen', 'BarChart3', 
  'Award', 'ShieldCheck', 'Globe', 'HelpCircle', 'Laptop', 'School'
];

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent {...props} />;
};

export default function PortalManagement() {
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    banner_image: '',
    icon: 'HelpCircle',
    login_route: '',
    button_label: 'Login',
    display_order: 0,
    is_active: 1,
    theme_color: '#008080'
  });

  useEffect(() => {
    fetchPortals();
  }, []);

  const fetchPortals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API, { headers: authHeader() });
      if (res.data.success) {
        setPortals(res.data.data || []);
      }
    } catch (err) {
      toast.error('Failed to load portals configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      banner_image: '',
      icon: 'HelpCircle',
      login_route: '',
      button_label: 'Login',
      display_order: portals.length + 1,
      is_active: 1,
      theme_color: '#008080'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (portal) => {
    setEditingId(portal.id);
    setFormData({
      name: portal.name,
      slug: portal.slug,
      description: portal.description || '',
      banner_image: portal.banner_image || '',
      icon: portal.icon || 'HelpCircle',
      login_route: portal.login_route,
      button_label: portal.button_label || 'Login',
      display_order: portal.display_order,
      is_active: portal.is_active,
      theme_color: portal.theme_color || '#008080'
    });
    setShowModal(true);
  };

  const handleStatusToggle = async (portal) => {
    const newStatus = portal.is_active ? 0 : 1;
    try {
      const res = await axios.patch(`${API}/${portal.id}/status`, { is_active: newStatus }, { headers: authHeader() });
      if (res.data.success) {
        toast.success(`Portal status toggled successfully.`);
        // Refresh local list state safely
        setPortals(prev => prev.map(p => p.id === portal.id ? { ...p, is_active: newStatus } : p));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update portal status.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);

    try {
      const res = await axios.post(`${API}/upload`, fd, {
        headers: {
          ...authHeader(),
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.success) {
        setFormData(prev => ({ ...prev, banner_image: res.data.path }));
        toast.success('Portal banner uploaded successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim() || !formData.login_route.trim()) {
      toast.error('Portal Name, Slug, and Login Route URL are required!');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Edit Mode
        const res = await axios.put(`${API}/${editingId}`, formData, { headers: authHeader() });
        if (res.data.success) {
          toast.success('Portal card modified successfully.');
          setShowModal(false);
          fetchPortals();
        }
      } else {
        // Add Mode
        const res = await axios.post(API, formData, { headers: authHeader() });
        if (res.data.success) {
          toast.success('New portal card registered.');
          setShowModal(false);
          fetchPortals();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred while saving portal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('CRITICAL WARNING: Are you sure you want to delete this portal card? Any users attempting to access this portal route via the public landing page will no longer be redirected.')) return;

    try {
      const res = await axios.delete(`${API}/${id}`, { headers: authHeader() });
      if (res.data.success) {
        toast.success('Portal card permanently deleted.');
        fetchPortals();
      }
    } catch (err) {
      toast.error('Failed to delete portal.');
    }
  };

  const handleMove = async (index, direction) => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= portals.length) return;

    const list = [...portals];
    // Swap display order values
    const tempOrder = list[index].display_order;
    list[index].display_order = list[targetIdx].display_order;
    list[targetIdx].display_order = tempOrder;

    // Swap elements in list
    const tempObj = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = tempObj;

    // Instantly update UI representation
    setPortals(list);

    // Call reorder backend API
    const payload = list.map(item => ({ id: item.id, display_order: item.display_order }));
    try {
      await axios.put(`${API}/reorder`, { orders: payload }, { headers: authHeader() });
      toast.success('Portal ordering updated.');
    } catch (err) {
      toast.error('Failed to save portal reordering.');
      fetchPortals(); // Rollback local changes
    }
  };

  const getImageUrl = (path) => {
    if (!path) return '—';
    if (path.startsWith('/uploads')) return `((import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '')${path}`;
    return path;
  };

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3 px-4 d-flex align-items-center justify-content-between border-bottom">
        <div>
          <h5 className="fw-bold mb-0 text-dark">Portal Landing Cards Registry</h5>
          <p className="text-muted small mb-0">Add, configure, toggle, reorder, or edit public portal options</p>
        </div>
        <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Portal Card
        </button>
      </div>

      <div className="card-body p-0">
        {loading && (
          <div className="p-5 text-center">
            <Loader2 className="animate-spin text-primary mx-auto mb-2" size={32} />
            <span className="text-muted small">Loading portals schema metadata...</span>
          </div>
        )}

        {!loading && (
          <div className="table-responsive">
            <table className="table table-hover table-striped mb-0 align-middle" style={{ fontSize: '13px' }}>
              <thead className="table-light text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                <tr>
                  <th className="py-3 px-4" style={{ width: '80px' }}>Order</th>
                  <th style={{ width: '220px' }}>Portal Details</th>
                  <th style={{ width: '260px' }}>Routes & Label</th>
                  <th>Visual Branding</th>
                  <th style={{ width: '100px' }}>Status</th>
                  <th className="text-center" style={{ width: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {portals.map((portal, idx) => (
                  <tr key={portal.id}>
                    <td className="py-3 px-4">
                      <div className="d-flex align-items-center gap-1">
                        <span className="badge bg-secondary me-1">{portal.display_order}</span>
                        <button 
                          className="btn btn-xs btn-outline-secondary p-0.5 d-flex"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button 
                          className="btn btn-xs btn-outline-secondary p-0.5 d-flex"
                          disabled={idx === portals.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div 
                          className="rounded-circle d-flex align-items-center justify-content-center border"
                          style={{
                            width: '36px',
                            height: '36px',
                            backgroundColor: '#f8fafc',
                            borderColor: portal.theme_color || '#008080'
                          }}
                        >
                          <DynamicIcon name={portal.icon} style={{ color: portal.theme_color || '#008080' }} size={16} />
                        </div>
                        <div>
                          <div className="fw-bold text-dark">{portal.name}</div>
                          <code className="text-muted small" style={{ fontSize: '10.5px' }}>slug: {portal.slug}</code>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        <div><strong>Route:</strong> <code>{portal.login_route}</code></div>
                        <div className="text-muted"><strong>Btn Label:</strong> {portal.button_label}</div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {portal.banner_image ? (
                          <img 
                            src={getImageUrl(portal.banner_image)} 
                            alt={portal.name} 
                            className="rounded border" 
                            style={{ width: '60px', height: '36px', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div className="rounded border text-muted small bg-light d-flex align-items-center justify-content-center" style={{ width: '60px', height: '36px' }}>
                            <ImageIcon size={14} />
                          </div>
                        )}
                        <span 
                          className="badge small text-white" 
                          style={{ backgroundColor: portal.theme_color || '#008080', fontSize: '10px' }}
                        >
                          {portal.theme_color || '#008080'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button 
                        className="btn btn-link p-0 border-0" 
                        onClick={() => handleStatusToggle(portal)}
                        title={portal.is_active ? 'Disable Portal' : 'Enable Portal'}
                      >
                        {portal.is_active ? (
                          <ToggleRight size={28} className="text-success" />
                        ) : (
                          <ToggleLeft size={28} className="text-muted" />
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="d-flex align-items-center justify-content-center gap-1">
                        <button 
                          className="btn btn-xs btn-outline-info d-flex align-items-center gap-0.5" 
                          onClick={() => handleOpenEdit(portal)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button 
                          className="btn btn-xs btn-outline-danger d-flex align-items-center gap-0.5"
                          onClick={() => handleDelete(portal.id)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {portals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">
                      <ShieldAlert size={28} className="mx-auto mb-2 opacity-50 text-warning" />
                      <div>No portal landing cards registered yet. Please click "Add Portal Card" to start seeding.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal Overlay ── */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header bg-light border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark">
                  {editingId ? '📝 Edit Portal Details' : '✨ Register New Portal'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4 text-start">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Portal Name</label>
                      <input 
                        type="text" 
                        required
                        className="form-control form-control-sm"
                        placeholder="e.g. Finance Portal"
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Portal Slug (Unique Identifier)</label>
                      <input 
                        type="text" 
                        required
                        className="form-control form-control-sm"
                        placeholder="e.g. finance-dept"
                        value={formData.slug}
                        onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold">Portal Description</label>
                      <textarea 
                        className="form-control form-control-sm"
                        rows="2"
                        placeholder="Describe what scholarship tools or operations this portal hosts..."
                        value={formData.description}
                        onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Redirect Login Route URL</label>
                      <input 
                        type="text" 
                        required
                        className="form-control form-control-sm"
                        placeholder="e.g. http://localhost:5178/login"
                        value={formData.login_route}
                        onChange={e => setFormData(p => ({ ...p, login_route: e.target.value }))}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Action Button Label</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        placeholder="e.g. Access Ledger"
                        value={formData.button_label}
                        onChange={e => setFormData(p => ({ ...p, button_label: e.target.value }))}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Display Order Position</label>
                      <input 
                        type="number" 
                        className="form-control form-control-sm"
                        value={formData.display_order}
                        onChange={e => setFormData(p => ({ ...p, display_order: parseInt(e.target.value) }))}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Theme Primary Color</label>
                      <div className="d-flex gap-2 align-items-center">
                        <input 
                          type="color" 
                          className="form-control form-control-sm p-1"
                          style={{ width: '45px', height: '34px', cursor: 'pointer' }}
                          value={formData.theme_color}
                          onChange={e => setFormData(p => ({ ...p, theme_color: e.target.value }))}
                        />
                        <input 
                          type="text" 
                          className="form-control form-control-sm font-monospace"
                          value={formData.theme_color}
                          onChange={e => setFormData(p => ({ ...p, theme_color: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold">Portal Icon Category</label>
                      <select 
                        className="form-select form-select-sm"
                        value={formData.icon}
                        onChange={e => setFormData(p => ({ ...p, icon: e.target.value }))}
                      >
                        {ICON_OPTIONS.map(ico => (
                          <option key={ico} value={ico}>{ico}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 border-top pt-3 mt-3">
                      <label className="form-label small fw-bold">Portal Banner Banner Image</label>
                      <div className="d-flex flex-column gap-2">
                        <div className="d-flex gap-3 align-items-center">
                          <input 
                            type="file" 
                            id="modalFile"
                            className="d-none" 
                            accept="image/*"
                            onChange={handleFileUpload} 
                          />
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                            onClick={() => document.getElementById('modalFile').click()}
                            disabled={uploading}
                          >
                            {uploading ? (
                              <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                            ) : (
                              <><ImageIcon size={14} /> Upload Custom Banner</>
                            )}
                          </button>
                          {formData.banner_image && (
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setFormData(p => ({ ...p, banner_image: '' }))}
                            >
                              Remove Image
                            </button>
                          )}
                        </div>
                        <div className="small text-muted">Upload high-definition banner (JPG, PNG, WEBP, or SVG). Max size 5 MB. Will copy symmetrically for dual dev-servers preview.</div>
                        {formData.banner_image && (
                          <div className="mt-2 position-relative rounded border bg-light p-2" style={{ maxWidth: '300px' }}>
                            <img 
                              src={getImageUrl(formData.banner_image)} 
                              alt="Preview" 
                              className="rounded border w-100" 
                              style={{ height: '120px', objectFit: 'cover' }} 
                            />
                            <div className="mt-1 font-monospace small text-truncate" title={formData.banner_image}>
                              {formData.banner_image}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light border-top py-2.5">
                  <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={() => setShowModal(false)}>
                    <X size={14} /> Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary d-flex align-items-center gap-1" disabled={saving}>
                    {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Portal</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
