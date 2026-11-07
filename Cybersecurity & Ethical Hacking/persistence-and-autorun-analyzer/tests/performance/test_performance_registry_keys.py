import pytest
import time
import random
import string

from iocx_registry_keys.plugin import Plugin as RegistryPlugin


# Instantiate plugin once
plugin = RegistryPlugin()


# -----------------------------
# Random registry key generators
# -----------------------------

def rand_hive():
    return random.choice([
        "HKCU", "HKLM", "HKCR", "HKU", "HKEY_CURRENT_USER",
        "HKEY_LOCAL_MACHINE", "HKEY_CLASSES_ROOT"
    ])


def rand_reg_path():
    segments = [
        "".join(random.choices(string.ascii_letters + string.digits + "._-", k=8))
        for _ in range(random.randint(2, 6))
    ]
    return rand_hive() + "\\" + "\\".join(segments)


def rand_persistence_path():
    return random.choice([
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Run",
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\RunOnce",
    ])


def rand_reg_value():
    return random.choice(["REG_SZ", "REG_DWORD", "REG_BINARY", "REG_QWORD"])


def random_noise(n=200):
    chars = string.ascii_letters + string.digits + ":./[]%_-"
    return "".join(random.choice(chars) for _ in range(n))


# -----------------------------
# Build large mixed input
# -----------------------------

def build_large_registry_input(size_kb=500):
    generators = [
        rand_reg_path,
        rand_persistence_path,
        rand_reg_value,
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
def test_registry_keys_large_input_performance():
    """Ensure registry detector handles ~1MB mixed content quickly."""
    text = build_large_registry_input(1000) # ~1MB
    start = time.perf_counter()
    result = plugin.detect(text, None)
    duration = time.perf_counter() - start

    print(f"[perf] registry-keys 1MB mixed-content: {duration:.4f}s")

    assert duration < 1.0, f"Registry key detector too slow: {duration:.3f}s"


@pytest.mark.performance
def test_registry_keys_pathological_performance():
    """
    Worst-case for regex engines:
    - extremely deep registry paths
    - long segments
    - repeated separators
    """
    pathological = "HKCU\\" + "\\".join("A" * 200 for _ in range(2000))

    start = time.perf_counter()
    result = plugin.detect(pathological, None)
    duration = time.perf_counter() - start

    print(f"[perf] pathological deep registry path: {duration:.4f}s")

    assert duration < 0.5, f"Pathological input too slow: {duration:.3f}s"


@pytest.mark.performance
def test_registry_keys_scaling_behavior():
    """Ensure roughly linear scaling with input size."""

    # Warm-up run to stabilize regex engine
    plugin.detect(build_large_registry_input(200), None)

    sizes = [300, 600, 1000, 1500] # KB
    timings = []

    for size in sizes:
        text = build_large_registry_input(size)

        # median of 3 runs to reduce noise
        runs = []
        for _ in range(3):
            start = time.perf_counter()
            plugin.detect(text, None)
            runs.append(time.perf_counter() - start)

        duration = sorted(runs)[1] # median
        timings.append(duration)
        print(f"[perf] registry-keys {size}KB: {duration:.4f}s")

    # Ensure no superlinear blow-up (allow 2.5× growth per doubling)
    for i in range(1, len(timings)):
        assert timings[i] < timings[i-1] * 2.5, "Non-linear scaling detected"
