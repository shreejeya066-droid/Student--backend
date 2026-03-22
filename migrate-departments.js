require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./modules/studentModel');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {});
        console.log(`MongoDB Connected for Migration: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const migrate = async () => {
    await connectDB();

    console.log('🔄 Starting Department Migration...');

    try {
        // 1. CSE -> CS
        const cseResult = await Student.updateMany(
            { department: { $regex: /^cse$/i } },
            { $set: { department: 'CS' } }
        );
        console.log(`✅ Migrated CSE to CS: ${cseResult.modifiedCount} students`);

        // 2. ECE, EEE, MECH, etc. -> Languages (as grouped in filter)
        const langResult = await Student.updateMany(
            { department: { $in: [/ece/i, /eee/i, /mech/i, /civil/i] } },
            { $set: { department: 'Languages' } }
        );
        console.log(`✅ Migrated Technical groups to Languages: ${langResult.modifiedCount} students`);

        console.log('\n--- Migration Complete ---');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
};

migrate();
