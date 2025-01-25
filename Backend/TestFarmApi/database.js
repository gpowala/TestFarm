const { Sequelize, DataTypes } = require('sequelize');
const { appSettings } = require('./appsettings');

sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: appSettings.database.sqliteDatabasePath
});

sequelize.verbose_sync = async function() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    await sequelize.sync();
    console.log('All models were synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

const Grid = sequelize.define('Grid', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  CreationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  LastUpdateTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'Grids',
  timestamps: false
});

const Host = sequelize.define('Host', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  GridId: {
    type: DataTypes.INTEGER,
    foreignKey: true,
    allowNull: false,
    references: {
      model: 'Grids',
      key: 'Id'
    }
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  Type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Hostname: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Cores: {
    type: DataTypes.SMALLINT,
    allowNull: false
  },
  RAM: {
    type: DataTypes.SMALLINT,
    allowNull: true
  },
  CreationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  LastUpdateTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'Hosts',
  timestamps: false
});

Grid.hasMany(Host, { foreignKey: 'GridId', as: 'Hosts' });
Host.belongsTo(Grid, { foreignKey: 'GridId', as: 'Grid' });

const TestRun = sequelize.define('TestsRuns', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  CreationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'TestsRuns',
  timestamps: false
});

const Test = sequelize.define('Test', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  Owner: {
    type: DataTypes.STRING,
    allowNull: true
  },
  CreationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'Tests',
  timestamps: false
});

const TestResult = sequelize.define('TestResult', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  TestRunId: {
    type: DataTypes.INTEGER,
    foreignKey: true,
    allowNull: false,
    references: {
      model: 'TestsRuns',
      key: 'Id'
    }
  },
  TestId: {
    type: DataTypes.INTEGER,
    foreignKey: true,
    allowNull: false,
    references: {
      model: 'Tests',
      key: 'Id'
    }
  },
  Status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ExecutionTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  ExecutionOutput: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  }
}, {
  tableName: 'TestsResults',
  timestamps: false
});

TestRun.hasMany(TestResult, { foreignKey: 'TestRunId', as: 'TestResults' });
TestResult.belongsTo(TestRun, { foreignKey: 'TestRunId', as: 'TestRun' });

Test.hasMany(TestResult, { foreignKey: 'TestId', as: 'TestResults' });
TestResult.belongsTo(Test, { foreignKey: 'TestId', as: 'Test' });

module.exports = {
  Grid,
  Host,
  TestRun,
  Test,
  TestResult,
  sequelize
};