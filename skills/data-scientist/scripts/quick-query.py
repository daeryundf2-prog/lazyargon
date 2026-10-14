#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "duckdb",
#     "polars",
#     "numpy",
#     "pyarrow",
#     "typer",
#     "rich",
# ]
# ///

"""Quick data query runner. SQL arg -> DuckDB; --filter (Polars SQL) -> Polars; --describe -> schema + stats."""

from __future__ import annotations

import sys
from pathlib import Path

sys.dont_write_bytecode = True

import typer
from rich import print as rprint
from rich.table import Table

MAX_DISPLAY_ROWS = 200


def _run_duckdb(file_path: Path, sql: str) -> None:
    import duckdb

    escaped_path = str(file_path).replace("'", "''")
    table_ref = f"'{escaped_path}'"
    con = duckdb.connect()
    for view_name in ("data", "df", "t"):
        con.execute(f"CREATE OR REPLACE TEMP VIEW {view_name} AS SELECT * FROM {table_ref}")
    stem = file_path.stem
    if stem.isidentifier() and stem not in ("data", "df", "t"):
        con.execute(f'CREATE OR REPLACE TEMP VIEW "{stem}" AS SELECT * FROM {table_ref}')

    result = con.sql(sql)
    df = result.pl()
    _print_polars(df)


def _run_polars_filter(file_path: Path, expr: str) -> None:
    import polars as pl

    df = _read_file(file_path)
    filtered = df.filter(pl.sql_expr(expr))
    _print_polars(filtered)


def _run_describe(file_path: Path) -> None:
    df = _read_file(file_path)

    rprint(f"\n[bold]Schema:[/bold] {file_path.name} ({len(df)} rows × {len(df.columns)} cols)")
    for name, dtype in zip(df.columns, df.dtypes):
        rprint(f"  {name}: [cyan]{dtype}[/cyan]")

    rprint("\n[bold]Statistics:[/bold]")
    _print_polars(df.describe())


def _read_file(file_path: Path):  # noqa: ANN202
    import polars as pl

    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pl.read_csv(file_path)
    if suffix == ".parquet":
        return pl.read_parquet(file_path)
    if suffix == ".json":
        return pl.read_json(file_path)
    if suffix in (".jsonl", ".ndjson"):
        return pl.read_ndjson(file_path)
    rprint(f"[red]Unsupported format:[/red] {suffix} (Excel: export to CSV or Parquet first)")
    raise SystemExit(1)


def _print_polars(df, max_rows: int = MAX_DISPLAY_ROWS) -> None:  # noqa: ANN001
    table = Table(show_lines=False)
    for col_name in df.columns:
        table.add_column(col_name)
    total_rows = df.shape[0]
    display_df = df.head(max_rows) if total_rows > max_rows else df
    for row in display_df.iter_rows():
        table.add_row(*(str(v) for v in row))
    rprint(table)
    if total_rows > max_rows:
        rprint(f"[dim]Showing first {max_rows} of {total_rows} rows × {df.shape[1]} cols[/dim]")
    else:
        rprint(f"[dim]{total_rows} rows × {df.shape[1]} cols[/dim]")


def main(
    file: Path = typer.Argument(help="Data file (csv, parquet, json, ndjson)"),
    sql: str = typer.Argument(None, help="SQL query (uses DuckDB). Use 'data' as table name."),
    filter_expr: str = typer.Option(None, "--filter", "-f", help="Polars SQL filter, e.g. 'amount > 100'"),
    describe: bool = typer.Option(False, "--describe", "-d", help="Print schema + stats"),
) -> None:
    """Query data files with DuckDB (SQL) or Polars (SQL filter expressions)."""
    if not file.exists():
        rprint(f"[red]File not found:[/red] {file}")
        raise SystemExit(1)

    if describe:
        _run_describe(file)
    elif filter_expr:
        _run_polars_filter(file, filter_expr)
    elif sql:
        _run_duckdb(file, sql)
    else:
        _run_describe(file)


if __name__ == "__main__":
    typer.run(main)
