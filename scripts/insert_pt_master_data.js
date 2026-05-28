
const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'rsm_db'
    });

    console.log('Connected to database.');

    try {
        // Disable foreign key checks for clean update of master data
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        // Truncate existing master tables to ensure clean state for the new structure
        console.log('Cleaning existing master data...');
        await connection.execute('TRUNCATE TABLE part_time_eligible_areas');
        await connection.execute('TRUNCATE TABLE part_time_roles');
        await connection.execute('TRUNCATE TABLE part_time_categories');

        const masterData = [
            {
                category: 'Teaching → College',
                roles: [
                    { name: 'Professor', areas: ['Salem', 'Namakkal', 'Krishnagiri', 'Dharmapuri'] },
                    { name: 'Associate Professor', areas: ['Salem', 'Namakkal', 'Krishnagiri', 'Dharmapuri'] },
                    { name: 'Assistant Professor', areas: ['Salem', 'Namakkal', 'Krishnagiri', 'Dharmapuri'] }
                ]
            },
            {
                category: 'High School/Higher Secondary School',
                roles: [
                    { name: 'PG Assistant', areas: ['Tamil Nadu'] },
                    { name: 'BT Assistant', areas: ['Tamil Nadu'] },
                    { name: 'Teacher', areas: ['Tamil Nadu'] }
                ]
            },
            {
                category: 'Polytechnic Teacher',
                roles: [
                    { name: 'Teacher', areas: ['Tamil Nadu'] }
                ]
            },
            {
                category: 'Non Teaching',
                roles: [
                    { name: 'Manager', areas: ['Tamil Nadu'] },
                    { name: 'Assistant Librarian', areas: ['Tamil Nadu'] }
                ]
            },
            {
                category: 'Others',
                roles: [
                    { name: 'Research Assistant', areas: ['Periyar University'] },
                    { name: 'Technical Assistant', areas: ['Periyar University'] }
                ]
            }
        ];

        for (const cat of masterData) {
            const [catResult] = await connection.execute(
                'INSERT INTO part_time_categories (category_name, status) VALUES (?, 1)',
                [cat.category]
            );
            const catId = catResult.insertId;
            console.log(`Inserted Category: ${cat.category} (ID: ${catId})`);

            for (const role of cat.roles) {
                const [roleResult] = await connection.execute(
                    'INSERT INTO part_time_roles (category_id, role_name, status) VALUES (?, ?, 1)',
                    [catId, role.name]
                );
                const roleId = roleResult.insertId;
                console.log(`  Inserted Role: ${role.name} (ID: ${roleId})`);

                for (const area of role.areas) {
                    await connection.execute(
                        'INSERT INTO part_time_eligible_areas (role_id, eligible_area_name, status) VALUES (?, ?, 1)',
                        [roleId, area]
                    );
                    console.log(`    Inserted Area: ${area}`);
                }
            }
        }

        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Master data insertion completed successfully.');

    } catch (err) {
        console.error('Error during insertion:', err);
    } finally {
        await connection.end();
    }
}

run();
