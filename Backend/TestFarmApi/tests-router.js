const { execSync } = require('child_process');
const { fs } = require('fs');

const express = require('express');
const router = express.Router();

const { appSettings } = require('./appsettings');
const { Test, TestRun, TestResult, Repository, sequelize } = require('./database');

cloneSparseRepository = (repository, localRepositoryDir) => {
  if (!fs.existsSync(localRepositoryDir))
    fs.mkdirSync(localRepositoryDir, { recursive: true });

  let connectionString = `https://${repository.User}:${repository.Token}@${repository.Url.replace(/^https?:\/\//, '')}`;
  execSync(`git_clone_sparse.bat "${connectionString}" "${localRepositoryDir}" "testfarm"`, { stdio: 'pipe' });
}

requireFileExists = (testsConfigPath) => {
  if (!fs.existsSync(testsConfigPath))
    throw Error(`${testsConfigPath} file not found in repository`);
}

requireRepositoryExists = (repository) => {
  if (repository == null)
    throw Error('Repository does not exist');
}

router.post('tests/schedule-run', async (req, res) => {
  const { RepositoryName, SuiteName, GridName, TestRunName } = req.body;
  const localRepositoryDir = `${appSettings.storage.repositories}/${RepositoryName}`;  
  
  try {
    let repository = await Repository.findOne({ where: { Name: RepositoryName } });
    requireRepositoryExists(repository);

    cloneSparseRepository(repository, localRepositoryDir);
    
    const testsConfigPath = `${localRepositoryDir}/tests.testfarm`;
    requireFileExists(testsConfigPath);

    const testsConfig = JSON.parse(fs.readFileSync(testsConfigPath, 'utf8'));
    const requestedSuiteConfig = testsConfig.suites.find(suite => suite.name === SuiteName);
    const requestedTestsPaths = requestedSuiteConfig ? requestedSuiteConfig.tests : [];

    let testRun = await TestRun.create({
      RepositoryName: RepositoryName,
      SuiteName: SuiteName,
      GridName: GridName,
      Name: TestRunName,
      CreationTimestamp: new Date()
    });

    requestedTestsPaths.forEach(async (testPath) => {
      try {
        const testConfigPath = `${localRepositoryDir}/${testPath}/test.testfarm`;
        requireFileExists(testConfigPath);

        let testConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));

        let test = await Test.findOne({ where: {RepositoryName: RepositoryName, SuiteName: SuiteName, Name: testConfig.name} })
                ?? await Test.create({ RepositoryName: RepositoryName, SuiteName: SuiteName, Name: testConfig.name, Owner: null, CreationTimestamp: new Date() });

        await TestResult.create({ TestRunId: testRun.Id, TestId: test.Id, Status: 'queued', ExecutionStartTimestamp: null, ExecutionEndTimestamp: null, ExecutionOutput: null });
      }
      catch (error) {
        console.error(`Failed to register test: ${error}`);
      }
    });

    res.status(201).json(testRun);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  } finally {
    if (fs.existsSync(localRepositoryDir))
      fs.rmdirSync(localRepositoryDir, { recursive: true });
  }
});

router.get('tests/get-next-test', async (req, res) => {
  const { GridName } = req.query;
  
  try {
    const result = await sequelize.transaction(async (t) => {
      const [updatedCount, updatedTestResults] = await TestResult.update(
        {
          Status: 'running',
          ExecutionStartTimestamp: new Date()
        },
        {
          where: {
            Status: 'queued',
            '$TestRun.GridName$': GridName
          },
          include: [{
            model: TestRun,
            as: 'TestRun'
          }],
          order: [
            [{model: TestRun, as: 'TestRun'}, 'CreationTimestamp', 'ASC']
          ],
          limit: 1,
          returning: true,
          transaction: t
        }
      );

      if (updatedCount === 0) {
        return null;
      }

      return TestResult.findByPk(updatedTestResults[0].Id, {
        include: [
          {
            model: TestRun,
            as: 'TestRun'
          },
          {
            model: Test,
            as: 'Test',
            include: [{
              model: Repository,
              as: 'Repository'
            }]
          }
        ],
        transaction: t
      });
    });

    if (!result) {
      return res.status(404).json({ message: 'No queued tests found for this grid' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error getting next test:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;