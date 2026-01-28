const http = require('http');
const fs = require('fs');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/students',
    method: 'GET',
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        fs.writeFileSync('students_dump.json', data);
        console.log('Dumped to students_dump.json');
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.end();
