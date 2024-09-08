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
      console.log('Parsed result:', result.executionOutput);

      await TestResult.create({
        TestRunId: testRun.Id,
        TestId: test.Id,
        Status: result.status,
        ExecutionTime: new Date(),
        ExecutionOutput: result.executionOutput
      });
    }

    sendEmail('gpowala@gmail.com', testRunName, 'Test results published');

    res.status(200).json({ message: 'Test results uploaded and processed successfully' });
  } catch (error) {
    console.error('Error processing test results:', error);
    res.status(500).send('Error processing test results');
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
app.post('/upload-specflow-tests-results', (req, res) => {
  try {
    const { testRunName, resultXml } = req.body;

    if (!xmlString) {
      return res.status(400).send('No XML string provided.');
    }

    let parsedResults = parseSpecFlowTestsResults(unescapeXmlString(xmlString));

    res.status(200).json({ message: 'Test results uploaded and processed successfully' });
  } catch (error) {
    console.error('Error processing test results:', error);
    res.status(500).send('Error processing test results');
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
