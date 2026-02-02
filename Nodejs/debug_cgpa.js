const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/school_management');
        console.log('MongoDB Connected');

        const students = await Student.find({}, 'rollNumber cgpa firstName lastName');
        console.log('--- STUDENT CGPA DATA ---');
        students.forEach(s => {
            console.log(`${s.rollNumber} (${s.firstName}): cgpa="${s.cgpa}" (Type: ${typeof s.cgpa})`);
        });
        console.log('-------------------------');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
