const axios = require('axios');

const { sequelize, Grid, Host, TestRun, Test, TestResult, TestResultDiff, Repository } = require('./database');

const { appSettings } = require('./appsettings');

async function sendTestRunCompletionMessageToTeams(testRunId) {
  const testRun = await TestRun.findByPk(testRunId);

  const counts = await TestResult.findAll({
    where: {
      testRunId: testRunId
    },
    attributes: [
      'Status',
      [sequelize.fn('COUNT', sequelize.col('Id')), 'count']
    ],
    group: ['Status']
  });

  const statusCounts = {
    queued: 0,
    running: 0,
    passed: 0,
    failed: 0
  };

  counts.forEach(result => {
    const status = result.getDataValue('Status');
    const count = parseInt(result.getDataValue('count'), 10);
    if (statusCounts.hasOwnProperty(status)) {
      statusCounts[status] = count;
    }
  });
  
  if (statusCounts['queued'] > 0 || statusCounts['running'] > 0 || testRun.TeamsNotificationUrl === null)
    return;

  console.log(statusCounts);

  const messageHeader = statusCounts.failed > 0
    ? `<span style='color:red; font-size:larger;'><b>Test Run FAILED!</b></span><br><br>`
    : `<span style='color:green; font-size:larger;'><b>Test Run PASSED!</b></span><br><br>`;

  let messageBody = '';
  
  messageBody += `<b>Test Run Name:</b> ${testRun.Name}<br>`;
  messageBody += `<b>Creation Timestamp:</b> ${testRun.CreationTimestamp}<br><br>`;

  messageBody += `<b>Grid Name:</b> ${testRun.GridName}<br>`;
  messageBody += `<b>Repository Name:</b> ${testRun.RepositoryName}<br>`;
  messageBody += `<b>Suite Name:</b> ${testRun.SuiteName}<br><br>`;

  messageBody += `<b>Total:</b> ${statusCounts['passed'] + statusCounts['failed']} | <b>Passed</b>: ${statusCounts['passed']} | <b>Failed</b>: ${statusCounts['failed']}<br><br>`;
  messageBody += `Check results: <a href='${appSettings.teams.resultsUrl}/${testRunId}'>${appSettings.teams.resultsUrl}/${testRunId}</a>`;

  const payload = {
    "messages": [
      messageHeader + messageBody
    ]
  };

  try {
    const response = await axios.post(testRun.TeamsNotificationUrl, payload);
    console.log('Teams message sent:', response.status);
  } catch (error) {
    console.error('Error sending Teams message:', error);
  }
}

module.exports = {
  sendTestRunCompletionMessageToTeams
};