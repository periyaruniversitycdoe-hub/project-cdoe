import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Header = () => {
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        const ac = new AbortController();
        axios.get((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api/settings', { signal: ac.signal })
            .then(res => setSettings(res.data.success ? res.data.data : res.data))
            .catch(err => { if (err?.code !== 'ERR_CANCELED') console.error('Settings fetch error:', err); });
        return () => ac.abort();
    }, []);

    if (!settings) return null;

    const logoUrl = settings.logo
        ? (settings.logo.startsWith('http') ? settings.logo : `((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '')${settings.logo}`)
        : '/images/pu_logo.png';

    return (
        <header className="bg-white shadow-sm border-bottom">
            <div className="container py-3">
                <div className="row align-items-center justify-content-center text-center text-md-start">
                    <div className="col-12 col-md-auto mb-3 mb-md-0 d-flex justify-content-center">
                        <img src={logoUrl} alt="Logo" style={{ height: '90px', maxHeight: '110px', objectFit: 'contain' }} />
                    </div>
                    <div className="col-12 col-md ps-md-4">
                        {/* Tamil Name */}
                        <h1 className="responsive-h1" style={{ color: '#901a1e', fontWeight: 'bold', marginBottom: '0px', fontFamily: 'serif' }}>
                            {settings.university_name_tamil || 'பெரியார் பல்கலைக்கழகம்'}
                        </h1>
                        {/* English Name */}
                        <h2 className="responsive-h2" style={{ color: '#0f4c81', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px', fontFamily: 'sans-serif' }}>
                            {settings.university_name_english || 'PERIYAR UNIVERSITY'}
                        </h2>
                        {/* Subtexts */}
                        <p className="responsive-text" style={{ margin: '0', color: '#111827', fontWeight: '500', lineHeight: '1.4' }}>
                            {settings.header_line2 || 'State University - NAAC \'A++\' Grade - NIRF Rank 94'}
                        </p>
                        <p className="responsive-text" style={{ margin: '0', color: '#111827', fontWeight: '500', lineHeight: '1.4' }}>
                            {settings.naac_details || 'State Public University Rank 40 - SDG Institutions Rank Band: 11-50'}
                        </p>
                        {/* Tamil Subtext / Periyar Palkalai Nagar */}
                        <p className="responsive-text" style={{ margin: '0', color: '#111827', fontWeight: '500', lineHeight: '1.4' }}>
                            {settings.subtitle || 'Periyar Palkalai Nagar'}
                        </p>
                        <p className="responsive-text" style={{ margin: '0', color: '#111827', fontWeight: '500', lineHeight: '1.4' }}>
                            {settings.header_line3 || settings.address || 'Salem - 636 011, Tamil Nadu, India.'}
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
