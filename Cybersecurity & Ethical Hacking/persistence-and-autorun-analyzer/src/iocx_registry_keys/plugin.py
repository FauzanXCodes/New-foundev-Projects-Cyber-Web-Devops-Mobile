import re
from iocx.plugins.api import IOCXPlugin
from iocx.plugins.metadata import PluginMetadata
from iocx.models import Detection, PluginContext

REGISTRY_REGEX = re.compile(
    r"""
    \b
    (?:HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER|HKEY_CLASSES_ROOT|
       HKEY_USERS|HKEY_CURRENT_CONFIG|
       HKLM|HKCU|HKCR|HKU|HKCC)
    \\
    [^\s"'\\]
    +(?:\\[^\s"'\\]+)*
    """,
    re.IGNORECASE | re.VERBOSE,
)

REG_VALUE_REGEX = re.compile(
    r"\bREG_(?:SZ|DWORD|BINARY|EXPAND_SZ|MULTI_SZ|QWORD)\b",
    re.IGNORECASE,
)

PERSISTENCE_PATTERNS = [
    r"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
    r"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
    r"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce",
    r"HKLM\\SYSTEM\\CurrentControlSet\\Services\\[A-Za-z0-9_\-]+",
]

PERSISTENCE_REGEX = re.compile("|".join(PERSISTENCE_PATTERNS), re.IGNORECASE)


class Plugin(IOCXPlugin):
    metadata = PluginMetadata(
        id="registry-keys",
        name="Registry Key Detector",
        version="0.1.0",
        description="Detects Windows registry keys, values, and persistence locations",
        author="MalX Labs",
        capabilities=["detector"],
        iocx_min_version="0.4.0",
    )

    def detect(self, text: str, ctx: PluginContext):
        keys = []
        values = []
        persistence = []
        persistence_hits = set()

        for match in PERSISTENCE_REGEX.finditer(text):
            val = match.group(0)
            persistence_hits.add(val)
            persistence.append(
                Detection(
                    value=val,
                    start=match.start(),
                    end=match.end(),
                    category="registry.persistence",
                )
            )

        for match in REG_VALUE_REGEX.finditer(text):
            values.append(
                Detection(
                    value=match.group(0),
                    start=match.start(),
                    end=match.end(),
                    category="registry.values",
                )
            )

        for match in REGISTRY_REGEX.finditer(text):
            val = match.group(0)
            if val in persistence_hits:
                continue
            keys.append(
                Detection(
                    value=val,
                    start=match.start(),
                    end=match.end(),
                    category="registry.keys",
                )
            )

        return {
            "registry.keys": keys,
            "registry.values": values,
            "registry.persistence": persistence,
        }
