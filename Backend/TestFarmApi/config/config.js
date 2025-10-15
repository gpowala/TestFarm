const { appSettings } = require('../appsettings');

module.exports = {
  development: {
    dialect: 'mssql',
    host: appSettings.database.host,
    database: appSettings.database.database,
    username: appSettings.database.username,
    password: appSettings.database.password,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 60000,
        requestTimeout: 60000
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000
    },
    logging: console.log,
    migrationStorageTableName: 'sequelize_meta'
  },
  test: {
    dialect: 'mssql',
    host: appSettings.database.host,
    database: appSettings.database.database,
    username: appSettings.database.username,
    password: appSettings.database.password,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 60000,
        requestTimeout: 60000
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000
    },
    logging: console.log,
    migrationStorageTableName: 'sequelize_meta'
  },
  production: {
    dialect: 'mssql',
    host: appSettings.database.host,
    database: appSettings.database.database,
    username: appSettings.database.username,
    password: appSettings.database.password,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 60000,
        requestTimeout: 60000
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000
    },
    logging: false,
    migrationStorageTableName: 'sequelize_meta'
  }
};