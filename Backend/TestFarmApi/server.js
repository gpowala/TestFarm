const fs = require('fs');
const path = require('path');

const appSettingsPath = path.join(__dirname, 'appsettings.json');
const appSettings = JSON.parse(fs.readFileSync(appSettingsPath, 'utf8'));

const express = require('express');
const { sequelize, Grid, Host, TestRun, Test, TestResult } = require('./database');
const gridsRouter = require('./grids-router');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Test Farm API',
      version: '1.0.0',
      description: 'API for managing test farm',
    },
  },
  apis: ['./grids-router.js', './server.js']
};

const { parseBehaveTestsResults, parseSpecFlowTestsResults, unescapeXmlString } = require('./examples/results-parsers');

const axios = require('axios');

async function sendTeamsMessage(webhookUrl, message) {
  const payload = {
    text: message
  };

  try {
    const response = await axios.post(webhookUrl, payload);
    console.log('Teams message sent:', response.status);
    return true;
  } catch (error) {
    console.error('Error sending Teams message:', error);
    return false;
  }
}

async function notifyTeams(subject, text) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  const message = `${subject}\n\n${text}`;
  return await sendTeamsMessage(webhookUrl, message);
}

/**
 * @swagger
 * /upload-behave-tests-results:
 *   post:
 *     summary: Upload and process Behave test results
 *     tags: [Tests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testRunName
 *               - xmlString
 *             properties:
 *               testRunName:
 *                 type: string
 *                 description: Test run name
 *               xmlString:
 *                 type: string
 *                 description: XML string containing test results (escaped)
 *     responses:
 *       200:
 *         description: Test results uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
app.post('/upload-behave-tests-results', async (req, res) => {
  try {
    const { testRunName, resultsXml } = req.body;

    if (!resultsXml) {
      return res.status(400).send('No XML string provided.');
    }

    let parsedResults = parseBehaveTestsResults(unescapeXmlString(resultsXml));

    const testRun = await TestRun.create({
      Name: testRunName,
      CreationTimestamp: new Date()
    });

    for (const result of parsedResults) {
      let test = await Test.findOne({ where: { Name: result.name } });
      if (!test) {
        test = await Test.create({
          Name: result.name,
          CreationTimestamp: new Date()
        });
      }

      await TestResult.create({
        TestRunId: testRun.Id,
        TestId: test.Id,
        Status: result.status,
        ExecutionTime: new Date(),
        ExecutionOutput: result.executionOutput
      });
    }

    if (appSettings.teams.enabled) {
      const failedResultsCount = parsedResults.filter(result => result.status.toLowerCase() !== 'passed').length;

      let teamsHtml = `<h2>Test Run: ${testRunName}</h2>`;
      teamsHtml += `<p>Total tests: ${parsedResults.length}</p>`;
      
      if (failedResultsCount > 0) {
        teamsHtml += `<p style="color: red;">Failed tests: ${failedResultsCount}/${parsedResults.length}</p>`;
      } else {
        teamsHtml += `<p style="color: green;">All tests passed!</p>`;
      }

      await notifyTeams(`Tests Run Results: ${testRunName}`, teamsHtml);
    }

    res.status(200).json({ message: 'Tests results uploaded and processed successfully' });
  } catch (error) {
    console.error('Error processing tests results:', error);
    res.status(500).send('Error processing tests results');
  }
});

/**
 * @swagger
 * /upload-specflow-tests-results:
 *   post:
 *     summary: Upload and process SpecFlow test results
 *     tags: [Tests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testRunName
 *               - xmlString
 *             properties:
 *               testRunName:
 *                 type: string
 *                 description: Test run name
 *               xmlString:
 *                 type: string
 *                 description: XML string containing test results (escaped)
 *     responses:
 *       200:
 *         description: Test results uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
app.post('/upload-specflow-tests-results', async (req, res) => {
  try {
    const { testRunName, resultsXml } = req.body;

    if (!resultsXml) {
      return res.status(400).send('No XML string provided.');
    }

    let parsedResults = parseSpecFlowTestsResults(unescapeXmlString(resultsXml));

    const testRun = await TestRun.create({
      Name: testRunName,
      CreationTimestamp: new Date()
    });

    for (const result of parsedResults) {
      let test = await Test.findOne({ where: { Name: result.name } });
      if (!test) {
        test = await Test.create({
          Name: result.name,
          CreationTimestamp: new Date()
        });
      }
      console.log('Parsed result:', result.executionOutput);

      await TestResult.create({
        TestRunId: testRun.Id,
        TestId: test.Id,
        Status: result.status,
        ExecutionTime: new Date(),
        ExecutionOutput: result.executionOutput
      });
    }

    if (appSettings.teams.enabled) {
      const failedResultsCount = parsedResults.filter(result => result.status.toLowerCase() !== 'passed').length;

      let teamsHtml = `<h2>Test Run: ${testRunName}</h2>`;
      teamsHtml += `<p>Total tests: ${parsedResults.length}</p>`;
      
      if (failedResultsCount > 0) {
        teamsHtml += `<p style="color: red;">Failed tests: ${failedResultsCount}/${parsedResults.length}</p>`;
      } else {
        teamsHtml += `<p style="color: green;">All tests passed!</p>`;
      }

      await notifyTeams(`Tests Run Results: ${testRunName}`, teamsHtml);
    }

    res.status(200).json({ message: 'Tests results uploaded and processed successfully' });
  } catch (error) {
    console.error('Error processing tests results:', error);
    res.status(500).send('Error processing tests results');
  }
});

/**
 * @swagger
 * /tests-runs:
 *   get:
 *     summary: Fetch all test runs
 *     tags: [Tests]
 *     responses:
 *       200:
 *         description: Successfully retrieved all test runs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   Id:
 *                     type: integer
 *                   Name:
 *                     type: string
 *                   CreationTimestamp:
 *                     type: string
 *                     format: date-time
 *                   EndTime:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Internal server error
 */
