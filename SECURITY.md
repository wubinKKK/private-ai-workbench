# Security and data handling

Do not attach API keys, cookies, tokens, personal indexes or private project inputs to public issues. If GitHub private vulnerability reporting is available, use it for sensitive findings; otherwise open an issue describing how to contact you without including the secret.

The source scanner checks common secret formats and personal home paths. It is a publication aid, not proof that arbitrary user-provided text is safe to publish. Inspect the file manifest and diff before a release.

Indexing is limited to explicit workspace-relative roots, without external directory links. Indexes contain source text and must remain private. The data worker reads one explicit input before disabling external access, accepts one SELECT statement, limits output, and runs with a process deadline. MCP is stdio and read-only; it does not implement host-level user permissions or make model-provider privacy guarantees.
