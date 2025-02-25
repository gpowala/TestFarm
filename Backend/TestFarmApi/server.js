const { appSettings } = require('./appsettings');

const express = require('express');
const { Sequelize } = require('sequelize');
const { sequelize, Grid, Host, TestRun, Test, TestResult } = require('./database');
const gridsRouter = require('./grids-router');
const repositoriesRouter = require('./reporitories-router');
const testsRunsRouter = require('./tests-router');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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

async function sendTeamsMessage(webhookUrl, messages, actions) {
	const payload = {
        "type": "message",
        "attachments": [{
              "contentType": "application/vnd.microsoft.card.adaptive",
              "content": {
                "type": "AdaptiveCard",
                "version": "1.2",
                "body": [title, message],
                "actions": actions
              }
            }
        ],
        "sections": [],
        "potentialAction": []
    };

  try {
    const response = await axios.post(webhookUrl, payload);
    console.log('Teams message sent:', response.status);
  } catch (error) {
    console.error('Error sending Teams message:', error);
  }
}

async function notifyTeamsOnNewTestsRunPublished(testRunId, testRunName, testRunResults) {
  if (appSettings.teams.enabled) {
    const failedResultsCount = testRunResults.filter(result => result.status.toLowerCase() !== 'passed').length;

    const title = {
		"type": "TextBlock",
		"weight": "Bolder",
		"text": `Test Run Results: ${testRunName} [${testRunId}]`,
		"color": failedResultsCount > 0 ? "Attention" : "Good",
		"wrap": false
	};
	
	const actions = [
		{
            "type": "Action.OpenUrl",
            "title": "View",
            "url": `${appSettings.teams.resultsUrl}/${testRunId}`
        }
	];
    
	let message = {};
	
    if (failedResultsCount > 0) {
      message = {
		"type": "TextBlock",
		"text": `Failed tests: ${failedResultsCount}/${testRunResults.length}! [view results](${appSettings.teams.resultsUrl}/${testRunId})`,
		"color": "Attention",
		"wrap": false
	  };
    } else {
		message = {
		"type": "TextBlock",
		"text": `All tests passed! Total tests run: ${testRunResults.length}. [view results](${appSettings.teams.resultsUrl}/${testRunId})`,
		"color": "Good",
		"wrap": false
	  };
    }

    return await sendTeamsMessage(appSettings.teams.webhookUrl, title, message);
  }
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

    await notifyTeamsOnNewTestsRunPublished(testRun.Id, testRunName, parsedResults);
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

    await notifyTeamsOnNewTestsRunPublished(testRun.Id, testRunName, parsedResults);
    res.status(200).json({ message: 'Tests results uploaded and processed successfully' });
  } catch (error) {
    console.error('Error processing tests results:', error);
    res.status(500).send('Error processing tests results');
  }
});

