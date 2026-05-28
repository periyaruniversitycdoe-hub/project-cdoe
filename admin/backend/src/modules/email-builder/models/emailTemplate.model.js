const db = require('../../../../config/db');

class EmailTemplateModel {
    static async findAll() {
        const [rows] = await db.execute('SELECT * FROM email_templates ORDER BY created_at DESC');
        return rows.map(row => ({
            ...row,
            template_config: typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config
        }));
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM email_templates WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
            ...row,
            template_config: typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config
        };
    }

    static async findByKey(key) {
        const [rows] = await db.execute('SELECT * FROM email_templates WHERE template_key = ?', [key]);
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
            ...row,
            template_config: typeof row.template_config === 'string' ? JSON.parse(row.template_config) : row.template_config
        };
    }

    static async create(data) {
        const { template_key, template_name, template_type, template_config, is_active } = data;
        const configStr = JSON.stringify(template_config);
        const [result] = await db.execute(
            `INSERT INTO email_templates (template_key, template_name, template_type, template_config, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [template_key, template_name, template_type, configStr, is_active !== false]
        );
        return result.insertId;
    }

    static async update(id, data) {
        const { template_name, template_type, template_config, is_active } = data;
        const configStr = JSON.stringify(template_config);
        await db.execute(
            `UPDATE email_templates 
             SET template_name = ?, template_type = ?, template_config = ?, is_active = ? 
             WHERE id = ?`,
            [template_name, template_type, configStr, is_active !== false, id]
        );
        return true;
    }

    static async delete(id) {
        await db.execute('DELETE FROM email_templates WHERE id = ?', [id]);
        return true;
    }

    static async toggleActive(id, is_active) {
        await db.execute('UPDATE email_templates SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
        return true;
    }

    static async getCustomTypes() {
        const [rows] = await db.execute('SELECT type_name FROM email_template_types ORDER BY created_at ASC');
        return rows.map(r => r.type_name);
    }

    static async addCustomType(typeName) {
        await db.execute('INSERT INTO email_template_types (type_name) VALUES (?)', [typeName]);
        return true;
    }
}

// Initialize email_template_types table automatically on boot
(async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS email_template_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type_name VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ email_template_types table verified/created successfully!');
    } catch (err) {
        console.error('❌ Failed to initialize email_template_types table:', err.message);
    }
})();

module.exports = EmailTemplateModel;
