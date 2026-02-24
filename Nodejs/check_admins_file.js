const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();
const Admin = require('./modules/adminModel');

const checkAdmins = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const admins = await Admin.find({});
        fs.writeFileSync('admin_check_result.txt', `Admins found: ${admins.length}\n` + admins.map(a => a.username).join('\n'));
        process.exit(0);
    } catch (err) {
        fs.writeFileSync('admin_check_result.txt', `Error: ${err.message}`);
        process.exit(1);
    }
};

checkAdmins();
