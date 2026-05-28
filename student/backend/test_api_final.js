const http = require('http');

http.get('http://localhost:5000/api/settings', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('HEADERS:', res.headers);
        console.log('BODY:', data);
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
