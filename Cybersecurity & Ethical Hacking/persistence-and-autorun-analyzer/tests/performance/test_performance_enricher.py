import pytest
import time
import random
import string

from iocx_registry_keys.enricher import Plugin as EnricherPlugin
from iocx.models import Detection, PluginContext


# Instantiate plugin once
plugin = EnricherPlugin()


# -----------------------------
# Random registry key generators
# -----------------------------

def rand_hive():
    return random.choice([
        "HKCU", "HKLM", "HKCR", "HKU",
        "HKEY_CURRENT_USER", "HKEY_LOCAL_MACHINE"
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


def random_noise(n=200):
    chars = string.ascii_letters + string.digits + ":./[]%_-"
    return "".join(random.choice(chars) for _ in range(n))


# -----------------------------
# Build large detection sets
# -----------------------------

def build_large_detection_set(count=50_000):
    detections = []
    for _ in range(count):
        key = (
            rand_persistence_path()
            if random.random() < 0.4
            else rand_reg_path()
        )
        detections.append(
            Detection(
                value=key,
                start=0,
                end=len(key),
                category="registry-keys"
            )
        )
    return detections


def build_mixed_detection_map(reg_count=50_000, other_count=10_000):
    reg = build_large_detection_set(reg_count)
    urls = [
        Detection(
            value=f"http://example.com/{i}",
            start=0,
            end=10,
            category="urls"
        )
        for i in range(other_count)
    ]
    return {"registry-keys": reg, "urls": urls}


# -----------------------------
# Performance Tests
# -----------------------------

@pytest.mark.performance
def test_enricher_large_registry_set_performance():
    """Ensure enricher handles 50k registry detections quickly."""
    detections = build_large_detection_set(50_000)

    ctx = PluginContext(
        file_path=None,
        raw_text="dummy",
        logger=None,
        config={},
        detections={"registry-keys": detections},
    )

    start = time.perf_counter()
    plugin.enrich("dummy", ctx)
    duration = time.perf_counter() - start

    print(f"[perf] enricher 50k registry detections: {duration:.4f}s")

    assert duration < 0.5, f"Enricher too slow: {duration:.3f}s"


@pytest.mark.performance
def test_enricher_mixed_categories_performance():
    """Ensure enricher handles mixed categories without slowdown."""
    detections = build_mixed_detection_map(40_000, 20_000)

    ctx = PluginContext(
        file_path=None,
        raw_text="dummy",
        logger=None,
        config={},
        detections=detections,
    )

    start = time.perf_counter()
    plugin.enrich("dummy", ctx)
    duration = time.perf_counter() - start

    print(f"[perf] enricher mixed 60k detections: {duration:.4f}s")

    assert duration < 0.6, f"Enricher too slow on mixed categories: {duration:.3f}s"


@pytest.mark.performance
def test_enricher_pathological_performance():
    """
    Worst-case for substring scanning:
    - extremely long registry paths
    - repeated patterns
    """
    pathological_key = "HKCU\\" + "\\".join("A" * 200 for _ in range(2000))

    ctx = PluginContext(
        file_path=None,
        raw_text="dummy",
        logger=None,
        config={},
        detections={
            "registry-keys": [
                Detection(pathological_key, 0, len(pathological_key), "registry-keys")
            ]
        },
    )

    start = time.perf_counter()
    plugin.enrich("dummy", ctx)
    duration = time.perf_counter() - start

    print(f"[perf] enricher pathological key: {duration:.4f}s")

    assert duration < 0.1, f"Pathological input too slow: {duration:.3f}s"


@pytest.mark.performance
def test_enricher_scaling_behavior():
    """Ensure roughly linear scaling with detection count."""

    # Warm-up
    warm = build_large_detection_set(10_000)
    plugin.enrich("dummy", PluginContext(None, "dummy", None, {}, {"registry-keys": warm}))

    sizes = [10_000, 20_000, 40_000, 80_000]
    timings = []

    for size in sizes:
        dets = build_large_detection_set(size)
        ctx = PluginContext(None, "dummy", None, {}, {"registry-keys": dets})

        runs = []
        for _ in range(3):
            start = time.perf_counter()
            plugin.enrich("dummy", ctx)
            runs.append(time.perf_counter() - start)

        duration = sorted(runs)[1] # median
        timings.append(duration)
        print(f"[perf] enricher {size} detections: {duration:.4f}s")

    # Allow up to 2.5× growth per doubling
    for i in range(1, len(timings)):
        assert timings[i] < timings[i-1] * 2.5, "Non-linear scaling detected"
