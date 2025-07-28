import os
import json

from testfarm_agents_utils import expand_magic_variables

__all__ = [
    "reset_bench_iter",
    "get_bench_iter",
    "incr_bench_iter",
    "remove_benchmark_process_file"
]


def reset_bench_iter():
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")
    
    data = {"current_iteration": 0}
    with open(benchmark_process_file, 'w') as f:
        json.dump(data, f, indent=2)


def get_bench_iter() -> int:
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")

    with open(benchmark_process_file, 'r') as f:
        data = json.load(f)

    return data.get("current_iteration", 0)


def incr_bench_iter():
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")

    with open(benchmark_process_file, 'r') as f:
        data = json.load(f)

    data["current_iteration"] = data.get("current_iteration", 0) + 1

    with open(benchmark_process_file, 'w') as f:
        json.dump(data, f, indent=2)


def remove_benchmark_process_file():
    benchmark_process_file = expand_magic_variables(f"$__TF_TEMP_DIR__/benchmark_process.testfarm")
    
    if os.path.exists(benchmark_process_file):
        os.remove(benchmark_process_file)
    else:
        raise FileNotFoundError(f"Benchmark process file {benchmark_process_file} does not exist.")

