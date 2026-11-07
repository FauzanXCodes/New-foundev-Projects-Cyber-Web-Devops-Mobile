import pytest
import time
import random
import string

from iocx_registry_keys.plugin import Plugin as RegistryPlugin

plugin = RegistryPlugin()


# -----------------------------
# Random registry value generators
# -----------------------------

def rand_reg_value_type():
    return random.choice([
        "REG_SZ", "REG_DWORD", "REG_BINARY", "REG_QWORD",
        "REG_MULTI_SZ", "REG_EXPAND_SZ"
    ])


def rand_reg_value_assignment():
    name = "".join(random.choices(string.ascii_letters + string.digits + "_-", k=10))
    val = "".join(random.choices(string.ascii_letters + string.digits, k=20))
    return f"{name}={val}"


def random_noise(n=200):
    chars = string.ascii_letters + string.digits + ":./[]%_-"
    return "".join(random.choice(chars) for _ in range(n))


# -----------------------------
# Build large mixed input
# -----------------------------

def build_large_registry_values_input(size_kb=500):
    generators = [
        rand_reg_value_type,
        rand_reg_value_assignment,
    ]
    chunks = []
    for _ in range(size_kb):
        if random.random() < 0.6:
            chunks.append(random.choice(generators)())
        else:
            chunks.append(random_noise(50))
    return " ".join(chunks)


# -----------------------------
# Performance Tests
# -----------------------------

@pytest.mark.performance
def test_registry_values_large_input_performance():
    """Ensure registry value detector handles ~1MB mixed content quickly."""
    text = build_large_registry_values_input(1000)
    start = time.perf_counter()
    result = plugin.detect(text, None)
    duration = time.perf_counter() - start

    print(f"[perf] registry-values 1MB mixed-content: {duration:.4f}s")
    assert duration < 1.0, f"Registry value detector too slow: {duration:.3f}s"


@pytest.mark.performance
def test_registry_values_pathological_performance():
    """
    Worst-case for regex engines:
    - extremely long REG_SZ blocks
    - repeated patterns
    """
    pathological = " ".join(["REG_SZ"] * 50000)

    start = time.perf_counter()
    result = plugin.detect(pathological, None)
    duration = time.perf_counter() - start

    print(f"[perf] pathological REG_SZ spam: {duration:.4f}s")
    assert duration < 0.5, f"Pathological input too slow: {duration:.3f}s"


@pytest.mark.performance
def test_registry_values_scaling_behavior():
    """Ensure roughly linear scaling with input size."""

    plugin.detect(build_large_registry_values_input(200), None)

    sizes = [300, 600, 1000, 1500]
    timings = []

    for size in sizes:
        text = build_large_registry_values_input(size)

        runs = []
        for _ in range(3):
            start = time.perf_counter()
            plugin.detect(text, None)
            runs.append(time.perf_counter() - start)

        duration = sorted(runs)[1]
        timings.append(duration)
        print(f"[perf] registry-values {size}KB: {duration:.4f}s")

    for i in range(1, len(timings)):
        assert timings[i] < timings[i-1] * 2.5, "Non-linear scaling detected"
