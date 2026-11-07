"""Command-line interface for mini-waf."""

import urllib.parse
from typing import Annotated

import typer
from rich.console import Console
from rich.table import Table

from miniwaf import __version__
from miniwaf.config.settings import WAFSettings
from miniwaf.core.engine import WAFEngine
from miniwaf.core.normalizer import RequestNormalizer
from miniwaf.reporters.rich_reporter import RichConsoleReporter
from miniwaf.rules import create_default_registry

app = typer.Typer(
    name="miniwaf",
    help="Mini Web Application Firewall CLI and diagnostic inspection toolkit",
    no_args_is_help=True,
)
console = Console()
_reporter = RichConsoleReporter(console)


@app.command("version")
def show_version() -> None:
    """Display MiniWAF version."""
    console.print(f"[bold cyan]MiniWAF[/bold cyan] version [bold green]{__version__}[/bold green]")


@app.command("rules")
def list_rules(
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="Filter by attack category (e.g. SQLI, XSS)"),
    ] = None,
    target: Annotated[
        str | None,
        typer.Option("--target", "-t", help="Filter by HTTP target (e.g. QUERY_PARAM, BODY)"),
    ] = None,
    paranoia: Annotated[
        int,
        typer.Option("--paranoia", "-p", help="Maximum paranoia level to display (1-4)"),
    ] = 4,
) -> None:
    """List registered WAF detection rules and signatures."""
    registry = create_default_registry()
    rules = registry.all_rules()

    if category:
        cat_upper = category.upper().strip()
        rules = [r for r in rules if r.category.value == cat_upper]

    if target:
        target_upper = target.upper().strip()
        rules = [r for r in rules if r.target.value == target_upper]

    rules = [r for r in rules if r.paranoia_level <= paranoia]

    table = Table(title=f"MiniWAF Registered Inspection Rules ({len(rules)} total)")
    table.add_column("Rule ID", style="bold yellow", no_wrap=True)
    table.add_column("Category", style="magenta")
    table.add_column("Severity", style="red")
    table.add_column("PL", justify="center")
    table.add_column("Target", style="cyan")
    table.add_column("Score", justify="right")
    table.add_column("Name", style="white")

    for r in sorted(rules, key=lambda x: (x.category.value, x.rule_id)):
        table.add_row(
            r.rule_id,
            r.category.value,
            r.severity.value,
            str(r.paranoia_level),
            r.target.value,
            str(r.score),
            r.name,
        )

    console.print(table)


@app.command("test")
def test_payload(
    url: Annotated[str, typer.Option("--url", "-u", help="URL or path with query params to test")],
    method: Annotated[
        str, typer.Option("--method", "-m", help="HTTP Method (GET, POST, etc.)")
    ] = "GET",
    body: Annotated[
        str | None, typer.Option("--body", "-b", help="Raw request body or payload")
    ] = None,
    client_ip: Annotated[
        str, typer.Option("--client-ip", "-ip", help="Client source IP")
    ] = "127.0.0.1",
    mode: Annotated[str, typer.Option("--mode", help="Operating mode: BLOCK or MONITOR")] = "BLOCK",
    threshold: Annotated[int, typer.Option("--threshold", help="Anomaly score threshold")] = 5,
) -> None:
    """Simulate WAF inspection against an HTTP transaction and display evaluation."""
    parsed = urllib.parse.urlparse(url)
    path = parsed.path if parsed.path else "/"
    query_string = parsed.query

    settings = WAFSettings(
        mode="BLOCK" if mode.upper() == "BLOCK" else "MONITOR",
        anomaly_threshold=threshold,
    )
    engine = WAFEngine(settings=settings)

    headers = {"User-Agent": "MiniWAF-CLI-Tester/1.0"}
    raw_body = body.encode("utf-8") if body else b""

    ctx = RequestNormalizer.build_context(
        method=method,
        path=path,
        client_ip=client_ip,
        headers=headers,
        query_string=query_string,
        raw_body=raw_body,
    )

    decision = engine.inspect_request(ctx)
    _reporter.print_decision(decision, method=method, path=path)


@app.command("unjail")
def unjail_ip(
    ip: Annotated[str, typer.Argument(help="Client IP address to release from jail")],
) -> None:
    """Manually release a banned IP address from dynamic jail."""
    engine = WAFEngine()
    engine.ratelimiter.jail.release(ip)
    console.print(f"[bold green]Successfully released IP {ip} from jail.[/bold green]")


if __name__ == "__main__":
    app()
