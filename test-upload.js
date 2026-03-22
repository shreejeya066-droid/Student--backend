const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
async function test() {
  const form = new FormData();
  form.append('file', fs.createReadStream('test.txt'));
  try {
    const r = await axios.post('https://student-backend-osum.onrender.com/api/students/upload', form, {headers: form.getHeaders()});
    console.log(r.data);
  } catch(e) { console.error(e.message); }
}
test();
