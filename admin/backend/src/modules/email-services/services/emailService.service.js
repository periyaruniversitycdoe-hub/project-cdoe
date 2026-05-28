const db = require('../../../../config/db');

/**
 * CRUD operations for email configuration services mapping directly to email_templates
 */
const getAllServices = async () => {
    const [rows] = await db.execute('SELECT * FROM email_templates ORDER BY created_at DESC');
    return rows.map(r => {
        let config = {};
        try {
            config = typeof r.template_config === 'string' ? JSON.parse(r.template_config) : (r.template_config || {});
        } catch (e) {
            config = {};
        }
        return {
            id: r.id,
            service_key: r.template_key,
            service_name: r.template_name,
            email_subject: config.subject || '',
            email_template: config.message || '',
            is_active: r.is_active ? 1 : 0,
            created_at: r.created_at,
            updated_at: r.updated_at
        };
    });
};

const getServiceById = async (id) => {
    const [rows] = await db.execute('SELECT * FROM email_templates WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    let config = {};
    try {
        config = typeof r.template_config === 'string' ? JSON.parse(r.template_config) : (r.template_config || {});
    } catch (e) {
        config = {};
    }
    return {
        id: r.id,
        service_key: r.template_key,
        service_name: r.template_name,
        email_subject: config.subject || '',
        email_template: config.message || '',
        is_active: r.is_active ? 1 : 0,
        created_at: r.created_at,
        updated_at: r.updated_at
    };
};

const createService = async (data) => {
    const { service_key, service_name, email_subject, email_template, is_active } = data;
    const config = {
        subject: email_subject || '',
        greeting: 'Dear {{studentName}},',
        message: email_template || '',
        buttonText: 'Go to Student Dashboard',
        buttonUrl: '{{actionUrl}}',
        theme: 'university-blue',
        footer: 'Office of PhD Admissions, Periyar University',
        logo: '/uploads/logos/default-logo.png'
    };

    try {
        await db.execute('INSERT IGNORE INTO email_template_types (type_name) VALUES (?)', [service_name]);
    } catch (e) {}

    const [result] = await db.execute(
        'INSERT INTO email_templates (template_key, template_name, template_type, template_config, is_active) VALUES (?, ?, ?, ?, ?)',
        [service_key, service_name, service_name, JSON.stringify(config), is_active ? 1 : 0]
    );
    return result.insertId;
};

const updateService = async (id, data) => {
    const { service_name, email_subject, email_template, is_active } = data;
    const [rows] = await db.execute('SELECT * FROM email_templates WHERE id = ?', [id]);
    if (rows.length > 0) {
        const r = rows[0];
        let config = {};
        try {
            config = typeof r.template_config === 'string' ? JSON.parse(r.template_config) : (r.template_config || {});
        } catch (e) {
            config = {};
        }
        config.subject = email_subject || '';
        config.message = email_template || '';

        await db.execute(
            'UPDATE email_templates SET template_name = ?, template_config = ?, is_active = ? WHERE id = ?',
            [service_name, JSON.stringify(config), is_active ? 1 : 0, id]
        );
    }
};

const deleteService = async (id) => {
    await db.execute('DELETE FROM email_templates WHERE id = ?', [id]);
};

const toggleServiceStatus = async (id, status) => {
    await db.execute('UPDATE email_templates SET is_active = ? WHERE id = ?', [status ? 1 : 0, id]);
};

module.exports = {
    getAllServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    toggleServiceStatus
};
