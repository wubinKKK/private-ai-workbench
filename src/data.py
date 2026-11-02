"""Single-file analytical queries using an isolated, pinned DuckDB runtime."""
import datetime
import decimal
import json
import math
import pathlib
import sys

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")


def clean(value):
    if isinstance(value, int) and not isinstance(value, bool) and abs(value) > 9007199254740991:
        return str(value)
    if isinstance(value, (datetime.date, datetime.datetime, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, (list, tuple)):
        return [clean(item) for item in value]
    if isinstance(value, dict):
        return {str(key): clean(item) for key, item in value.items()}
    return value


def query(request):
    import duckdb
    source = pathlib.Path(request["input"]).resolve(strict=True)
    readers = {".csv": "read_csv_auto", ".tsv": "read_csv_auto", ".json": "read_json_auto", ".jsonl": "read_json_auto", ".ndjson": "read_json_auto", ".parquet": "read_parquet"}
    if not source.is_file() or source.suffix.lower() not in readers:
        raise ValueError("仅支持指定的本地 CSV、TSV、JSON、JSONL、NDJSON 或 Parquet 文件。")
    if any(char in str(source) for char in "*?["):
        raise ValueError("文件名含有通配符字符，请先使用不含 * ? [ 的文件名。")
    limit = int(request.get("limit", 100))
    if not 1 <= limit <= 1000:
        raise ValueError("结果上限必须在 1–1000 行之间。")
    connection = duckdb.connect(":memory:", config={"threads": 2, "memory_limit": "1GB", "temp_directory": "", "autoinstall_known_extensions": "false", "autoload_known_extensions": "false", "allow_unsigned_extensions": "false"})
    try:
        # Only this explicit file is read before user SQL is accepted.
        connection.execute("CREATE TABLE data AS SELECT * FROM " + readers[source.suffix.lower()] + "(?)", [str(source)])
        connection.execute("SET enable_external_access = false")
        connection.execute("SET lock_configuration = true")
        statements = connection.extract_statements(request["sql"])
        if len(statements) != 1 or statements[0].type != duckdb.StatementType.SELECT:
            raise ValueError("只允许单条 SELECT 或 WITH…SELECT 查询。")
        schema = [{"name": row[0], "type": row[1]} for row in connection.execute("DESCRIBE data").fetchall()]
        total = connection.execute("SELECT COUNT(*) FROM data").fetchone()[0]
        cursor = connection.execute(request["sql"])
        columns = [item[0] for item in cursor.description]
        rows = cursor.fetchmany(limit + 1)
        return {"ok": True, "engine": "DuckDB " + duckdb.__version__, "source": str(source), "inputRows": total, "inputSchema": schema, "columns": columns, "rows": clean(rows[:limit]), "truncated": len(rows) > limit, "readOnly": True, "externalAccess": False}
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        result = query(json.load(sys.stdin))
    except Exception as error:
        print(json.dumps({"ok": False, "error": "数据查询未完成：" + str(error)}, ensure_ascii=False))
        sys.exit(1)
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