app.get('/tests-runs', async (req, res) => {
  try {
    const testRuns = await TestRun.findAll({
      attributes: ['Id', 'Name', 'CreationTimestamp'],
      order: [['CreationTimestamp', 'DESC']]
    });
    res.status(200).json(testRuns);
  } catch (error) {
    console.error('Error fetching test runs:', error);
    res.status(500).send('Error fetching test runs');
  }
});

/**
 * @swagger
 * /tests-run-results/{testsRunId}:
 *   get:
 *     summary: Fetch tests results for a specific tests run
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: testsRunId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the tests run
 *     responses:
 *       200:
 *         description: Successfully retrieved tests results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   Id:
 *                     type: integer
 *                   TestId:
 *                     type: integer
 *                   TestName:
 *                     type: string
 *                   Status:
 *                     type: string
 *                   ExecutionTime:
 *                     type: string
 *                     format: date-time
 *                   ExecutionOutput:
 *                     type: string
 *       404:
 *         description: Tests run not found
 *       500:
 *         description: Internal server error
 */
app.get('/tests-run-results/:testsRunId', async (req, res) => {
  try {
    const testsRunId = parseInt(req.params.testsRunId);
    
    const testsRun = await TestRun.findByPk(testsRunId);
    if (!testsRun) {
      return res.status(404).json({ message: 'Tests run not found' });
    }

    const testsResults = await TestResult.findAll({
      where: { TestRunId: testsRunId },
      attributes: ['Id', 'TestId', 'Status', 'ExecutionOutput', 'ExecutionTime'],
      include: [{
        model: Test,
        as: 'Test',
        attributes: ['Name']
      }],
      order: [['ExecutionTime', 'ASC']]
    });

    const formattedResults = testsResults.map(result => ({
      Id: result.Id,
      TestId: result.TestId,
      TestName: result.Test.Name,
      Status: result.Status,
      ExecutionTime: result.ExecutionTime,
      ExecutionOutput: result.ExecutionOutput
    }));

    res.status(200).json(formattedResults);
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).send('Error fetching test results');
  }
});

/**
 * @swagger
 * /test-history/{testId}:
 *   get:
 *     summary: Get test history for a specific test sorted by execution time
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the test
 *     responses:
 *       200:
 *         description: Test history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   Id:
 *                     type: integer
 *                   TestRunId:
 *                     type: integer
 *                   TestRunName:
 *                     type: string
 *                   Status:
 *                     type: string
 *                   ExecutionTime:
 *                     type: string
 *                     format: date-time
 *                   ExecutionOutput:
 *                     type: string
 *       404:
 *         description: Test not found
 *       500:
 *         description: Internal server error
 */
app.get('/test-history/:testId', async (req, res) => {
  try {
    const testId = parseInt(req.params.testId);
    
    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const testHistory = await TestResult.findAll({
      where: { TestId: testId },
      attributes: ['Id', 'TestRunId', 'Status', 'ExecutionOutput', 'ExecutionTime'],
      include: [{
        model: TestRun,
        as: 'TestRun',
        attributes: ['Name']
      }],
      order: [['ExecutionTime', 'DESC']]
    });

    const formattedHistory = testHistory.map(result => ({
      Id: result.Id,
      TestRunId: result.TestRunId,
      TestRunName: result.TestRun.Name,
      Status: result.Status,
      ExecutionTime: result.ExecutionTime,
      ExecutionOutput: result.ExecutionOutput
    }));

    res.status(200).json(formattedHistory);
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).send('Error fetching test history');
  }
});

const azureDevOps = require('azure-devops-node-api');

/**
 * @swagger
 * /story-info/{storyId}:
 *   get:
 *     summary: Get information about a story from Azure DevOps
 *     tags: [Stories]
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the story
 *     responses:
 *       200:
 *         description: Story information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 title:
 *                   type: string
 *                 state:
 *                   type: string
 *                 description:
 *                   type: string
 *       404:
 *         description: Story not found
 *       500:
 *         description: Internal server error
 */
app.get('/story-info/:storyId', async (req, res) => {
  try {
    const storyId = parseInt(req.params.storyId);
    
    const orgUrl = appSettings.azureDevOps.orgUrl;
    const token = appSettings.azureDevOps.personalAccessToken;
    const authHandler = azureDevOps.getPersonalAccessTokenHandler(token);
    const connection = new azureDevOps.WebApi(orgUrl, authHandler);
    
    const witApi = await connection.getWorkItemTrackingApi();
    
    const workItem = await witApi.getWorkItem(storyId, undefined, undefined, undefined, appSettings.azureDevOps.project);
    
    if (!workItem) {
      return res.status(404).json({ message: 'Story not found' });
    }
    
    const storyInfo = {
      id: workItem.id,
      title: workItem.fields['System.Title'],
      state: workItem.fields['System.State'],
      description: workItem.fields['System.Description']
    };
    
    res.status(200).json(storyInfo);
  } catch (error) {
    console.error('Error fetching story information:', error);
    res.status(500).send('Error fetching story information');
  }
});

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/', gridsRouter);

app.listen(port, async () => {
  sequelize.verbose_sync();
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger UI available on http://localhost:${port}/api-docs`);
});

process.on('SIGINT', async () => {
  await sequelize.close();
  process.exit();
});
