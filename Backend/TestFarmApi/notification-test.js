const axios = require('axios');

async function sendTeamsMessage() {
    const payload = {
        "type": "message",
        "result": "pass",
        "attachments": [{
              "content": "test description"
            }
        ],
        "sections": [],
        "potentialAction": []
    };

    let webhookUrl = 'https://prod-223.westeurope.logic.azure.com:443/workflows/178efe5b2196440d82a9015a84a555c1/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=urYZPt6POJ2SYCAlfDfz31H7Ixggz0XcK1kjjiqnmZs'; // Replace with your own webhook URL

  try {
    const response = await axios.post(webhookUrl, payload);
    console.log('Teams message sent:', response.status);
  } catch (error) {
    console.error('Error sending Teams message:', error);
  }
}

sendTeamsMessage();