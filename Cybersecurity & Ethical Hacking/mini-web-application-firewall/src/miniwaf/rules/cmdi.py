"""OS Command Injection (RCE) detection rules."""

from miniwaf.models.enums import AttackType, LocationTarget, RuleSeverity
from miniwaf.models.rules import WAFRule

CMDI_RULES: list[WAFRule] = [
    WAFRule(
        rule_id="RULE-CMDI-001",
        name="Shell Command Chaining Separators",
        category=AttackType.CMDI,
        severity=RuleSeverity.CRITICAL,
        paranoia_level=1,
        pattern=r"(?:;|\|\||&&|`|\$\()\s*(?:whoami|id|cat|ls|uname|ping|curl|wget|bash|sh|nc)\b",
        target=LocationTarget.ANY,
        cwe_id="CWE-78",
        description="Detects shell metacharacters chained with common Unix commands.",
        remediation="Avoid invoking subshells; use parameterized APIs like subprocess.run(list).",
    ),
    WAFRule(
        rule_id="RULE-CMDI-002",
        name="Unix Binary Invocation Paths",
        category=AttackType.CMDI,
        severity=RuleSeverity.HIGH,
        paranoia_level=1,
        pattern=r"/(?:bin|usr/bin|usr/sbin)/(?:sh|bash|zsh|dash|python|perl|ruby|nc|curl|wget)\b",
        target=LocationTarget.ANY,
        cwe_id="CWE-78",
        description="Detects direct filesystem paths to command line interpreters and binaries.",
        remediation="Enforce strict input validation against character whitelists.",
    ),
    WAFRule(
        rule_id="RULE-CMDI-003",
        name="Windows Command Line Executables",
        category=AttackType.CMDI,
        severity=RuleSeverity.HIGH,
        paranoia_level=1,
        pattern=r"\b(?:cmd\.exe|powershell(?:\.exe)?|certutil(?:\.exe)?)\b",
        target=LocationTarget.ANY,
        cwe_id="CWE-78",
        description="Detects Windows cmd or PowerShell execution commands.",
        remediation="Disallow execution of command interpreters via user inputs.",
    ),
]
