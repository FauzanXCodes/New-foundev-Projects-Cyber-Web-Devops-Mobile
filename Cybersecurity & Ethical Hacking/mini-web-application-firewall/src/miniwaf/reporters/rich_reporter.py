"""Rich console formatter for CLI inspections and live event display."""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from miniwaf.models.decision import WAFDecision
from miniwaf.models.enums import WAFAction


class RichConsoleReporter:
    """Renders colorized terminal tables for WAF decisions."""

    def __init__(self, console: Console | None = None) -> None:
        self.console = console or Console()

    def print_decision(self, decision: WAFDecision, method: str, path: str) -> None:
        """Render a styled panel and summary table for an inspected transaction."""
        action_style = "bold red" if decision.action == WAFAction.BLOCK else "bold green"
        title = f"[{action_style}]WAF DECISION: {decision.action.value}[/{action_style}]"

        summary_table = Table(show_header=False, box=None)
        summary_table.add_column("Field", style="bold cyan", width=18)
        summary_table.add_column("Value", style="white")

        summary_table.add_row("Request ID", decision.request_id)
        summary_table.add_row("Client IP", decision.client_ip)
        summary_table.add_row("Method / Path", f"{method} {path}")
        summary_table.add_row(
            "Anomaly Score",
            f"{decision.total_score} (Threshold: {decision.threshold})",
        )
        summary_table.add_row("Latency", f"{decision.execution_time_ms:.2f} ms")
        if decision.blocked_reason:
            summary_table.add_row("Block Reason", f"[red]{decision.blocked_reason}[/red]")

        self.console.print(Panel(summary_table, title=title, expand=False))

        if decision.matches:
            matches_table = Table(title="Triggered Security Rules", expand=False)
            matches_table.add_column("Rule ID", style="bold yellow")
            matches_table.add_column("Category", style="magenta")
            matches_table.add_column("Target", style="cyan")
            matches_table.add_column("Severity", style="red")
            matches_table.add_column("Score", justify="right")
            matches_table.add_column("Matched Snippet", style="dim white")

            for m in decision.matches:
                matches_table.add_row(
                    m.rule.rule_id,
                    m.rule.category.value,
                    m.target.value,
                    m.rule.severity.value,
                    str(m.rule.score),
                    m.sample_snippet[:60],
                )

            self.console.print(matches_table)
