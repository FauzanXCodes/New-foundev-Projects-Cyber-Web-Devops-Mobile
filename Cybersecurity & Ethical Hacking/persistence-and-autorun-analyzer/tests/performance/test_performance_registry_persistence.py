import pytest
import time
import random
import string

from iocx_registry_keys.plugin import Plugin as RegistryPlugin

plugin = RegistryPlugin()


# -----------------------------
# Random persistence key generators
# -----------------------------

PERSISTENCE_KEYS = [
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
    r"HKLM\Software\Microsoft\Windows\CurrentVersion\Run",
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce",
    r"HKLM\Software\Microsoft\Windows\CurrentVersion\RunOnce",
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run",
    r"HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run",
]


def rand_persistence_key():
    return random.choice(PERSISTENCE_KEYS)


def random_noise(n=200):
    chars = string.ascii_letters + string.digits + ":./[]%_-"
    return "".join(random.choice(chars) for _ in range(n))


# -----------------------------
# Build large mixed input
# -----------------------------

def build_large_persistence_input(size_kb=500):
    chunks = []
    for _ in range(size_kb):
        if random.random() < 0.6:
            chunks.append(rand_persistence_key())
        else:
            chunks.append(random_noise(50))
    return " ".join(chunks)


# -----------------------------
# Performance Tests
# -----------------------------

@pytest.mark.performance
def test_registry_persistence_large_input_performance():
    """Ensure persistence detector handles ~1MB mixed content quickly."""
    text = build_large_persistence_input(1000)
    start = time.perf_counter()
    result = plugin.detect(text, None)
    duration = time.perf_counter() - start

    print(f"[perf] registry-persistence 1MB mixed-content: {duration:.4f}s")
    assert duration < 1.0, f"Persistence detector too slow: {duration:.3f}s"


@pytest.mark.performance
def test_registry_persistence_pathological_performance():
    """
    Worst-case:
    - extremely long repeated persistence keys
    """
    pathological = " ".join(PERSISTENCE_KEYS * 20000)

    start = time.perf_counter()
    result = plugin.detect(pathological, None)
    duration = time.perf_counter() - start

    print(f"[perf] pathological persistence spam: {duration:.4f}s")
    assert duration < 1.0, f"Pathological input too slow: {duration:.3f}s"


@pytest.mark.performance
def test_registry_persistence_scaling_behavior():
    """Ensure roughly linear scaling with input size."""

    plugin.detect(build_large_persistence_input(200), None)

    sizes = [300, 600, 1000, 1500]
    timings = []

    for size in sizes:
        text = build_large_persistence_input(size)

        runs = []
        for _ in range(3):
            start = time.perf_counter()
            plugin.detect(text, None)
            runs.append(time.perf_counter() - start)

        duration = sorted(runs)[1]
        timings.append(duration)
        print(f"[perf] registry-persistence {size}KB: {duration:.4f}s")

    for i in range(1, len(timings)):
        assert timings[i] < timings[i-1] * 2.5, "Non-linear scaling detected"
