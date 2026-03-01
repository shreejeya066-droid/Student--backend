const fs = require('fs');
try {
    const mongoose = require('mongoose');
    require('dotenv').config();

    mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    }).then(() => {
        fs.writeFileSync('node_out.txt', 'Successfully connected to MongoDB Atlas!');
        process.exit(0);
    }).catch(err => {
        fs.writeFileSync('node_out.txt', 'Connection Error: ' + err.message);
        process.exit(1);
    });
} catch (e) {
    fs.writeFileSync('node_out.txt', 'Require Error: ' + e.message);
    process.exit(1);
}
