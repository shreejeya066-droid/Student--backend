const mongoose = require('mongoose');
require('dotenv').config();

const testConnect = async () => {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB is running and reachable!');
        process.exit(0);
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    }
};

testConnect();
