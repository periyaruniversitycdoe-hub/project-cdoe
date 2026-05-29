const db = require('./config/db');

(async () => {
    const targetEmail = 'afzal22122004@gmail.com';
    console.log(`Starting cleanup search for email: "${targetEmail}"...`);
    try {
        // 1. Get all tables in the database
        const [tables] = await db.query('SHOW TABLES');
        
        // Retrieve database name dynamically
        const [[dbNameRow]] = await db.query('SELECT DATABASE() as dbName');
        const dbName = dbNameRow.dbName || 'railway';
        const key = `Tables_in_${dbName}`;
        
        for (const row of tables) {
            const tableName = row[key] || Object.values(row)[0];
            
            // 2. Describe table columns to see if it has string email/username columns
            const [columns] = await db.query(`DESCRIBE \`${tableName}\``);
            
            // Filter columns to ensure they are string types and represent email or username
            const emailFields = columns
                .filter(c => {
                    const type = c.Type.toLowerCase();
                    return type.includes('char') || type.includes('text');
                })
                .map(c => c.Field)
                .filter(field => {
                    const norm = field.toLowerCase();
                    return norm === 'email' || norm === 'username' || norm.endsWith('_email') || norm.endsWith('email');
                });
            
            for (const field of emailFields) {
                // 3. Check if there are any rows matching target email
                const [countRows] = await db.query(
                    `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE \`${field}\` = ?`,
                    [targetEmail]
                );
                
                const count = countRows[0].count;
                if (count > 0) {
                    console.log(`🔍 Found ${count} matching records in table [${tableName}] under column [${field}]`);
                    
                    // 4. Delete the matching rows!
                    const [deleteResult] = await db.query(
                        `DELETE FROM \`${tableName}\` WHERE \`${field}\` = ?`,
                        [targetEmail]
                    );
                    console.log(`❌ Successfully deleted ${deleteResult.affectedRows} rows from table [${tableName}]!`);
                }
            }
        }
        console.log('✅ Cleanup search and deletion process completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database error occurred:', err.message);
        process.exit(1);
    }
})();
