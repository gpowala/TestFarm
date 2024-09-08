const { DOMParser } = require('xmldom');

function unescapeXmlString(xmlString) {
  return xmlString
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseBehaveTestsResults(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  const testcases = Array.from(xmlDoc.getElementsByTagName("testcase")).map(testcase => ({
    name: testcase.getAttribute("name"),
    status: testcase.getAttribute("status"),
    executionOutput: testcase.getElementsByTagName("system-out")[0]?.textContent || "",
    executionTime: parseFloat(testcase.getAttribute("time"))
  }));

  return testcases;
}

function parseSpecFlowTestsResults(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  const unitTestResults = Array.from(xmlDoc.getElementsByTagName("UnitTestResult")).map(result => ({
    name: result.getAttribute("testName"),
    status: result.getAttribute("outcome"),
    executionOutput: result.getElementsByTagName("Output")[0]?.getElementsByTagName("StdOut")[0]?.textContent || "",    
    executionTime: result.getAttribute("duration")
  }));

  return unitTestResults;
}

module.exports = {
  unescapeXmlString,
  parseBehaveTestsResults,
  parseSpecFlowTestsResults
};
