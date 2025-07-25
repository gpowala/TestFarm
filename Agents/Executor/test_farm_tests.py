from dataclasses import dataclass
from typing import List
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

    metrics: str
    output: str

    diffs: List[DiffPair] = None
    
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

        if self.diffs is None:
            self.diffs = []
    
    @staticmethod
    def from_file(file_path: str) -> "BenchmarkCase":
        with open(file_path, 'r') as f:
            data = json.load(f)

        if "diffs" in data:
            diffs = [DiffPair(**diff) for diff in data["diffs"]]
            data["diffs"] = diffs

        return BenchmarkCase(**data)
