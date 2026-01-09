from dataclasses import dataclass
from typing import List, Optional
import json
import subprocess
import os
from pathlib import Path

__all__ = [
    "DiffPair",
    "TestCase",
    "BenchmarkCase"
]

@dataclass
class DiffPair:
    gold: str
    new: str
    encoding: str

@dataclass
class TestCase:
    name: str
    description: str
    owner: str
    type: str = "native"
    
    command: str
    
    output: str
    
    pre_steps: List[str] = None
    post_steps: List[str] = None
    diffs: List[DiffPair] = None
    
    def __post_init__(self):
        # Initialize empty lists for None values
        if self.pre_steps is None:
            self.pre_steps = []
        if self.post_steps is None:
            self.post_steps = []
        if self.diffs is None:
            self.diffs = []
    
    @staticmethod
    def from_file(file_path: str) -> "TestCase":
        with open(file_path, 'r') as f:
            data = json.load(f)

        if "diffs" in data:
            diffs = [DiffPair(**diff) for diff in data["diffs"]]
            data["diffs"] = diffs
            
        return TestCase(**data)
    
@dataclass
class BenchmarkCase:
    name: str
    description: str
    owner: str

    iterations: int
    
    command: str

    results: str
    output: str
    
    pre_bench_steps: List[str] = None
    post_bench_steps: List[str] = None

    pre_iter_steps: List[str] = None
    post_iter_steps: List[str] = None
    
    
    def __post_init__(self):
        # Initialize empty lists for None values
        if self.pre_bench_steps is None:
            self.pre_bench_steps = []
        if self.post_bench_steps is None:
            self.post_bench_steps = []

        if self.pre_iter_steps is None:
            self.pre_iter_steps = []
        if self.post_iter_steps is None:
            self.post_iter_steps = []
    
    @staticmethod
    def from_file(file_path: str) -> "BenchmarkCase":
        with open(file_path, 'r') as f:
            data = json.load(f)

        if "diffs" in data:
            diffs = [DiffPair(**diff) for diff in data["diffs"]]
            data["diffs"] = diffs

        return BenchmarkCase(**data)
    
# @dataclass
# class UnitTestsAtomicResults:
#     @dataclass
#     class TestResult:
#         executionId: str = ''
#         testId: str = ''
#         testName: str = ''
#         computerName: str = ''
#         duration: str = ''
#         startTime: str = ''
#         endTime: str = ''
#         testType: str = ''
#         outcome: str = ''
#         testListId: str = ''
#         relativeResultsDirectory: str = ''

#     @dataclass
#     class TestSummary:
#         total: int = 0
#         passed: int = 0
#         failed: int = 0
#         skipped: int = 0
#         inconclusive: int = 0

#     @dataclass
#     class UnitTestData:
#         testResults: List['UnitTestsAtomicResults.TestResult'] = None
#         summary: 'UnitTestsAtomicResults.TestSummary'

#     def __post_init__(self):
#         if self.testResults is None:
#             self.testResults = []

#     interpreter: str
#     data: UnitTestData

#     @staticmethod
#     def from_dict(data: dict) -> "UnitTestsAtomicResults":
#         test_results = [UnitTestsAtomicResults.TestResult(**result) for result in data.get('data', {}).get('testResults', [])]
#         summary = UnitTestsAtomicResults.TestSummary(**data.get('data', {}).get('summary', {}))
#         unit_test_data = UnitTestsAtomicResults.UnitTestData(testResults=test_results, summary=summary)

#         return UnitTestsAtomicResults(
#             interpreter=data.get('interpreter', 'unittest'),
#             data=unit_test_data
#         )