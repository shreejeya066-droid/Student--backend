const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/studentsController');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'student_documents',
        allowed_formats: ['jpg', 'png', 'jpeg', 'pdf']
    }
});

const upload = multer({ storage });

// File Upload Route
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    // req.file.path contains the secure Cloudinary URL
    res.json({ filename: req.file.path });
});

// Search / Query Route
router.get('/analytics', studentsController.getAnalytics);
router.get('/powerbi', studentsController.getPowerBIData);
router.post('/query', studentsController.naturalLanguageQuery);
router.post('/login', studentsController.loginStudent);
router.post('/check-status', studentsController.checkStudentStatus);
router.post('/register', studentsController.registerStudent);
router.get('/:rollNumber', studentsController.getStudentProfile);
router.put('/:rollNumber', studentsController.updateStudentProfile);
router.delete('/:rollNumber', studentsController.deleteStudent);
router.get('/', studentsController.getAllStudents);

module.exports = router;