/**
 * @swagger
 * /tests-runs/{limit}:
 *   get:
 *     summary: Fetch test runs with optional limit
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: limit
 *         schema:
 *           type: integer
 *         required: true
 *         description: Number of test runs to return
 *     responses:
 *       200:
 *         description: Successfully retrieved test runs
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
    const { name, timespan, result: rawResult, limit } = req.query;
    const result = rawResult === 'all' ? null : rawResult;
    
    let whereClause = {};
    
    if (name) {
      whereClause.Name = {
        [Sequelize.Op.like]: `%${name}%`
      };
    }
    
    if (timespan && timespan !== '-1') {
      const timeSpanHours = parseInt(timespan);
      whereClause.CreationTimestamp = {
        [Sequelize.Op.gte]: new Date(Date.now() - timeSpanHours * 60 * 60 * 1000)
      };
    }

    const testRuns = await TestRun.findAll({
      attributes: [
        'Id', 
        'Name', 
        'CreationTimestamp',
        [
          sequelize.literal(`(
            SELECT CASE 
              WHEN EXISTS (
                SELECT 1 FROM TestsResults 
                WHERE TestsResults.TestRunId = TestsRuns.Id 
                AND TestsResults.Status = 'Failed'
              ) THEN 'failed'
              WHEN NOT EXISTS (
                SELECT 1 FROM TestsResults 
                WHERE TestsResults.TestRunId = TestsRuns.Id
              ) THEN 'Unknown' 
              ELSE 'passed'
            END
          )`),
          'OverallResult'
        ]
      ],
      where: {
        ...whereClause,
        ...(result && {
          [Sequelize.Op.and]: [
            sequelize.literal(`(
              SELECT CASE 
                WHEN EXISTS (
                  SELECT 1 FROM TestsResults 
                  WHERE TestsResults.TestRunId = TestsRuns.Id 
                  AND TestsResults.Status = 'Failed'
                ) THEN 'failed'
                WHEN NOT EXISTS (
                  SELECT 1 FROM TestsResults 
                  WHERE TestsResults.TestRunId = TestsRuns.Id
                ) THEN 'Unknown' 
                ELSE 'passed'
              END
            ) = '${result}'`)
          ]
        })
      },
      order: [['CreationTimestamp', 'DESC']],
      limit: parseInt(limit)
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
 * /integration/azure-devops/story-info/{storyId}:
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
app.get('/integration/azure-devops/story-info/:storyId', async (req, res) => {
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

/**
 * @swagger
 * /integration/azure-devops/trigger-release/{buildId}:
 *   get:
 *     summary: Trigger a release pipeline in Azure DevOps
 *     tags: [Azure DevOps]
 *     parameters:
 *       - in: path
 *         name: buildId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The artifact build ID to use for the release
 *     responses:
 *       200:
 *         description: Release pipeline triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 releaseId:
 *                   type: integer
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
app.get('/integration/azure-devops/trigger-release/:buildId', async (req, res) => {
  try {
    const buildId = parseInt(req.params.buildId);

    if (isNaN(buildId)) {
      return res.status(400).json({ message: 'Invalid Build ID' });
    }

    const orgUrl = appSettings.azureDevOps.orgUrl;
    const token = appSettings.azureDevOps.personalAccessToken;
    const project = appSettings.azureDevOps.project;
    const releaseDefinitionId = appSettings.azureDevOps.releaseDefinitionId;

    const authHandler = azureDevOps.getPersonalAccessTokenHandler(token);
    const connection = new azureDevOps.WebApi(orgUrl, authHandler);

    const releaseApi = await connection.getReleaseApi();

    const releaseStartMetadata = {
      definitionId: releaseDefinitionId,
      artifacts: [
        {
          alias: '_Build',
          instanceReference: {
            id: buildId.toString(),
            name: null
          }
        }
      ],
      isDraft: false,
      reason: 'none',
      description: 'Triggered from API'
    };

    const createdRelease = await releaseApi.createRelease(releaseStartMetadata, project);

    res.status(200).json({
      message: 'Release pipeline triggered successfully',
      releaseId: createdRelease.id
    });
  } catch (error) {
    console.error('Error triggering release pipeline:', error);
    res.status(500).json({ message: 'Error triggering release pipeline' });
  }
});

/**
 * @swagger
 * /integration/azure-devops/register-build/{project}/{buildId}/{releaseDefinitionId}:
 *   get:
 *     summary: Register a new build for Azure DevOps
 *     tags: [Integration]
 *     parameters:
 *       - in: path
 *         name: project
 *         required: true
 *         schema:
 *           type: string
 *         description: The Azure DevOps project name
 *       - in: path
 *         name: buildId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the build to register
 *       - in: path
 *         name: releaseDefinitionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the release definition
 *     responses:
 *       200:
 *         description: Build registered successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
app.get('/integration/azure-devops/register-build/:project/:buildId/:releaseDefinitionId', async (req, res) => {
  try {
    const { project, buildId, releaseDefinitionId } = req.params;

    // Validate input parameters
    if (!project || !buildId || !releaseDefinitionId) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    const parsedBuildId = parseInt(buildId);
    const parsedReleaseDefinitionId = parseInt(releaseDefinitionId);

    if (isNaN(parsedBuildId) || isNaN(parsedReleaseDefinitionId)) {
      return res.status(400).json({ message: 'Invalid buildId or releaseDefinitionId' });
    }

    // Here you would typically store this information in your database
    // For this example, we'll just log it and return a success message
    console.log(`Registered new build - Project: ${project}, Build ID: ${parsedBuildId}, Release Definition ID: ${parsedReleaseDefinitionId}`);

    res.status(200).json({
      message: 'Build registered successfully',
      project,
      buildId: parsedBuildId,
      releaseDefinitionId: parsedReleaseDefinitionId
    });
  } catch (error) {
    console.error('Error registering build:', error);
    res.status(500).json({ message: 'Error registering build' });
  }
});

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/', gridsRouter);
app.use('/', repositoriesRouter);
app.use('/', testsRunsRouter);

app.listen(port, async () => {
  sequelize.verbose_sync();
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger UI available on http://localhost:${port}/api-docs`);
});

process.on('SIGINT', async () => {
  await sequelize.close();
  process.exit();
});
