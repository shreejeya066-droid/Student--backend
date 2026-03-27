const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:/Learn/Nodejs/.env' });
const Student = require('./modules/studentModel');

async function checkStudent() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const student = await Student.findOne({ rollNumber: '23BIT23' });
        if (student) {
            console.log('Found student 23BIT23');
            console.log('Raw data:', JSON.stringify(student, null, 2));
            console.log('Hobbies type:', typeof student.hobbies);
            console.log('Hobbies value:', student.hobbies);
        } else {
            console.log('Student 23BIT23 not found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkStudent();
