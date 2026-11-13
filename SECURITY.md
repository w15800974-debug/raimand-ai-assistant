# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Architecture

Raimand is designed with local-first security boundaries:
- **Sandboxed File Access**: File system tools are strictly restricted to the configured `workspaceRoot` and explicitly attached folders (`src/lib/paths.ts`). Path traversal attempts outside allowed roots are rejected.
- **Tool Execution Approvals**: System commands and sensitive actions follow configurable `allow` / `ask` / `deny` policies (`src/lib/approvals.ts`).
- **Local Credential Storage**: Model provider API keys and search credentials are stored in your local PostgreSQL instance rather than committed to source files.

## Reporting a Vulnerability

If you discover a security vulnerability in Raimand, please do **not** open a public issue. Instead, report it responsibly by opening a private Security Advisory on GitHub or contacting the maintainer directly via GitHub (`@w15800974-debug`).

Please include:
- A clear description of the vulnerability and potential impact.
- Steps to reproduce or a minimal proof of concept.
- Any suggested remediation if available.
