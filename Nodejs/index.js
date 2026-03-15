require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS to bypass network restrictions
const express = require('express');
const cors = require('cors');
const path = require('path');
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
app.use('/api/powerbi', require('./routes/powerbiRoutes'));

// Serve Uploaded Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Handle 404 for missing files in '/uploads' (Render ephemeral disk wipes them)
app.use('/uploads', (req, res) => {
    res.status(404).send(`
        <h3>File Not Found</h3>
        <p>The requested document could not be found.</p>
        <p><strong>Note for Render Hosting:</strong> Render's free tier uses an <em>ephemeral file system</em>. This means any files uploaded to the 'uploads' folder are <strong>deleted</strong> every time the server goes to sleep or restarts.</p>
        <p>To fix this permanently, you will need to upload files to a cloud storage service like Amazon S3, Cloudinary, or Firebase Storage.</p>
    `);
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('Backend is running!');
});


