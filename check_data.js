const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); 
const mongoose = require('mongoose');
const Student = require('./modules/studentModel');
require('dotenv').config();

const test = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const students = await Student.find({}).limit(10);
        console.log('Students in DB:', JSON.stringify(students, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

test();
