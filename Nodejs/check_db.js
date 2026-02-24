require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const checkCount = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await Student.countDocuments();
        console.log(`Student count: ${count}`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkCount();
