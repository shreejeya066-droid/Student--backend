const SystemSettings = require('../modules/systemSettingsModel');

// Get Settings (e.g., allowedAdmissionYears)
const getSettings = async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await SystemSettings.findOne({ key });

        if (setting) {
            res.json(setting.value);
        } else {
            // Default fallbacks if not found in DB
            if (key === 'allowed_years') {
                return res.json(['19', '20', '21', '22', '23', '24', '25', '26']);
            }
            res.status(404).json({ message: 'Setting not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update Settings
const updateSettings = async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        const setting = await SystemSettings.findOneAndUpdate(
            { key },
            { key, value },
            { new: true, upsert: true } // Create if doesn't exist
        );

        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
