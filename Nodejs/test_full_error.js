const mongoose = require('mongoose');
require('dotenv').config();

console.log('Connecting to:', process.env.MONGO_URI, 'Family:', mongoose.version);

mongoose.connect(process.env.MONGO_URI, { family: 4 })
    .then(() => {
        console.log('SUCCESS');
        process.exit(0);
    })
    .catch(err => {
        console.error('FULL ERROR STRUCT:');
        console.error(err);
        if (err.reason) {
            console.error('REASON:', err.reason);
        }
        process.exit(1);
    });
