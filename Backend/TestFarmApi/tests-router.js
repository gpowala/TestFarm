const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize'); // Add Sequelize import

const express = require('express');
const router = express.Router();

const { appSettings } = require('./appsettings');
const { Artifact, MicroJobsQueue, Benchmark, BenchmarksRun, BenchmarkResult, Test, TestRun, TestResult, TestResultDiff, TestResultsTempDirArchive, Repository, sequelize } = require('./database');
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

router.post('/schedule-benchmarks-run', async (req, res) => {
  console.log('Scheduling benchmarks run:', req.body);

  const { RepositoryName, SuiteName, GridName, TestRunName, Artifacts, TeamsNotificationUrl } = req.body;
  const localRepositoryDir = `${appSettings.storage.repositories}/${RepositoryName}`;  
  
  try {
    let repository = await Repository.findOne({ where: { Name: RepositoryName } });
    requireRepositoryExists(repository);

    cloneSparseRepository(repository, localRepositoryDir);
    
    const benchmarksConfigPath = `${localRepositoryDir}/benchmarks.testfarm`;
    requireFileExists(benchmarksConfigPath);

    const benchmarksConfig = JSON.parse(fs.readFileSync(benchmarksConfigPath, 'utf8'));
    const requestedSuiteConfig = benchmarksConfig.suites.find(suite => suite.name === SuiteName);
    const requestedBenchmarksPaths = requestedSuiteConfig ? requestedSuiteConfig.benchmarks : [];

    let benchmarksRun = await BenchmarksRun.create({
      RepositoryName: RepositoryName,
      SuiteName: SuiteName,
      GridName: GridName,
      Name: TestRunName,
      TeamsNotificationUrl: TeamsNotificationUrl,
      Artifacts: Artifacts,
      OverallCreationTimestamp: new Date(),
      OverallStatus: 'queued'
    });

    requestedBenchmarksPaths.forEach(async (benchmarkPath) => {
      try {
        const benchmarkConfigPath = `${localRepositoryDir}/${benchmarkPath}/benchmark.testfarm`;
        requireFileExists(benchmarkConfigPath);

        let benchmarkConfig = JSON.parse(fs.readFileSync(benchmarkConfigPath, 'utf8'));

        let benchmark = await Benchmark.findOne({ where: {RepositoryName: RepositoryName, SuiteName: SuiteName, Path: benchmarkPath, Name: benchmarkConfig.name} })
                     ?? await Benchmark.create({ RepositoryName: RepositoryName, SuiteName: SuiteName, Path: benchmarkPath,  Name: benchmarkConfig.name, Owner: benchmarkConfig.owner, CreationTimestamp: new Date() });

        let result = await BenchmarkResult.create({ BenchmarksRunId: benchmarksRun.Id, BenchmarkId: benchmark.Id, Status: 'queued', ExecutionStartTimestamp: null, ExecutionEndTimestamp: null, ExecutionOutput: null });

        await MicroJobsQueue.create({ Type: 'bench', Status: 'queued', GridName: GridName, RunId: benchmarksRun.Id, ResultId: result.Id });
      }
      catch (error) {
        console.error(`Failed to register benchmark: ${error}`);
      }
    });

    res.status(201).json(benchmarksRun);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  } finally {
    if (fs.existsSync(localRepositoryDir))
      fs.rmdirSync(localRepositoryDir, { recursive: true });
  }
});

