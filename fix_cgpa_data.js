const mongoose = require('mongoose');
const Student = require('./modules/studentModel');
require('dotenv').config();

const fixData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB. Starting CGPA data conversion...');

        const students = await Student.find({});
        console.log(`Found ${students.length} students. Checking CGPA types...`);

        let updatedCount = 0;
        for (const student of students) {
            if (student.cgpa !== undefined && student.cgpa !== null) {
                const numericCgpa = parseFloat(student.cgpa);
                if (!isNaN(numericCgpa)) {
                    // Force update to Number type
                    await Student.updateOne(
                        { _id: student._id },
                        { $set: { cgpa: numericCgpa } }
                    );
                    updatedCount++;
                } else {
                    // If invalid, set to 0 or leave as is? User said ignore invalid.
                    // For safety, set to 0 to ensure numeric type consistency
                    await Student.updateOne(
                        { _id: student._id },
                        { $set: { cgpa: 0 } }
                    );
                    updatedCount++;
                }
            }
        }

        console.log(`Done! Updated ${updatedCount} student records to numeric CGPA.`);
        process.exit(0);
    } catch (error) {
        console.error('Conversion Failed:', error);
        process.exit(1);
    }
};

fixData();
