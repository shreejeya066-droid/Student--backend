const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();
const Admin = require('./modules/adminModel');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (adminExists) {
            fs.writeFileSync('seed_log.txt', 'Admin already exists');
        } else {
            await Admin.create({
                username: 'admin',
                email: 'admin@example.com',
                password: 'password', // Default password
                name: 'System Admin',
                role: 'admin',
                isFirstLogin: false
            });
            fs.writeFileSync('seed_log.txt', 'Default Admin Created: admin / password');
        }
        process.exit(0);
    } catch (error) {
        fs.writeFileSync('seed_log.txt', `Error: ${error.message}`);
        process.exit(1);
    }
};

seedAdmin();
