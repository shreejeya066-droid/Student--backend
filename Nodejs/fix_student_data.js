const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/school_management');
        console.log('MongoDB Connected');

        const students = await Student.find({});

        let updatedCount = 0;

        for (const s of students) {
            let updates = {};
            let needsUpdate = false;

            // 1. Fix CGPA if missing
            if (!s.cgpa || s.cgpa === '') {
                // Generate random CGPA between 7.5 and 9.5
                const randomCGPA = (Math.random() * (9.5 - 7.5) + 7.5).toFixed(1);
                updates.cgpa = randomCGPA;
                needsUpdate = true;
            }

            // 2. Fix Placement Willingness
            if (!s.placementWillingness) {
                updates.placementWillingness = 'Yes';
                needsUpdate = true;
            }

            // 3. Fix Programming Languages (Random subset)
            if (!s.programmingLanguages) {
                const langs = ['Java', 'Python', 'JavaScript', 'C++', 'SQL'];
                // Pick 2 random
                const shuffled = langs.sort(() => 0.5 - Math.random());
                updates.programmingLanguages = shuffled.slice(0, 2).join(', ');
                needsUpdate = true;
            }

            // 4. Fix Department if missing
            if (!s.department) {
                updates.department = 'CSE'; // Default to CSE for now
                needsUpdate = true;
            }

            // 5. Fix Interest
            if (!s.interest || s.interest === '') {
                const interests = ['Drawing', 'Coding', 'Music', 'Sports', 'Reading'];
                updates.interest = interests[Math.floor(Math.random() * interests.length)];
                needsUpdate = true;
            }

            if (needsUpdate) {
                await Student.updateOne({ _id: s._id }, { $set: updates });
                console.log(`Updated ${s.firstName} (${s.rollNumber}): CGPA=${updates.cgpa || s.cgpa}, Skills=${updates.programmingLanguages || s.programmingLanguages}`);
                updatedCount++;
            } else {
                console.log(`Skipped ${s.firstName} (${s.rollNumber}): Already has data (CGPA: ${s.cgpa})`);
            }
        }

        console.log(`\nOperation Complete. Updated ${updatedCount} students.`);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
