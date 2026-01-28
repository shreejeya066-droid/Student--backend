const mongoose = require('mongoose');
const Teacher = require('./modules/teacherModel');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/school_management');
        console.log('Connected');
        const teachers = await Teacher.find({});
        console.log('--- TEACHERS ---');
        console.log(JSON.stringify(teachers, null, 2));
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

connectDB();
