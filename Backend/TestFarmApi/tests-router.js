const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize'); // Add Sequelize import

const express = require('express');
const router = express.Router();

const { appSettings } = require('./appsettings');
const { Test, TestRun, TestResult, TestResultDiff, Repository, sequelize } = require('./database');
const { sendTestRunCompletionMessageToTeams } = require('./notifications');

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

router.post('/schedule-run', async (req, res) => {
  console.log('Scheduling test run:', req.body);
  
  const { RepositoryName, SuiteName, GridName, TestRunName, TeamsNotificationUrl } = req.body;
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
      CreationTimestamp: new Date(),
      TeamsNotificationUrl: TeamsNotificationUrl
    });

    requestedTestsPaths.forEach(async (testPath) => {
      try {
        const testConfigPath = `${localRepositoryDir}/${testPath}/test.testfarm`;
        requireFileExists(testConfigPath);

        let testConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));

        let test = await Test.findOne({ where: {RepositoryName: RepositoryName, SuiteName: SuiteName, Path: testPath, Name: testConfig.name} })
                ?? await Test.create({ RepositoryName: RepositoryName, SuiteName: SuiteName, Path: testPath,  Name: testConfig.name, Owner: testConfig.owner, CreationTimestamp: new Date() });

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

router.get('/get-next-test', async (req, res) => {
  const { GridName } = req.query;
  
  try {
    // Use a transaction with the highest isolation level to prevent race conditions
    const result = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      // First find all TestRun IDs that match our GridName
      const matchingTestRuns = await TestRun.findAll({
        attributes: ['Id'],
        where: {
          GridName: GridName
        },
        transaction: t
      });
      
      if (matchingTestRuns.length === 0) {
        return null;
      }
      
      const testRunIds = matchingTestRuns.map(run => run.Id);
      
      // Find a single test result that is queued and belongs to our grid
      const queuedTest = await TestResult.findOne({
        where: {
          Status: 'queued',
          TestRunId: testRunIds
        },
        order: [
          ['Id', 'ASC'] // Select the oldest queued test
        ],
        lock: t.LOCK.UPDATE, // Add row-level locking to prevent other transactions from changing this row
        transaction: t
      });
      
      if (!queuedTest) {
        return null;
      }
      
      // Update the status atomically within the transaction
      queuedTest.Status = 'running';
      queuedTest.ExecutionStartTimestamp = new Date();
      await queuedTest.save({ transaction: t });
      
      // Retrieve the complete test information with associations
      return TestResult.findByPk(queuedTest.Id, {
        include: [
          {
            model: TestRun,
            as: 'TestRun'
          },
          {
            model: Test,
            as: 'Test'
          }
        ],
        transaction: t
      }).then(async (testResult) => {
        // Fetch the repository separately based on the RepositoryName
        if (testResult && testResult.TestRun && testResult.TestRun.RepositoryName) {
          const repository = await Repository.findOne({
            where: { 
              Name: testResult.TestRun.RepositoryName 
            },
            transaction: t
          });
          
          // Add repository info to the response
          if (repository) {
            const plainResult = testResult.get({ plain: true });
            plainResult.Repository = repository.get({ plain: true });
            return plainResult;
          }
        }
        return testResult;
      });
    });

    if (!result) {
      return res.status(404).json({ message: 'No queued tests found for this grid' });
    }
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error getting next test:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

router.post('/complete-test', async (req, res) => {
  const { TestResultId, Status, ExecutionOutput } = req.body;
  
  try {
    const testResult = await TestResult.findByPk(TestResultId);
    
    if (!testResult) {
      return res.status(404).json({ message: 'Test result not found' });
    }
    
    testResult.Status = Status;
    testResult.ExecutionEndTimestamp = new Date();
    testResult.ExecutionOutput = ExecutionOutput;
    await testResult.save();

    // Check if all tests in this TestRun are completed
    const testRun = await TestRun.findByPk(testResult.TestRunId);
    const pendingTests = await TestResult.count({
      where: {
        TestRunId: testResult.TestRunId,
        Status: ['queued', 'running']
      }
    });

    // If no more pending tests, send notification
    if (pendingTests === 0 && testRun.TeamsNotificationUrl) {
      sendTestRunCompletionMessageToTeams(testResult.TestRunId);
    }
    
    res.status(200).json(testResult);
  } catch (error) {
    console.error('Error completing test:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

const multer = require('multer');
const zlib = require('zlib');

const uploadDiff = multer({ dest: 'uploads/' });

router.post('/upload-diff', uploadDiff.single('report'), async (req, res) => {
  const { TestResultId, Name, Status } = req.body;
  const reportFile = req.file;

  try {
    const testResult = await TestResult.findByPk(TestResultId);

    if (!testResult) {
      return res.status(404).json({ message: 'Test result not found' });
    }

    let reportContent = null;
    if (reportFile) {
      const filePath = reportFile.path;
      const fileContent = fs.readFileSync(filePath, 'utf8');
      reportContent = zlib.gzipSync(fileContent).toString('base64');
      fs.unlinkSync(filePath); // Clean up the uploaded file
    }

    const testResultDiff = await TestResultDiff.create({
      TestResultId,
      Name,
      Status,
      Report: reportContent
    });

    res.status(201).json(testResultDiff);
  } catch (error) {
    console.error('Error uploading report:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, appSettings.storage.resultsTempDirArchives); // Set the destination directory
  },
  filename: (req, file, cb) => {
    if (!req.body.TestResultId) {
      return cb(new Error('TestResultId is required in the request body'));
    }
    const fileName = `${req.body.TestResultId}.7z`; // Use TestResultId to generate the filename
    cb(null, fileName);
  }
});

const uploadTempDirArchive = multer({ 
  storage,
  limits: { fileSize: 1024 * 1024 * 100 } // 100MB file size limit
}).fields([{ name: 'archive', maxCount: 1 }]);

router.post('/upload-temp-dir-archive', uploadTempDirArchive, async (req, res) => {
  const { TestResultId } = req.body;

  try {
    const testResult = await TestResult.findByPk(TestResultId);

    if (!testResult) {
      return res.status(404).json({ message: 'Test result not found' });
    }

    const archivePath = path.join(appSettings.storage.resultsTempDirArchives, `${TestResultId}.7z`);

    const testResultTempDirArchive = await TestResultsTempDirArchive.create({
      TestResultId,
      ArchivePath: archivePath
    });

    res.status(201).json(testResultTempDirArchive);
  } catch (error) {
    console.error('Error uploading temp dir archive:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

router.get('/download-temp-dir-archive/:TestResultId', async (req, res) => {
  const { TestResultId } = req.params;
  
  try {
    const testResult = await TestResult.findByPk(TestResultId);
    
    if (!testResult) {
      return res.status(404).json({ message: 'Test result not found' });
    }
    
    const archivePath = path.join(appSettings.storage.resultsTempDirArchives, `${TestResultId}.7z`);
    
    if (!fs.existsSync(archivePath)) {
      return res.status(404).json({ message: 'Archive file not found' });
    }
    
    res.download(archivePath);
  } catch (error) {
    console.error('Error downloading temp dir archive:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

module.exports = router;