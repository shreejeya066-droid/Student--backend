require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const testQuery = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const query = 'Show me students interested in Drawing';
        const regex = /interested in\s+([a-zA-Z0-9\s]+)/i;
        const match = query.match(regex);
        const keyword = match ? match[1].trim() : '';

        console.log(`Testing query: "${query}"`);
        console.log(`Extracted keyword: "${keyword}"`);

        const students = await Student.find({
            interest: { $regex: keyword, $options: 'i' }
        });

        console.log(`Found ${students.length} students:`);
        students.forEach(s => console.log(`- ${s.firstName} ${s.lastName} (${s.rollNumber}): ${s.interest}`));

        process.exit(0);
    } catch (error) {
        console.error('Error during test query:', error);
        process.exit(1);
    }
};

testQuery();
