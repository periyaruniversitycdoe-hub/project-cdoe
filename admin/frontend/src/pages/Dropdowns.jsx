
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ListTree
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api';

const dropdownTypes = [
  { id: 'exam_centers', label: 'Exam Centers' },
  { id: 'mphil_courses', label: 'M.Phil Courses' },
  { id: 'categories', label: 'Categories' },
  { id: 'districts', label: 'Districts' },
  { id: 'communities', label: 'Communities' },
  { id: 'genders', label: 'Genders' },
  { id: 'id_types', label: 'ID Types' },
  { id: 'score_types', label: 'Score Types' },
  { id: 'mark_statement_types', label: 'Mark Statement Types' },
  { id: 'education_boards', label: 'Education Boards' },
  { id: 'degree_types', label: 'Degree Types' },
  { id: 'university_types', label: 'University Types' },
  { id: 'specializations', label: 'Specializations' },
  { id: 'employment_types', label: 'Employment Types' },
];

const Dropdowns = () => {
  const [selectedType, setSelectedType] = useState('exam_centers');
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    fetchItems();
    setEditingId(null);
    setEditingValue('');
  }, [selectedType]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/dropdowns/${selectedType}`);
      setItems(res.data.data);
    } catch (err) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${API_URL}/dropdowns/${selectedType}`, { name: newItem }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewItem('');
      fetchItems();
      toast.success('Item added successfully');
    } catch (err) {
      toast.error('Failed to add item');
    }
  };

  const handleEditSave = async (id) => {
    if (!editingValue.trim()) return;
    try {
      const token = localStorage.getItem('adminToken');
      await axios.put(`${API_URL}/dropdowns/${selectedType}/${id}`, { name: editingValue.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingId(null);
      setEditingValue('');
      fetchItems();
      toast.success('Item updated successfully');
    } catch (err) {
      toast.error('Failed to update item');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      const token = localStorage.getItem('adminToken');
      await axios.delete(`${API_URL}/dropdowns/${selectedType}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (editingId === id) { setEditingId(null); setEditingValue(''); }
      fetchItems();
      toast.success('Item deleted successfully');
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="fw-bold" style={{ color: '#32c5d2', fontSize: '24px' }}>Dropdown Management</h2>
        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Update dynamic lists used in the application form</p>
      </div>

      <div className="row">
        <div className="col-lg-4">
          <div className="list-group shadow-sm border-0">
            {dropdownTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`list-group-item list-group-item-action border-0 py-3 d-flex align-items-center justify-between ${
                  selectedType === type.id ? 'active' : ''
                }`}
                style={selectedType === type.id ? { backgroundColor: '#32c5d2' } : {}}
              >
                <div className="d-flex align-items-center gap-2">
                  <ListTree size={16} />
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{type.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom py-3">
              <form onSubmit={handleAdd} className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Add new ${dropdownTypes.find(t => t.id === selectedType).label}...`}
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                />
                <button type="submit" className="btn btn-primary d-flex align-items-center gap-2 px-4 whitespace-nowrap">
                  <Plus size={18} /> Add Item
                </button>
              </form>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {loading ? (
                  <div className="p-5 text-center text-muted">Loading...</div>
                ) : items.length === 0 ? (
                  <div className="p-5 text-center text-muted">No items found. Add one above.</div>
                ) : items.map((item) => (
                  <div key={item.id} className="list-group-item d-flex align-items-center justify-content-between py-3 px-4">
                    {editingId === item.id ? (
                      <div className="d-flex align-items-center gap-2 flex-grow-1 me-2">
                        <input
                          autoFocus
                          className="form-control form-control-sm"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleEditSave(item.id);
                            if (e.key === 'Escape') { setEditingId(null); setEditingValue(''); }
                          }}
                        />
                        <button
                          onClick={() => handleEditSave(item.id)}
                          className="btn btn-sm btn-success border-0 d-flex align-items-center"
                        ><Check size={14}/></button>
                        <button
                          onClick={() => { setEditingId(null); setEditingValue(''); }}
                          className="btn btn-sm btn-secondary border-0 d-flex align-items-center"
                        ><X size={14}/></button>
                      </div>
                    ) : (
                      <span className="fw-medium text-dark">{item.name}</span>
                    )}
                    {editingId !== item.id && (
                      <div className="d-flex align-items-center gap-1">
                        <button
                          onClick={() => { setEditingId(item.id); setEditingValue(item.name); }}
                          className="btn btn-sm btn-outline-secondary border-0"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-sm btn-outline-danger border-0"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="card-footer bg-light border-0 py-2 px-4 text-end">
              <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>{items.length} TOTAL ITEMS</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dropdowns;
