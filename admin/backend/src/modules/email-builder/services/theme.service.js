/**
 * Theme Service for Visual Email Template System
 */

const THEMES = {
    'university-blue': {
        primaryColor: '#2563eb',
        headerBg: '#1e3a8a',
        accentColor: '#3b82f6',
        bodyBg: '#f8fafc',
        cardBg: '#ffffff',
        textColor: '#1e293b',
        buttonTextColor: '#ffffff',
        footerTextColor: '#64748b',
        borderColor: '#e2e8f0',
        greetingColor: '#1e3a8a'
    },
    'emerald': {
        primaryColor: '#059669',
        headerBg: '#064e3b',
        accentColor: '#10b981',
        bodyBg: '#f0fdf4',
        cardBg: '#ffffff',
        textColor: '#0f172a',
        buttonTextColor: '#ffffff',
        footerTextColor: '#475569',
        borderColor: '#dcfce7',
        greetingColor: '#064e3b'
    },
    'crimson': {
        primaryColor: '#dc2626',
        headerBg: '#7f1d1d',
        accentColor: '#f43f5e',
        bodyBg: '#fff5f5',
        cardBg: '#ffffff',
        textColor: '#2d3748',
        buttonTextColor: '#ffffff',
        footerTextColor: '#718096',
        borderColor: '#fed7d7',
        greetingColor: '#7f1d1d'
    },
    'dark': {
        primaryColor: '#38bdf8',
        headerBg: '#0f172a',
        accentColor: '#64748b',
        bodyBg: '#0f172a',
        cardBg: '#1e293b',
        textColor: '#e2e8f0',
        buttonTextColor: '#0f172a',
        footerTextColor: '#94a3b8',
        borderColor: '#334155',
        greetingColor: '#38bdf8'
    }
};

class ThemeService {
    static getTheme(themeKey) {
        return THEMES[themeKey] || THEMES['university-blue'];
    }

    static getAvailableThemes() {
        return Object.keys(THEMES);
    }
}

module.exports = ThemeService;
