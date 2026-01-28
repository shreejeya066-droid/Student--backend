const Admin = require('../modules/adminModel');

// Login Admin
const loginAdmin = async (req, res) => {
    try {
        const { username, password } = req.body; // Can typically log in with username or email

        // Find by username
        const admin = await Admin.findOne({ username });

        if (admin && admin.password === password) {
            res.json({
                _id: admin._id,
                username: admin.username,
                email: admin.email,
                role: 'admin',
                isFirstLogin: admin.isFirstLogin
            });
        } else {
            if (!admin) return res.status(404).json({ message: 'Admin not found' });
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Register Admin (For Initial Setup)
const registerAdmin = async (req, res) => {
    try {
        const { username, email, password, name, mobile } = req.body;

        const adminExists = await Admin.findOne({ $or: [{ username }, { email }] });
        if (adminExists) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        const admin = await Admin.create({
            username,
            email,
            password,
            name,
            mobile,
            isFirstLogin: true
        });

        if (admin) {
            res.status(201).json({
                _id: admin._id,
                username: admin.username,
                email: admin.email,
                name: admin.name,
                role: 'admin'
            });
        } else {
            res.status(400).json({ message: 'Invalid admin data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update Admin Profile (Password Reset, etc.)
const updateAdminProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const admin = await Admin.findByIdAndUpdate(id, updates, { new: true });

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.json({
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            role: 'admin',
            isFirstLogin: admin.isFirstLogin
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    loginAdmin,
    registerAdmin,
    updateAdminProfile
};
