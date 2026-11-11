"""Tiny shared SQL helper with no outside dependencies (so it also runs inside a Databricks job)."""


def sql_str(s):
    """A SQL string literal; single quotes are doubled."""
    return "'" + str(s).replace("'", "''") + "'"
