const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/school_management');
        console.log('MongoDB Connected');

        // Remove the dummy user 'Test Topper' (25BIT99)
        const res = await Student.findOneAndDelete({ rollNumber: '25BIT99' });

        if (res) {
            console.log('Successfully removed dummy student: Test Topper (25BIT99)');
        } else {
            console.log('Test Topper not found or already removed.');
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
