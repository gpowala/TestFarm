const { appSettings } = require('../appsettings');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: appSettings.database.sqliteDatabasePath,
    migrationStorageTableName: 'sequelize_meta'
  },
  test: {
    dialect: 'sqlite',
    storage: appSettings.database.sqliteDatabasePath,
    migrationStorageTableName: 'sequelize_meta'
  },
  production: {
    dialect: 'sqlite',
    storage: appSettings.database.sqliteDatabasePath,
    migrationStorageTableName: 'sequelize_meta'
  }
};