router.post('/schedule-tests-run', async (req, res) => {
  console.log('Scheduling tests run:', req.body);
  
  const { RepositoryName, SuiteName, GridName, TestRunName, Artifacts, TeamsNotificationUrl } = req.body;
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

    let testsRun = await TestRun.create({
      RepositoryName: RepositoryName,
      SuiteName: SuiteName,
      GridName: GridName,
      Name: TestRunName,
      TeamsNotificationUrl: TeamsNotificationUrl,
      Artifacts: Artifacts,
      OverallCreationTimestamp: new Date(),
      OverallStatus: 'queued'
    });

    requestedTestsPaths.forEach(async (testPath) => {
      try {
        const testConfigPath = `${localRepositoryDir}/${testPath}/test.testfarm`;
        requireFileExists(testConfigPath);

        let testConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));

        let test = await Test.findOne({ where: {RepositoryName: RepositoryName, SuiteName: SuiteName, Path: testPath, Name: testConfig.name} })
                ?? await Test.create({ RepositoryName: RepositoryName, SuiteName: SuiteName, Path: testPath,  Name: testConfig.name, Owner: testConfig.owner, CreationTimestamp: new Date() });

        let result = await TestResult.create({ TestRunId: testsRun.Id, TestId: test.Id, Status: 'queued', ExecutionStartTimestamp: null, ExecutionEndTimestamp: null, ExecutionOutput: null });

        await MicroJobsQueue.create({ Type: 'test', Status: 'queued', GridName: GridName, RunId: testsRun.Id, ResultId: result.Id });
      }
      catch (error) {
        console.error(`Failed to register test: ${error}`);
      }
    });

    res.status(201).json(testsRun);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  } finally {
    if (fs.existsSync(localRepositoryDir))
      fs.rmdirSync(localRepositoryDir, { recursive: true });
  }
});

