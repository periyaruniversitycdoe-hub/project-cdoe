const http = require('http');

const post = (path, body) => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
        hostname: 'localhost', port: 5000,
        path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(options, res => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
});

const get = (path) => new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 5000, path }, res => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
});

(async () => {
    console.log('\n========== BACKEND API TESTS ==========\n');

    // Test 1: Settings
    console.log('🔵 TEST 1: GET /api/settings');
    const s = await get('/api/settings');
    console.log(`   Status: ${s.status}`);
    console.log(`   University: ${s.body?.university_name_english}`);
    console.log(`   NAAC: ${s.body?.naac_details}`);
    console.log('   ✅ PASS\n');

    // Test 2: Dropdowns
    const dropdownTests = ['exam_centers','subjects','categories','districts','genders','communities'];
    for (const d of dropdownTests) {
        const r = await get(`/api/dropdowns/${d}`);
        console.log(`🔵 TEST: GET /api/dropdowns/${d}`);
        console.log(`   Status: ${r.status} | Count: ${r.body.length} items`);
        console.log(`   Items: ${r.body.map(i=>i.name).join(', ')}`);
        console.log('   ✅ PASS\n');
    }

    // Test 3: Register
    console.log('🔵 TEST: POST /api/auth/register');
    const reg = await post('/api/auth/register', { full_name: 'Majeed Test', email: 'majeedtest2@test.com', password: 'Test1234!' });
    console.log(`   Status: ${reg.status}`);
    console.log(`   Message: ${reg.body.message}`);
    console.log(`   Application ID: ${reg.body.application_id}`);
    if (reg.status === 201) console.log('   ✅ PASS\n');
    else console.log('   ⚠️  Already registered or failed\n');

    // Test 4: Login
    console.log('🔵 TEST: POST /api/auth/login');
    const login = await post('/api/auth/login', { username: 'majeedtest2@test.com', password: 'Test1234!' });
    console.log(`   Status: ${login.status}`);
    console.log(`   Message: ${login.body.message}`);
    if (login.body.data) {
        console.log(`   Token: ${login.body.data.token.slice(0, 30)}...`);
        console.log(`   User: ${login.body.data.user.full_name} | App ID: ${login.body.data.user.application_id}`);
    }
    if (login.status === 200) console.log('   ✅ PASS\n');
    else console.log('   ❌ FAIL\n');

    console.log('========== ALL TESTS COMPLETE ==========\n');
})();
