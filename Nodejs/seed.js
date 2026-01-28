const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Admin = require('./modules/adminModel');

const seedAdmin = async () => {
    try {
        await connectDB();

        const adminExists = await Admin.findOne({ username: 'admin' });
        if (adminExists) {
            console.log('Admin already exists');
            process.exit();
        }

        await Admin.create({
            username: 'admin',
            email: 'admin@example.com',
            password: 'password', // In production, hash this!
            name: 'System Admin',
            role: 'admin',
            isFirstLogin: false
        });

        console.log('Default Admin Created: admin / password');
        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
