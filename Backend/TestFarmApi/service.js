var Service = require('node-windows').Service;
var svc = new Service({
    name: 'TestFarmAPI',
    description: 'TestFarm backend API.',
    script: ''
});

svc.on('install', function() {
    svc.start();
});

svc.install();