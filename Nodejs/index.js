require('dotenv').config();
const express = require('express');
const cors = require('cors');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database and Start Server
const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Middleware
app.use(cors()); // Enable CORS to allow requests from frontend
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/settings', require('./routes/systemSettingsRoutes'));

// Serve Uploaded Files
app.use('/uploads', express.static('uploads'));

// Root endpoint
app.get('/', (req, res) => {
    res.send('Backend is running!');
});


