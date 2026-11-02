# Third-party notices

This source release does not vendor third-party Skills, browser profiles, binaries, model weights or datasets. Dependencies are installed separately from their official registries using package-lock.json and requirements.txt.

| Dependency | Pinned version | License | Source |
| --- | --- | --- | --- |
| MiniSearch | 7.2.0 | MIT | https://github.com/lucaong/minisearch |
| Model Context Protocol TypeScript SDK | 1.32.2 | MIT | https://github.com/modelcontextprotocol/typescript-sdk |
| DuckDB Python package, optional | 1.5.6 | MIT | https://github.com/duckdb/duckdb |

Transitive JavaScript dependencies retain their upstream licenses, recorded in package-lock.json and their installed package directories. This repository's MIT license does not replace them.

The local query worker and UTF-8 ZIP utility were carried over from the author's existing workbench. Search tokenization, source hashing and read-only MCP patterns were adapted from the same codebase. Only these generic implementations were reused; no private notes, personal state, credentials, project assets or old Git objects were imported.

GitHub, OpenCLI, MarkItDown, Obsidian, Godot, FFmpeg and OpenMontage are optional external integrations. Their names identify compatible tools; their code and assets are not included. Review their own terms before installing or redistributing them.