router.get('/get-next-job', async (req, res) => {
  const { GridName } = req.query;

  try {
    // Use a transaction with the highest isolation level to prevent race conditions
    const nextJob = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      // Find the next queued job
      const job = await MicroJobsQueue.findOne({
        where: {
          Status: 'queued',
          GridName: GridName
        },
        order: [
          ['Id', 'ASC'] // Select the oldest queued job
        ],
        lock: t.LOCK.UPDATE, // Add row-level locking to prevent other transactions from changing this row
        transaction: t
      });
      
      if (job) {
        // Update the status atomically within the transaction
        job.Status = 'reserved';
        await job.save({ transaction: t });
      }
      
      return job;
    });

    return nextJob ? res.status(200).json(nextJob) : res.status(404).json({ message: 'No queued jobs found for this grid' });

  } catch (error) {
    console.error('Error getting next job:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

router.get('/get-scheduled-benchmark', async (req, res) => {
  const { BenchmarkResultId } = req.query;

  try {
    // Use a transaction with the highest isolation level to prevent race conditions
    const result = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      const queuedBenchmark = await BenchmarkResult.findByPk(BenchmarkResultId, {
        lock: t.LOCK.UPDATE, // Add row-level locking to prevent other transactions from changing this row
        transaction: t
      });

      if (!queuedBenchmark) {
        return null;
      }

      // Update the status atomically within the transaction
      queuedBenchmark.Status = 'running';
      queuedBenchmark.ExecutionStartTimestamp = new Date();
      await queuedBenchmark.save({ transaction: t });

      const benchmarksRun = await BenchmarkRun.findOne({
        where: {
          Id: queuedBenchmark.BenchmarkRunId
        },
        transaction: t
      });

      if (!benchmarksRun) {
        return null;
      }

      benchmarksRun.OverallStatus = 'running';
      await benchmarksRun.save({ transaction: t });

      const job = await MicroJobsQueue.findOne({
        where: {
          Type: 'bench',
          ResultId: BenchmarkResultId
        },
        transaction: t
      });

      if (!job) {
        return null;
      }

      job.Status = 'running';
      await job.save({ transaction: t });

      // Retrieve the complete benchmark information with associations
      return BenchmarkResult.findByPk(BenchmarkResultId, {
        include: [
          {
            model: BenchmarkRun,
            as: 'BenchmarkRun'
          },
          {
            model: Benchmark,
            as: 'Benchmark'
          }
        ],
        transaction: t
      }).then(async (benchmarkResult) => {
        // Fetch the repository separately based on the RepositoryName
        if (benchmarkResult && benchmarkResult.BenchmarkRun && benchmarkResult.BenchmarkRun.RepositoryName) {
          const repository = await Repository.findOne({
            where: {
              Name: benchmarkResult.BenchmarkRun.RepositoryName
            },
            transaction: t
          });

          // Add repository info to the response
          if (repository) {
            const plainResult = benchmarkResult.get({ plain: true });
            plainResult.Repository = repository.get({ plain: true });
            return plainResult;
          }
        }
        return benchmarkResult;
      });
    });

    if (!result) {
      return res.status(404).json({ message: 'No queued benchmarks found for this grid' });
    }
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error getting next benchmark:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

router.get('/get-scheduled-test', async (req, res) => {
  const { TestResultId } = req.query;
  
  try {
    // Use a transaction with the highest isolation level to prevent race conditions
    const result = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      const queuedTest = await TestResult.findByPk(TestResultId, {
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

      const testsRun = await TestRun.findOne({
        where: {
          Id: queuedTest.TestRunId
        },
        transaction: t
      });

      if (!testsRun) {
        return null;
      }

      testsRun.OverallStatus = 'running';
      await testsRun.save({ transaction: t });

      const job = await MicroJobsQueue.findOne({
        where: {
          Type: 'test',
          ResultId: TestResultId
        },
        transaction: t
      });

      if (!job) {
        return null;
      }

      job.Status = 'running';
      await job.save({ transaction: t });

      // Retrieve the complete test information with associations
      return TestResult.findByPk(TestResultId, {
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
      }).then(async (benchmarkResult) => {
        // Fetch the repository separately based on the RepositoryName
        if (benchmarkResult && benchmarkResult.TestRun && benchmarkResult.TestRun.RepositoryName) {
          const repository = await Repository.findOne({
            where: { 
              Name: benchmarkResult.TestRun.RepositoryName 
            },
            transaction: t
          });
          
          // Add repository info to the response
          if (repository) {
            const plainResult = benchmarkResult.get({ plain: true });
            plainResult.Repository = repository.get({ plain: true });
            return plainResult;
          }
        }
        return benchmarkResult;
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

router.post('/complete-benchmark', async (req, res) => {
  const { BenchmarkResultId, Result } = req.body;
  
  try {
    const benchmarkResult = await BenchmarkResult.findByPk(BenchmarkResultId);
    
    if (!benchmarkResult) {
      return res.status(404).json({ message: 'Test result not found' });
    }
    
    benchmarkResult.Status = 'completed';
    benchmarkResult.ExecutionEndTimestamp = new Date();
    benchmarkResult.Result = Result;
    await benchmarkResult.save();

    await MicroJobsQueue.destroy({
      where: {
        Type: 'bench',
        ResultId: BenchmarkResultId
      }
    });

    // Check if all benchmarks in this BenchmarkRun are completed
    const benchmarkRun = await BenchmarksRun.findByPk(benchmarkResult.BenchmarksRunId);
    const pendingBenchmarks = await BenchmarkResult.count({
      where: {
        BenchmarksRunId: benchmarkResult.BenchmarksRunId,
        Status: ['queued', 'running']
      }
    });

    // If no more pending benchmarks, send notification
    if (pendingBenchmarks === 0) {
      benchmarkRun.OverallStatus = 'completed';
      await benchmarkRun.save();

      // if (benchmarkRun.TeamsNotificationUrl) {
      //   sendTestRunCompletionMessageToTeams(benchmarkResult.BenchmarksRunId);
      // }
    }
    
    res.status(200).json(benchmarkResult);
  } catch (error) {
    console.error('Error completing benchmark:', error);
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

    await MicroJobsQueue.destroy({
      where: {
        Type: 'test',
        ResultId: testResult.Id
      }
    });

    // Check if all tests in this TestRun are completed
    const testsRun = await TestRun.findByPk(testResult.TestRunId);
    const pendingTests = await TestResult.count({
      where: {
        TestRunId: testResult.TestRunId,
        Status: ['queued', 'running']
      }
    });

    // If no more pending tests, send notification
    if (pendingTests === 0) {
      const allTestsPassed = await TestResult.count({
        where: {
          TestRunId: testResult.TestRunId,
          Status: 'failed'
        }
      }) === 0;

      testsRun.OverallStatus = allTestsPassed ? 'passed' : 'failed';
      await testsRun.save();

      if (testsRun.TeamsNotificationUrl) {
        sendTestRunCompletionMessageToTeams(testResult.TestRunId);
      }
    }
    
    res.status(200).json(testResult);
  } catch (error) {
    console.error('Error completing test:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

const multer = require('multer');
const zlib = require('zlib');

const uploadDiff = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB size limit
});

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

router.get('/diff/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const diff = await TestResultDiff.findByPk(id);

    if (diff) {
      res.status(200).json(diff);
    } else {
      res.status(404).json({ message: 'Diff not found' });
    }
  } catch (error) {
    console.error('Error retrieving diff:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

module.exports = router;