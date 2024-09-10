var Service = require('node-windows').Service;

const fs = require('fs');
const path = require('path');

const appSettingsPath = path.join(__dirname, 'appsettings.json');
const appSettings = JSON.parse(fs.readFileSync(appSettingsPath, 'utf8'));

var svc = new Service({
    name: appSettings.service.name,
    description: appSettings.service.description,
    script: appSettings.service.serverScriptPath
});

svc.on('install', function() {
    svc.start();
});

svc.install();