import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ChevronRight, ChevronLeft, Plus, Trash2, Edit3, CheckCircle, XCircle, MapPin } from 'lucide-react';

const API = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/part-time-configurations';
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('adminToken')}` });

const PartTimeConfigurations = () => {
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);

  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  // Area panel: null = showing state list; object = showing district list for that state
  const [selectedArea, setSelectedArea] = useState(null);
  const [districts, setDistricts] = useState([]);

  const [loading, setLoading] = useState({ cats: false, roles: false, areas: false, districts: false });

  const [editingCat, setEditingCat] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingArea, setEditingArea] = useState(null);
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [globalDoc, setGlobalDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState('pdf');

  useEffect(() => {
    fetchCategories();
    fetchGlobalDoc();
  }, []);

  const fetchGlobalDoc = async () => {
    try {
      const res = await axios.get(`${API}/global-guidance`, { headers: authHeader() });
      if (res.data.success) setGlobalDoc(res.data.data);
    } catch {}
  };

  const handleGlobalDocUpload = async (e, isReplace = false) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const uploadToast = toast.loading(isReplace ? 'Replacing document...' : 'Uploading document...');
    try {
      const res = await axios.post(`${API}/global-guidance`, formData, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success(res.data.message, { id: uploadToast });
        fetchGlobalDoc();
      } else {
        toast.error(res.data.message || 'Upload failed', { id: uploadToast });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload document', { id: uploadToast });
    }
    e.target.value = '';
  };

  const deleteGlobalDoc = async () => {
    if (!window.confirm('Are you sure you want to delete the Global Guidance Document?')) return;
    try {
      const res = await axios.delete(`${API}/global-guidance`, { headers: authHeader() });
      if (res.data.success) {
        toast.success('Guidance document deleted successfully');
        setGlobalDoc(null);
      }
    } catch {
      toast.error('Failed to delete guidance document');
    }
  };

  const viewGlobalDoc = () => {
    if (!globalDoc) return;
    setPreviewType(globalDoc.document_type);
    setPreviewUrl(`(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/part-time-configurations/global-guidance/preview?token=${localStorage.getItem('adminToken')}`);
  };

  const saveCategoryEdit = async () => {
    if (!editingCat.category_name?.trim()) return toast.error('Category Name is required');
    try {
      await axios.put(`${API}/categories/${editingCat.id}`, {
        category_name: editingCat.category_name,
        category_hint: editingCat.category_hint,
        category_reference_code: editingCat.category_reference_code,
        status: editingCat.status
      }, { headers: authHeader() });
      setCategories(categories.map(c => c.id === editingCat.id ? editingCat : c));
      if (selectedCat?.id === editingCat.id) setSelectedCat(editingCat);
      toast.success('Category updated successfully');
      setEditingCat(null);
    } catch {
      toast.error('Failed to update category');
    }
  };

  const saveRoleEdit = async () => {
    if (!editingRole.role_name?.trim()) return toast.error('Role Name is required');
    try {
      await axios.put(`${API}/roles/${editingRole.id}`, {
        role_name: editingRole.role_name,
        role_hint: editingRole.role_hint,
        status: editingRole.status
      }, { headers: authHeader() });
      setRoles(roles.map(r => r.id === editingRole.id ? editingRole : r));
      if (selectedRole?.id === editingRole.id) setSelectedRole(editingRole);
      toast.success('Role updated successfully');
      setEditingRole(null);
    } catch {
      toast.error('Failed to update role');
    }
  };

  const fetchCategories = async () => {
    setLoading(prev => ({ ...prev, cats: true }));
    try {
      const res = await axios.get(`${API}/categories`, { headers: authHeader() });
      setCategories(res.data.data || []);
    } catch { toast.error('Failed to load categories'); }
    setLoading(prev => ({ ...prev, cats: false }));
  };

  const fetchRoles = async (catId) => {
    setLoading(prev => ({ ...prev, roles: true }));
    try {
      const res = await axios.get(`${API}/categories/${catId}/roles`, { headers: authHeader() });
      setRoles(res.data.data || []);
      setAreas([]);
      setSelectedRole(null);
      setSelectedArea(null);
      setDistricts([]);
    } catch { toast.error('Failed to load roles'); }
    setLoading(prev => ({ ...prev, roles: false }));
  };

  const fetchAreas = async (roleId) => {
    setLoading(prev => ({ ...prev, areas: true }));
    try {
      const res = await axios.get(`${API}/roles/${roleId}/areas`, { headers: authHeader() });
      setAreas(res.data.data || []);
      setSelectedArea(null);
      setDistricts([]);
    } catch { toast.error('Failed to load areas'); }
    setLoading(prev => ({ ...prev, areas: false }));
  };

  const fetchDistricts = async (areaId) => {
    setLoading(prev => ({ ...prev, districts: true }));
    try {
      const res = await axios.get(`${API}/areas/${areaId}/districts`, { headers: authHeader() });
      setDistricts(res.data.data || []);
    } catch { toast.error('Failed to load districts'); }
    setLoading(prev => ({ ...prev, districts: false }));
  };

  const addCategory = async () => {
    const name = prompt('Enter New Part-Time Category Name:');
    if (!name?.trim()) return;
    try {
      const res = await axios.post(`${API}/categories`, { category_name: name }, { headers: authHeader() });
      setCategories([...categories, { id: res.data.id, category_name: name, status: 1 }]);
      toast.success('Category added');
    } catch { toast.error('Failed to add category'); }
  };

  const addRole = async () => {
    if (!selectedCat) return toast.error('Select a category first');
    const name = prompt(`Add Role for ${selectedCat.category_name}:`);
    if (!name?.trim()) return;
    try {
      const res = await axios.post(`${API}/roles`, { category_id: selectedCat.id, role_name: name }, { headers: authHeader() });
      setRoles([...roles, { id: res.data.id, role_name: name, category_id: selectedCat.id, status: 1 }]);
      toast.success('Role added');
    } catch { toast.error('Failed to add role'); }
  };

  const addArea = async () => {
    if (!selectedRole) return toast.error('Select a role first');
    const name = prompt(`Add Working State for ${selectedRole.role_name}:`);
    if (!name?.trim()) return;
    try {
      const res = await axios.post(`${API}/areas`, { role_id: selectedRole.id, eligible_area_name: name }, { headers: authHeader() });
      setAreas([...areas, { id: res.data.id, eligible_area_name: name, role_id: selectedRole.id, status: 1 }]);
      toast.success('State added');
    } catch { toast.error('Failed to add state'); }
  };

  const saveAreaEdit = async () => {
    if (!editingArea?.eligible_area_name?.trim()) return toast.error('State name is required');
    try {
      await axios.put(`${API}/areas/${editingArea.id}/name`, {
        eligible_area_name: editingArea.eligible_area_name,
        status: editingArea.status
      }, { headers: authHeader() });
      setAreas(areas.map(a => a.id === editingArea.id ? editingArea : a));
      if (selectedArea?.id === editingArea.id) setSelectedArea(editingArea);
      toast.success('State updated');
      setEditingArea(null);
    } catch { toast.error('Failed to update state'); }
  };

  const addDistrict = async () => {
    if (!selectedArea) return;
    const name = prompt(`Add District under ${selectedArea.eligible_area_name}:`);
    if (!name?.trim()) return;
    try {
      const res = await axios.post(`${API}/districts`, { area_id: selectedArea.id, district_name: name }, { headers: authHeader() });
      setDistricts([...districts, { id: res.data.id, district_name: name, area_id: selectedArea.id, status: 1 }]);
      toast.success('District added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add district');
    }
  };

  const saveDistrictEdit = async () => {
    if (!editingDistrict?.district_name?.trim()) return toast.error('District name is required');
    try {
      await axios.put(`${API}/districts/${editingDistrict.id}`, {
        district_name: editingDistrict.district_name,
        status: editingDistrict.status
      }, { headers: authHeader() });
      setDistricts(districts.map(d => d.id === editingDistrict.id ? editingDistrict : d));
      toast.success('District updated');
      setEditingDistrict(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update district');
    }
  };

  const deleteDistrict = async (id) => {
    if (!window.confirm('Delete this district? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/districts/${id}`, { headers: authHeader() });
      setDistricts(districts.filter(d => d.id !== id));
      toast.success('District deleted');
    } catch { toast.error('Failed to delete district'); }
  };

  const toggleDistrictStatus = async (district) => {
    const newStatus = district.status === 1 ? 0 : 1;
    try {
      await axios.put(`${API}/districts/${district.id}`, {
        district_name: district.district_name,
        status: newStatus
      }, { headers: authHeader() });
      setDistricts(districts.map(d => d.id === district.id ? { ...d, status: newStatus } : d));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const deleteItem = async (level, id) => {
    if (!window.confirm(`Delete this ${level}? This action cannot be undone and may affect dependent linked items.`)) return;
    try {
      const endpoint = level === 'category' ? `/categories/${id}` : level === 'role' ? `/roles/${id}` : `/areas/${id}`;
      await axios.delete(`${API}${endpoint}`, { headers: authHeader() });
      if (level === 'category') {
        setCategories(categories.filter(c => c.id !== id));
        if (selectedCat?.id === id) { setSelectedCat(null); setRoles([]); setAreas([]); }
      } else if (level === 'role') {
        setRoles(roles.filter(r => r.id !== id));
        if (selectedRole?.id === id) { setSelectedRole(null); setAreas([]); }
      } else {
        setAreas(areas.filter(a => a.id !== id));
        if (selectedArea?.id === id) { setSelectedArea(null); setDistricts([]); }
      }
      toast.success(`${level} deleted`);
    } catch { toast.error(`Failed to delete ${level}`); }
  };

  const toggleStatus = async (level, item) => {
    const newStatus = item.status === 1 ? 0 : 1;
    try {
      const endpoint = level === 'category' ? `/categories/${item.id}` : level === 'role' ? `/roles/${item.id}` : `/areas/${item.id}`;
      const body = level === 'category'
        ? { category_name: item.category_name, category_hint: item.category_hint, category_reference_code: item.category_reference_code, status: newStatus }
        : level === 'role'
        ? { role_name: item.role_name, role_hint: item.role_hint, status: newStatus }
        : { eligible_area_name: item.eligible_area_name, status: newStatus };

      await axios.put(`${API}${endpoint}`, body, { headers: authHeader() });

      if (level === 'category') setCategories(categories.map(c => c.id === item.id ? { ...c, status: newStatus } : c));
      else if (level === 'role') setRoles(roles.map(r => r.id === item.id ? { ...r, status: newStatus } : r));
      else setAreas(areas.map(a => a.id === item.id ? { ...a, status: newStatus } : a));

      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#32c5d2' }}>Part-Time Dependency Engine</h2>
          <p className="text-muted small mb-0">Configure hierarchical nested eligibility rules: Categories → Roles → Working Areas</p>
        </div>

        <div className="card shadow-sm border px-3 py-2 bg-white" style={{ minWidth: '350px' }}>
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div>
              <h6 className="fw-bold mb-0.5 text-dark" style={{ fontSize: '13px' }}>Global Guidance Document</h6>
              <span className={`badge ${globalDoc ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border border-secondary-subtle'} px-2 py-0.5`} style={{ fontSize: '10px' }}>
                {globalDoc ? 'Active Guideline' : 'No Document'}
              </span>
            </div>
            <div className="d-flex gap-1 align-items-center">
              {globalDoc ? (
                <>
                  <button className="btn btn-xs btn-outline-info py-0.5 px-2" style={{ fontSize: '11px' }} onClick={viewGlobalDoc}>View</button>
                  <label className="btn btn-xs btn-outline-primary mb-0 py-0.5 px-2" style={{ cursor: 'pointer', fontSize: '11px' }}>
                    Replace
                    <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleGlobalDocUpload(e, true)} />
                  </label>
                  <button className="btn btn-xs btn-outline-danger py-0.5 px-2" style={{ fontSize: '11px' }} onClick={deleteGlobalDoc}>Delete</button>
                </>
              ) : (
                <label className="btn btn-xs btn-success mb-0 d-inline-flex align-items-center gap-1 py-1 px-3.5" style={{ cursor: 'pointer', fontSize: '11.5px' }}>
                  <Plus size={12} /> Upload Guidance
                  <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleGlobalDocUpload(e, false)} />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Level 1: Categories */}
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
              <h6 className="mb-0 fw-bold">1. Categories</h6>
              <button className="btn btn-xs btn-success d-flex align-items-center gap-1" onClick={addCategory}>
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="card-body p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="list-group list-group-flush">
                {categories.map(cat => (
                  <div key={cat.id}
                    className={`list-group-item list-group-item-action d-flex align-items-center gap-2 p-3 ${selectedCat?.id === cat.id ? 'active' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setSelectedCat(cat); fetchRoles(cat.id); }}
                  >
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className={`fw-bold ${selectedCat?.id === cat.id ? 'text-white' : ''}`}>{cat.category_name}</span>
                        {cat.category_reference_code && (
                          <span className={`badge ${selectedCat?.id === cat.id ? 'bg-light text-dark' : 'bg-info-subtle text-info border border-info-subtle'} fw-bold`} style={{ fontSize: '12px', fontWeight: '800', padding: '0.25em 0.5em' }}>
                            §{cat.category_reference_code}
                          </span>
                        )}
                      </div>
                      {cat.category_hint && (
                        <div className={`text-truncate small mt-0.5 ${selectedCat?.id === cat.id ? 'text-white text-opacity-75' : 'text-muted'}`} style={{ maxWidth: '180px', fontSize: '11px' }} title={cat.category_hint}>
                          💡 {cat.category_hint}
                        </div>
                      )}
                      <span className={`badge ${cat.status ? 'bg-success' : 'bg-danger'} mt-1`}>
                        {cat.status ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); toggleStatus('category', cat); }}>
                        {cat.status ? <CheckCircle size={14} color={selectedCat?.id === cat.id ? '#fff' : '#28a745'} /> : <XCircle size={14} color="#dc3545" />}
                      </button>
                      <button className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); setEditingCat({ ...cat }); }} title="Edit Category">
                        <Edit3 size={14} color={selectedCat?.id === cat.id ? '#fff' : '#007bff'} />
                      </button>
                      <button className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); deleteItem('category', cat.id); }}>
                        <Trash2 size={14} color={selectedCat?.id === cat.id ? '#fff' : '#dc3545'} />
                      </button>
                    </div>
                    <ChevronRight size={18} className={selectedCat?.id === cat.id ? 'text-white' : 'text-muted'} />
                  </div>
                ))}
                {categories.length === 0 && <div className="p-4 text-center text-muted small">No categories defined</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Level 2: Roles */}
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            <div className={`card-header ${selectedCat ? 'bg-primary' : 'bg-secondary'} text-white d-flex justify-content-between align-items-center py-3`}>
              <h6 className="mb-0 fw-bold">2. Roles {selectedCat && `for ${selectedCat.category_name}`}</h6>
              {selectedCat && (
                <button className="btn btn-xs btn-light d-flex align-items-center gap-1" onClick={addRole}>
                  <Plus size={14} /> Add
                </button>
              )}
            </div>
            <div className="card-body p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {!selectedCat ? (
                <div className="p-5 text-center text-muted italic">Select a category to manage roles</div>
              ) : (
                <div className="list-group list-group-flush">
                  {roles.map(role => (
                    <div key={role.id}
                      className={`list-group-item list-group-item-action d-flex align-items-center gap-2 p-3 ${selectedRole?.id === role.id ? 'bg-primary bg-opacity-10 border-start border-4 border-primary' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedRole(role); fetchAreas(role.id); }}
                    >
                      <div className="flex-grow-1 font-monospace" style={{ fontSize: '13px' }}>
                        <div className="fw-bold text-dark">{role.role_name}</div>
                        {role.role_hint && (
                          <div className="text-truncate text-muted mt-0.5" style={{ maxWidth: '190px', fontSize: '11px' }} title={role.role_hint}>
                            💡 {role.role_hint}
                          </div>
                        )}
                        <span className={`badge ${role.status ? 'bg-success' : 'bg-danger'} mt-1`}>
                          {role.status ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <div className="d-flex gap-1">
                        <button className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); toggleStatus('role', role); }}>
                          {role.status ? <CheckCircle size={14} color="#28a745" /> : <XCircle size={14} color="#dc3545" />}
                        </button>
                        <button className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); setEditingRole({ ...role }); }} title="Edit Role">
                          <Edit3 size={14} color="#007bff" />
                        </button>
                        <button className="btn btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); deleteItem('role', role.id); }}>
                          <Trash2 size={14} color="#dc3545" />
                        </button>
                      </div>
                      <ChevronRight size={18} className="text-muted" />
                    </div>
                  ))}
                  {roles.length === 0 && <div className="p-4 text-center text-muted small">No roles for this category</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Level 3: Working Areas — State → District 2-level panel */}
        <div className="col-lg-4">
          <div className="card shadow-sm h-100">
            {/* Header changes based on drill-down level */}
            {!selectedArea ? (
              <div className={`card-header ${selectedRole ? 'bg-info' : 'bg-secondary'} text-white d-flex justify-content-between align-items-center py-3`}>
                <div>
                  <h6 className="mb-0 fw-bold">3. Working Areas</h6>
                  {selectedRole && <small className="opacity-75" style={{ fontSize: '10px' }}>Click a State to manage its Districts</small>}
                </div>
                {selectedRole && (
                  <button className="btn btn-xs btn-light d-flex align-items-center gap-1" onClick={addArea}>
                    <Plus size={14} /> Add State
                  </button>
                )}
              </div>
            ) : (
              <div className="card-header text-white d-flex justify-content-between align-items-center py-3" style={{ background: '#0d9488' }}>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-xs btn-light d-flex align-items-center gap-1 py-0.5 px-2"
                    style={{ fontSize: '11px' }}
                    onClick={() => { setSelectedArea(null); setDistricts([]); }}
                  >
                    <ChevronLeft size={13} /> States
                  </button>
                  <div>
                    <h6 className="mb-0 fw-bold d-flex align-items-center gap-1">
                      <MapPin size={14} /> {selectedArea.eligible_area_name}
                    </h6>
                    <small className="opacity-75" style={{ fontSize: '10px' }}>Districts</small>
                  </div>
                </div>
                <button className="btn btn-xs btn-light d-flex align-items-center gap-1" onClick={addDistrict}>
                  <Plus size={14} /> Add District
                </button>
              </div>
            )}

            <div className="card-body p-0" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {/* STATE LIST VIEW */}
              {!selectedArea && (
                !selectedRole ? (
                  <div className="p-5 text-center text-muted italic">Select a role to manage working areas</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {areas.map(area => (
                      <div
                        key={area.id}
                        className="list-group-item list-group-item-action d-flex align-items-center gap-2 p-3"
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setSelectedArea(area); fetchDistricts(area.id); }}
                      >
                        <div className="flex-grow-1">
                          <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>{area.eligible_area_name}</div>
                          <span className={`badge ${area.status ? 'bg-success' : 'bg-danger'} mt-1`} style={{ fontSize: '10px' }}>
                            {area.status ? 'Active' : 'Hidden'}
                          </span>
                        </div>
                        <div className="d-flex gap-1" onClick={e => e.stopPropagation()}>
                          <button className="btn btn-icon btn-sm" title="Toggle Status" onClick={() => toggleStatus('area', area)}>
                            {area.status ? <CheckCircle size={14} color="#28a745" /> : <XCircle size={14} color="#dc3545" />}
                          </button>
                          <button className="btn btn-icon btn-sm" title="Edit State" onClick={() => setEditingArea({ ...area })}>
                            <Edit3 size={14} color="#007bff" />
                          </button>
                          <button className="btn btn-icon btn-sm" title="Delete State" onClick={() => deleteItem('area', area.id)}>
                            <Trash2 size={14} color="#dc3545" />
                          </button>
                        </div>
                        <ChevronRight size={16} className="text-muted" />
                      </div>
                    ))}
                    {areas.length === 0 && <div className="p-4 text-center text-muted small">No states defined for this role</div>}
                  </div>
                )
              )}

              {/* DISTRICT LIST VIEW */}
              {selectedArea && (
                loading.districts ? (
                  <div className="p-4 text-center text-muted small">Loading districts…</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {districts.map(dist => (
                      <div key={dist.id} className="list-group-item d-flex align-items-center gap-2 p-3">
                        <div className="flex-grow-1">
                          <div className="fw-semibold text-secondary" style={{ fontSize: '13px' }}>{dist.district_name}</div>
                          <span className={`badge ${dist.status ? 'bg-success' : 'bg-danger'} mt-1`} style={{ fontSize: '10px' }}>
                            {dist.status ? 'Active' : 'Hidden'}
                          </span>
                        </div>
                        <div className="d-flex gap-1">
                          <button className="btn btn-icon btn-sm" title="Toggle Status" onClick={() => toggleDistrictStatus(dist)}>
                            {dist.status ? <CheckCircle size={14} color="#28a745" /> : <XCircle size={14} color="#dc3545" />}
                          </button>
                          <button className="btn btn-icon btn-sm" title="Edit District" onClick={() => setEditingDistrict({ ...dist })}>
                            <Edit3 size={14} color="#007bff" />
                          </button>
                          <button className="btn btn-icon btn-sm" title="Delete District" onClick={() => deleteDistrict(dist.id)}>
                            <Trash2 size={14} color="#dc3545" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {districts.length === 0 && (
                      <div className="p-4 text-center text-muted small">
                        No districts for {selectedArea.eligible_area_name}.
                        <br /><span className="text-info" style={{ cursor: 'pointer' }} onClick={addDistrict}>+ Add first district</span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Part-Time Category Modal */}
      {editingCat && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-3">
                <h5 className="modal-title fw-bold" style={{ fontSize: '16px' }}>Edit Part-Time Category</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingCat(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary" style={{ fontSize: '13px' }}>Category Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={editingCat.category_name}
                    onChange={e => setEditingCat({ ...editingCat, category_name: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary" style={{ fontSize: '13px' }}>Reference Code <small className="text-muted fw-normal">(e.g. 2.2.2.1)</small></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. 2.2.2.1"
                    value={editingCat.category_reference_code || ''}
                    onChange={e => setEditingCat({ ...editingCat, category_reference_code: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary" style={{ fontSize: '13px' }}>Guideline Hint / Instructions</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={4}
                    placeholder="e.g. Upload valid school employment certificate or service certificate issued by institution."
                    value={editingCat.category_hint || ''}
                    onChange={e => setEditingCat({ ...editingCat, category_hint: e.target.value })}
                  />
                  <small className="text-muted" style={{ fontSize: '11px' }}>This hint text dynamically displays when a student selects this category during registration.</small>
                </div>
              </div>
              <div className="modal-footer bg-light py-2">
                <button type="button" className="btn btn-sm btn-secondary px-3" onClick={() => setEditingCat(null)}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary px-3" onClick={saveCategoryEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-primary text-white py-3">
                <h5 className="modal-title fw-bold" style={{ fontSize: '16px' }}>Edit Role / Designation</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingRole(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary" style={{ fontSize: '13px' }}>Role / Designation Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={editingRole.role_name}
                    onChange={e => setEditingRole({ ...editingRole, role_name: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary" style={{ fontSize: '13px' }}>Role-Level Guideline Hint</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={4}
                    placeholder="e.g. Applicants holding this designation must upload a copy of their appointment order and latest pay slip."
                    value={editingRole.role_hint || ''}
                    onChange={e => setEditingRole({ ...editingRole, role_hint: e.target.value })}
                  />
                  <small className="text-muted" style={{ fontSize: '11px' }}>Shown to students below the category hint when this role is selected during registration.</small>
                </div>
              </div>
              <div className="modal-footer bg-light py-2">
                <button type="button" className="btn btn-sm btn-secondary px-3" onClick={() => setEditingRole(null)}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary px-3" onClick={saveRoleEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Working Area / State Modal */}
      {editingArea && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header py-3" style={{ background: '#0891b2' }}>
                <h5 className="modal-title fw-bold text-white" style={{ fontSize: '16px' }}>Edit Working Area / State</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingArea(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary" style={{ fontSize: '13px' }}>State Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={editingArea.eligible_area_name}
                    onChange={e => setEditingArea({ ...editingArea, eligible_area_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer bg-light py-2">
                <button type="button" className="btn btn-sm btn-secondary px-3" onClick={() => setEditingArea(null)}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary px-3" onClick={saveAreaEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit District Modal */}
      {editingDistrict && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header py-3" style={{ background: '#0d9488' }}>
                <h5 className="modal-title fw-bold text-white" style={{ fontSize: '16px' }}>Edit District</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingDistrict(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label className="form-label fw-bold text-secondary" style={{ fontSize: '13px' }}>District Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={editingDistrict.district_name}
                    onChange={e => setEditingDistrict({ ...editingDistrict, district_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer bg-light py-2">
                <button type="button" className="btn btn-sm btn-secondary px-3" onClick={() => setEditingDistrict(null)}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary px-3" onClick={saveDistrictEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Guidance Document Previewer Modal */}
      {previewUrl && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered" style={{ maxWidth: '85%' }}>
            <div className="modal-content shadow-lg border-0" style={{ height: '85vh' }}>
              <div className="modal-header bg-dark text-white py-2.5">
                <h6 className="modal-title fw-bold mb-0" style={{ fontSize: '14px' }}>Guidance Document Preview — {globalDoc?.file_name}</h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setPreviewUrl(null)}></button>
              </div>
              <div className="modal-body p-0 bg-secondary bg-opacity-10 d-flex justify-content-center align-items-center overflow-auto" style={{ height: '75vh' }}>
                {previewType === 'pdf' ? (
                  <iframe src={previewUrl} title="Guidance Document Preview" width="100%" height="100%" style={{ border: 'none' }} />
                ) : (
                  <img src={previewUrl} alt="Guidance Document" className="img-fluid max-vh-100 shadow-sm" style={{ objectFit: 'contain' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartTimeConfigurations;
