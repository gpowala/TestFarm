const fs = require('fs');
const path = require('path');

const appSettingsPath = path.join(__dirname, 'appsettings.json');
const appSettings = JSON.parse(fs.readFileSync(appSettingsPath, 'utf8'));

module.exports = {
    appSettings
};