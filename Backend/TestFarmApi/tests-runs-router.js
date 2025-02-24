const { Test, TestRun, TestResult, Repository } = require('./database');
const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');

const { appSettings } = require('./appsettings');
const fs = require('fs');

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

/**
 * @swagger
 * /register-host:
 *   post:
 *     summary: Register a new host
 *     tags: [Hosts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - GridName
 *               - Type
 *               - Hostname
 *               - Cores
 *             properties:
 *               GridName:
 *                 type: string
 *               Type:
 *                 type: string
 *               Hostname:
 *                 type: string
 *               Cores:
 *                 type: integer
 *               RAM:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Host'
 *       500:
 *         description: Internal Server Error
 */
router.post('/schedule-tests-run', async (req, res) => {
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

        await TestResult.create({ TestRunId: testRun.Id, TestId: test.Id, Status: 'queued', ExecutionTime: null, ExecutionOutput: null });
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

// router.post('/next-test', async (req, res) => {
//   const { GridName } = req.body;
  
//   const testRun = await TestRun.findOne({
//     where: { GridName: GridName },
//     order: [['CreationTimestamp', 'ASC']],
//     include: [{
//       model: TestResult,
//       where: { Status: 'queued' },
//       limit: 1
//     }]
//   });

//   if (testRun?.TestResults?.[0]) {
//     testRun.TestResults[0].Status = 'running';
//     await testRun.TestResults[0].save();
//   }

//   if (!testRun) {
//     return res.status(404).json({ message: 'No test runs with queued tests found' });
//   }

//   const TestRunId = testRun.Id;

//   const maxAttempts = 3;
//   let attempts = 0;

//   try {
//     while (attempts < maxAttempts) {
//       const result = await TestResult.findOneAndUpdate(
//         { TestRunId: TestRunId, Status: 'queued' },
//         { Status: 'running' },
//         { returning: true, new: true }
//       );
      
//       if (result) {
//         return res.status(200).json(result);
//       }
//       attempts++;
//       if (attempts < maxAttempts) {
//         await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
//       }
//     }
//     res.status(404).json({ message: 'No queued tests found' });
//   } catch (error) {
//     res.status(500).json({ error: `Internal Server Error: ${error}` });
//   }
// }
  
  // /**
  //  * @swagger
  //  * /unregister-host:
  //  *   get:
  //  *     summary: Unregister a host
  //  *     tags: [Hosts]
  //  *     parameters:
  //  *       - in: query
  //  *         name: Id
  //  *         required: true
  //  *         schema:
  //  *           type: integer
  //  *         description: The ID of the host to unregister
  //  *     responses:
  //  *       200:
  //  *         description: Host unregistered successfully
  //  *       404:
  //  *         description: Host not found
  //  *       500:
  //  *         description: Internal Server Error
  //  */
  // router.get('/unregister-host', async (req, res) => {
  //   try {
  //     const { Id } = req.query;
  
  //     const host = await Host.findByPk(Id);
  //     if (!host) {
  //       return res.status(404).json({ error: 'Host not found' });
  //     }
  
  //     const gridId = host.GridId;
  
  //     await host.destroy();
  
  //     const remainingHosts = await Host.count({ where: { GridId: gridId } });
  
  //     if (remainingHosts === 0) {
  //       await Grid.destroy({ where: { Id: gridId } });
  //     }
  
  //     res.status(200).json({ message: 'Host unregistered successfully' });
  //   } catch (error) {
  //     console.error('Error unregistering host:', error);
  //     res.status(500).json({ error: 'Internal Server Error' });
  //   }
  // });
  
  // /**
  //  * @swagger
  //  * /update-host-status:
  //  *   put:
  //  *     summary: Update host status
  //  *     tags: [Hosts]
  //  *     requestBody:
  //  *       required: true
  //  *       content:
  //  *         application/json:
  //  *           schema:
  //  *             type: object
  //  *             required:
  //  *               - Id
  //  *               - Status
  //  *             properties:
  //  *               Id:
  //  *                 type: integer
  //  *               Status:
  //  *                 type: string
  //  *     responses:
  //  *       200:
  //  *         description: Host status updated successfully
  //  *         content:
  //  *           application/json:
  //  *             schema:
  //  *               $ref: '#/components/schemas/Host'
  //  *       404:
  //  *         description: Host not found
  //  *       500:
  //  *         description: Internal Server Error
  //  */
  // router.put('/update-host-status', async (req, res) => {
  //   try {
  //     const { Id, Status } = req.body;
  
  //     const host = await Host.findByPk(Id);
  //     if (!host) {
  //       return res.status(404).json({ error: 'Host not found' });
  //     }
  
  //     host.Status = Status;
  //     host.LastUpdateTimestamp = new Date();
  //     await host.save();
  
  //     res.status(200).json({ message: 'Host status updated successfully', host });
  //   } catch (error) {
  //     console.error('Error updating host status:', error);
  //     res.status(500).json({ error: 'Internal Server Error' });
  //   }
  // });
  

  module.exports = router;