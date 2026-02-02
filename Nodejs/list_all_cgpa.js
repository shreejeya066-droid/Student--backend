const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/school_management');
        console.log('MongoDB Connected');

        const students = await Student.find({}, 'rollNumber firstName cgpa');
        console.log('--- ALL STUDENT CGPA SCORES ---');
        students.forEach(s => {
            console.log(`[${s.rollNumber}] ${s.firstName}: ${s.cgpa ? s.cgpa : "(empty)"}`);
        });
        console.log('-------------------------------');
        console.log(`Total Students: ${students.length}`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
