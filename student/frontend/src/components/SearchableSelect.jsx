import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  error = false,
  size = 'sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize options to a standard format: { value: string, label: string }
  const normalizedOptions = options.map(opt => {
    if (opt === null || opt === undefined) {
      return { value: '', label: '' };
    }
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: String(opt), label: String(opt) };
    }
    return {
      value: opt.id !== undefined ? String(opt.id) : String(opt.value ?? opt.name ?? ''),
      label: opt.name ?? opt.label ?? String(opt.id ?? '')
    };
  });

  const selectedOption = normalizedOptions.find(opt => opt.value === String(value));

  // Sync searchQuery with selected option label when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery(selectedOption ? selectedOption.label : '');
    }
  }, [value, isOpen, selectedOption]);

  // Filter options based on input
  const filteredOptions = normalizedOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    // When focusing, show all options by default but clear input query so user can start typing immediately
    setSearchQuery('');
  };

  const handleOptionSelect = (opt) => {
    onChange(opt.value);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div ref={containerRef} className="position-relative w-100 searchable-select-wrapper">
      <div className="position-relative">
        <input
          ref={inputRef}
          type="text"
          className={`form-control form-control-${size} text-start bg-white ${error ? 'is-invalid' : ''}`}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleInputFocus}
          disabled={disabled}
          style={{
            cursor: 'pointer',
            paddingRight: '45px',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        />
        
        {/* Right side indicators (Clear & Chevron) */}
        <div 
          className="position-absolute d-flex align-items-center gap-1.5"
          style={{
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
            zIndex: 5
          }}
        >
          {value && !disabled && (
            <button 
              type="button" 
              className="btn btn-link p-0 text-secondary border-0 hover-opacity d-flex align-items-center justify-content-center"
              onClick={handleClear}
              style={{ width: '16px', height: '16px' }}
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} className="text-secondary" style={{ pointerEvents: 'none' }} />
        </div>
      </div>

      {isOpen && !disabled && (
        <div
          className="dropdown-menu show w-100 shadow rounded-3 py-1 overflow-auto border border-secondary-subtle"
          style={{
            maxHeight: '220px',
            zIndex: 1050,
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            borderRadius: '8px'
          }}
        >
          {/* Inner Search Box Header if there are lots of items */}
          <div className="d-flex align-items-center px-2 py-1 border-bottom bg-light sticky-top" style={{ top: 0, zIndex: 6 }}>
            <Search size={12} className="text-secondary me-2 flex-shrink-0" />
            <span className="text-secondary small fw-semibold" style={{ fontSize: '11px' }}>
              Type to filter ({filteredOptions.length} items)
            </span>
          </div>

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`dropdown-item py-1.5 px-3 text-start border-0 w-100 small transition-all ${
                    isSelected ? 'bg-primary text-white fw-bold' : 'text-dark bg-transparent'
                  }`}
                  style={{
                    fontSize: '13px',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => handleOptionSelect(opt)}
                >
                  {opt.label}
                </button>
              );
            })
          ) : (
            <div className="dropdown-item disabled py-2 text-center text-muted small" style={{ fontSize: '13px' }}>
              No matches found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
