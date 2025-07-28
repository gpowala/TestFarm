import os

from testfarm_agents_utils import get_magic_variable, set_magic_variable

__all__ = [
    "reset_bench_iter",
    "get_bench_iter",
    "incr_bench_iter"
]


def reset_bench_iter():
    set_magic_variable('$__TF_BENCH_ITER__', str(0))


def get_bench_iter() -> int:
    return int(get_magic_variable('$__TF_BENCH_ITER__'))


def incr_bench_iter():
    set_magic_variable('$__TF_BENCH_ITER__', str(get_bench_iter() + 1))

