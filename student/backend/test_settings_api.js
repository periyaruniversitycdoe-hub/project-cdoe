
const axios = require('axios');

async function testUpdate() {
    try {
        console.log('Logging in...');
        const login = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@periyar.edu',
            password: 'admin123'
        });
        const token = login.data.token;
        console.log('Token obtained.');

        console.log('Updating settings...');
        const resp = await axios.put('http://localhost:5001/api/settings/update', {
            university_name_english: 'PERIYAR UNIVERSITY'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Update Success:', resp.data);
    } catch (err) {
        console.error('Update Failed:', err.response ? err.response.data : err.message);
    }
}

testUpdate();
