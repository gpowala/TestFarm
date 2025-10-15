import os
import json

from datetime import datetime
from typing import Dict, Any, Optional

import xml.etree.ElementTree as ET


__all__ = [
    "convert_trx_to_json"
]


def convert_trx_to_json(input_trx_file_path: str, output_json_file_path: str):
    if not os.path.exists(input_trx_file_path):
        raise FileNotFoundError(f"TRX file not found: {input_trx_file_path}")
    
    # Parse the TRX XML file
    tree = ET.parse(input_trx_file_path)
    root = tree.getroot()
    
    # Define namespace mapping for TRX files
    namespaces = {
        'ns': 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'
    }
    
    # Initialize the JSON structure
    json_data = {
        "interpreter": "unittest",
        "data": {
            "testResults": [],
            "testDefinitions": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "skipped": 0,
                "inconclusive": 0
            }
        }
    }

    # Extract test definitions
    test_definitions = root.findall('.//ns:UnitTest', namespaces)
    for test_def in test_definitions:
        definition = {
            "id": test_def.get('id', ''),
            "name": test_def.get('name', ''),
            "storage": test_def.get('storage', ''),
        }
        
        # Extract test method information
        test_method = test_def.find('.//ns:TestMethod', namespaces)
        if test_method is not None:
            definition["testMethod"] = {
                "codeBase": test_method.get('codeBase', ''),
                "adapterTypeName": test_method.get('adapterTypeName', ''),
                "className": test_method.get('className', ''),
                "name": test_method.get('name', '')
            }
        
        json_data["testDefinitions"].append(definition)
    
    # Extract test results
    test_results = root.findall('.//ns:UnitTestResult', namespaces)
    for result in test_results:
        test_result = {
            "executionId": result.get('executionId', ''),
            "testId": result.get('testId', ''),
            "testName": result.get('testName', ''),
            "computerName": result.get('computerName', ''),
            "duration": result.get('duration', ''),
            "startTime": ensure_iso_datetime(result.get('startTime')),
            "endTime": ensure_iso_datetime(result.get('endTime')),
            "testType": result.get('testType', ''),
            "outcome": result.get('outcome', ''),
            "testListId": result.get('testListId', ''),
            "relativeResultsDirectory": result.get('relativeResultsDirectory', '')
        }
        
        # Extract output information
        output_elem = result.find('.//ns:Output', namespaces)
        if output_elem is not None:
            test_result["output"] = {}
            
            stdout = output_elem.find('.//ns:StdOut', namespaces)
            if stdout is not None and stdout.text:
                test_result["output"]["stdout"] = stdout.text.strip()
            
            stderr = output_elem.find('.//ns:StdErr', namespaces)
            if stderr is not None and stderr.text:
                test_result["output"]["stderr"] = stderr.text.strip()
            
            error_info = output_elem.find('.//ns:ErrorInfo', namespaces)
            if error_info is not None:
                test_result["output"]["errorInfo"] = {}
                
                message = error_info.find('.//ns:Message', namespaces)
                if message is not None and message.text:
                    test_result["output"]["errorInfo"]["message"] = message.text.strip()
                
                stack_trace = error_info.find('.//ns:StackTrace', namespaces)
                if stack_trace is not None and stack_trace.text:
                    test_result["output"]["errorInfo"]["stackTrace"] = stack_trace.text.strip()
        
        json_data["testResults"].append(test_result)
        
        # Update summary counts
        outcome = result.get('outcome', '').lower()
        json_data["summary"]["total"] += 1
        
        if outcome == 'passed':
            json_data["summary"]["passed"] += 1
        elif outcome == 'notexecuted' or outcome == 'skipped':
            json_data["summary"]["skipped"] += 1
        elif outcome == 'inconclusive':
            json_data["summary"]["inconclusive"] += 1
        else:
            # Treat all other outcomes as failures
            json_data["summary"]["failed"] += 1
    
    # Extract result summary if present in TRX
    result_summary = root.find('.//ns:ResultSummary', namespaces)
    if result_summary is not None:
        counters = result_summary.find('.//ns:Counters', namespaces)
        if counters is not None:
            json_data["summary"] = {
                "total": int(counters.get('total', 0)),
                "executed": int(counters.get('executed', 0)),
                "passed": int(counters.get('passed', 0)),
                "failed": int(counters.get('failed', 0)),
                "error": int(counters.get('error', 0)),
                "timeout": int(counters.get('timeout', 0)),
                "aborted": int(counters.get('aborted', 0)),
                "inconclusive": int(counters.get('inconclusive', 0)),
                "passedButRunAborted": int(counters.get('passedButRunAborted', 0)),
                "notRunnable": int(counters.get('notRunnable', 0)),
                "notExecuted": int(counters.get('notExecuted', 0)),
                "disconnected": int(counters.get('disconnected', 0)),
                "warning": int(counters.get('warning', 0)),
                "completed": int(counters.get('completed', 0)),
                "inProgress": int(counters.get('inProgress', 0)),
                "pending": int(counters.get('pending', 0))
            }
    
    # Save to file if output path is provided
    if output_json_file_path:
        with open(output_json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(json_data, json_file, indent=2, ensure_ascii=False)
        print(f"JSON output saved to: {output_json_file_path}")
    
    return json_data


def ensure_iso_datetime(datetime_str: Optional[str]) -> Optional[str]:
    if not datetime_str:
        return None
    
    try:
        if datetime_str.endswith('Z'):
            dt = datetime.fromisoformat(datetime_str[:-1])
        else:
            dt = datetime.fromisoformat(datetime_str)
        return dt.isoformat()
    except (ValueError, AttributeError):
        return datetime_str


