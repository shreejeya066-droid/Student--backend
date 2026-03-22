require('dotenv').config();
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

cloudinary.uploader.upload('test.pdf', {
    resource_type: 'auto',
    folder: 'student_documents'
}, (error, result) => {
    if (error) {
        console.error('Error uploading:', error);
    } else {
        fs.writeFileSync('result.txt', result.secure_url);
        console.log('Saved to result.txt');
    }
});
