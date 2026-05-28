
const http = require('http');

function post(url, data) {
    const parsed = new URL(url);
    const body = JSON.stringify(data);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let resBody = '';
            res.on('data', (chunk) => resBody += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(resBody) }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function put(url, data, token) {
    const parsed = new URL(url);
    const body = JSON.stringify(data);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Authorization': `Bearer ${token}`
            }
        }, (res) => {
            let resBody = '';
            res.on('data', (chunk) => resBody += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(resBody) }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function testUpdate() {
    try {
        console.log('Logging in...');
        const login = await post('http://localhost:5001/api/auth/login', {
            email: 'admin@periyar.edu',
            password: 'admin123'
        });
        const token = login.data.token;
        console.log('Token obtained.');

        console.log('Updating settings...');
        const resp = await put('http://localhost:5001/api/settings/update', {
            university_name_english: 'PERIYAR UNIVERSITY',
            apply_now_open: '2025-12-18T18:30:00.000Z',
            apply_now_close: '2026-01-22T18:30:00.000Z'
        }, token);
        console.log('Update Status:', resp.status);
        console.log('Update Response:', resp.data);
    } catch (err) {
        console.error('Update Failed:', err.message);
    }
}

testUpdate();
