const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Connection URL - using localhost for local MongoDB instance
        // You can change this to your MongoDB Atlas connection string if using cloud
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // These options are no longer necessary in Mongoose 6+, but keeping for reference if using older versions
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
