console.log('Script started');
const mongoose = require('mongoose');
require('dotenv').config();
const Admin = require('./modules/adminModel');

const checkAdmins = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');
        const admins = await Admin.find({});
        console.log('Admins found:', admins.length);
        admins.forEach(a => console.log(`- ${a.username}`));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

checkAdmins();
