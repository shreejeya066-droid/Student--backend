const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/school_management');
        console.log('MongoDB Connected');

        // Update Jeyashree (25BIT60) to have 8.5 CGPA
        const res = await Student.updateOne(
            { rollNumber: '25BIT60' },
            { $set: { cgpa: '8.5', placementWillingness: 'Yes', programmingLanguages: 'JavaScript, Python' } }
        );

        console.log('Update Result:', res);

        // If there are other students without CGPA, give them random ones?
        // Let's just create a dummy student '25BIT99' who has 9.0 CGPA if Jeyashree is not enough

        const dummy = await Student.findOne({ rollNumber: '25BIT99' });
        if (!dummy) {
            await Student.create({
                rollNumber: '25BIT99',
                password: 'password123',
                firstName: 'Test',
                lastName: 'Topper',
                cgpa: '9.2',
                placementWillingness: 'Yes',
                programmingLanguages: 'Java, C++',
                department: 'CSE',
                yearOfStudy: 4
            });
            console.log('Created dummy student 25BIT99 with 9.2 CGPA');
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
