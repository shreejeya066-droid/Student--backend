const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:/Learn/Nodejs/.env' });
const Student = require('./modules/studentModel');

async function debug() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const students = await Student.find({});
        console.log(`Total students: ${students.length}`);
        
        const matches = await Student.find({
            $or: [
                { firstName: /cooking/i },
                { lastName: /cooking/i },
                { hobbies: /cooking/i },
                { interests: /cooking/i },
                { skills: /cooking/i }
            ]
        });
        
        console.log(`Matches for "cooking": ${matches.length}`);
        if (matches.length > 0) {
            console.log('Sample match:', JSON.stringify(matches[0], null, 2));
        } else {
            console.log('No matches found for "cooking" in standard fields.');
            // Check all text fields of one student
            if (students.length > 0) {
                console.log('Sample student keys:', Object.keys(students[0].toObject()));
                console.log('Sample student hobbies:', students[0].hobbies);
                console.log('Sample student interests:', students[0].interests);
            }
        }
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
