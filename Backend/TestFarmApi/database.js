const { Sequelize, DataTypes } = require('sequelize');
const { appSettings } = require('./appsettings');
const { BuildStatus } = require('azure-devops-node-api/interfaces/BuildInterfaces');

let sequelize = new Sequelize({
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
    logging: console.log
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

const MicroJobsQueue = sequelize.define('MicroJobsQueue', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  // Job type (e.g. test, bench, load, unit)
  Type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  GridName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Job run ID (can be benchmarks run, tests run etc.). Can be used to correlate with other job-specific data.
  RunId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // Job result ID (can be benchmarks result, tests result etc.). Can be used to easily find job results which is typically used as test description.
  ResultId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'MicroJobsQueue',
  timestamps: false
});

const ArtifactDefinition = sequelize.define('ArtifactDefinition', {
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
  InstallScript : {
    type: DataTypes.TEXT,
    allowNull: false
  },
  Tags: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('Tags');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('Tags', value ? JSON.stringify(value) : null);
    }
  }
}, {
  tableName: 'ArtifactsDefinitions',
  timestamps: false
});

const Artifact = sequelize.define('Artifact', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  ArtifactDefinitionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ArtifactsDefinitions',
      key: 'Id'
    }
  },
  BuildId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  BuildName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Repository: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Branch: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Revision: {
    type: DataTypes.STRING,
    allowNull: false
  },
  WorkItemUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  BuildPageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Tags: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('Tags');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('Tags', value ? JSON.stringify(value) : null);
    }
  },
  CreationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'Artifacts',
  timestamps: false
});

ArtifactDefinition.hasMany(Artifact, { foreignKey: 'ArtifactDefinitionId', as: 'Artifacts' });
Artifact.belongsTo(ArtifactDefinition, { foreignKey: 'ArtifactDefinitionId', as: 'ArtifactDefinition' });


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
    allowNull: false,
    unique: true
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
  RepositoryName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  SuiteName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  GridName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  TeamsNotificationUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  OverallCreationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  OverallStatus: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Artifacts: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('Artifacts');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('Artifacts', value ? JSON.stringify(value) : null);
    }
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
  RepositoryName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  SuiteName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false
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
  ExecutionStartTimestamp: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ExecutionEndTimestamp: {
    type: DataTypes.DATE,
    allowNull: true
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

const Repository = sequelize.define('Repository', {
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
  Url: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  User: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Token: {
    type: DataTypes.STRING,
    allowNull: false
  },
  IsActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  }
}, {
  tableName: 'Repositories',
  timestamps: false
});

const TestResultDiff = sequelize.define('TestResultDiff', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  TestResultId: {
    type: DataTypes.INTEGER,
    foreignKey: true,
    allowNull: false,
    references: {
      model: 'TestsResults',
      key: 'Id'
    }
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  Report: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  }
}, {
  tableName: 'TestsResultsDiffs',
  timestamps: false
});

TestResult.hasMany(TestResultDiff, { foreignKey: 'TestResultId', as: 'TestsResultsDiffs' });
TestResultDiff.belongsTo(TestResult, { foreignKey: 'TestResultId', as: 'TestResult' });

const TestResultsTempDirArchive = sequelize.define('TestResultsTempDirArchive', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  TestResultId: {
    type: DataTypes.INTEGER,
    foreignKey: true,
    allowNull: false,
    references: {
      model: 'TestsResults',
      key: 'Id'
    }
  },
  ArchivePath: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'TestResultsTempDirArchives',
  timestamps: false
});

TestResult.hasOne(TestResultsTempDirArchive, { foreignKey: 'TestResultId', as: 'TestResultsTempDirArchive' });
TestResultsTempDirArchive.belongsTo(TestResult, { foreignKey: 'TestResultId', as: 'TestResult' });

const BenchmarksRun = sequelize.define('BenchmarksRun', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  RepositoryName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  SuiteName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  GridName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  TeamsNotificationUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  OverallCreationTimestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  OverallStatus: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Artifacts: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('Artifacts');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('Artifacts', value ? JSON.stringify(value) : null);
    }
  }
}, {
  tableName: 'BenchmarksRuns',
  timestamps: false
});

const Benchmark = sequelize.define('Benchmark', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  RepositoryName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  SuiteName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  Name: {
    type: DataTypes.STRING,
    allowNull: false
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
  tableName: 'Benchmarks',
  timestamps: false
});

const BenchmarkResult = sequelize.define('BenchmarkResult', {
  Id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  BenchmarksRunId: {
    type: DataTypes.INTEGER,
    foreignKey: true,
    allowNull: false,
    references: {
      model: 'BenchmarksRuns',
      key: 'Id'
    }
  },
  BenchmarkId: {
    type: DataTypes.INTEGER,
    foreignKey: true,
    allowNull: false,
    references: {
      model: 'Benchmarks',
      key: 'Id'
    }
  },
  Status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ExecutionStartTimestamp: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ExecutionEndTimestamp: {
    type: DataTypes.DATE,
    allowNull: true
  },
  Results: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  }
}, {
  tableName: 'BenchmarksResults',
  timestamps: false
});

BenchmarksRun.hasMany(BenchmarkResult, { foreignKey: 'BenchmarksRunId', as: 'BenchmarkResult' });
BenchmarkResult.belongsTo(BenchmarksRun, { foreignKey: 'BenchmarksRunId', as: 'BenchmarksRun' });

Benchmark.hasMany(BenchmarkResult, { foreignKey: 'BenchmarkId', as: 'BenchmarkResult' });
BenchmarkResult.belongsTo(Benchmark, { foreignKey: 'BenchmarkId', as: 'Benchmark' });

module.exports = {
  ArtifactDefinition,
  Artifact,
  Grid,
  Host,
  MicroJobsQueue,
  TestRun,
  Test,
  TestResult,
  Repository,
  TestResultDiff,
  TestResultsTempDirArchive,
  BenchmarksRun,
  Benchmark,
  BenchmarkResult,
  BenchmarkResultJson,
  sequelize
};