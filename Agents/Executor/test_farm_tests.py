from dataclasses import dataclass
from typing import List
import json
import subprocess
import os
from pathlib import Path

__all__ = [
    "DiffPair",
    "TestCase"
]

@dataclass
class DiffPair:
    gold: str
    new: str

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

