# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Aginit, please do not open a public issue.

Instead, please send a responsible disclosure report directly to the repository maintainer via GitHub Private Vulnerability Reporting or email at `security@antomanc.com`.

Please include:
- A description of the issue and potential impact
- Steps to reproduce or a proof of concept
- Any potential mitigations you have identified

We appreciate your effort to responsibly disclose vulnerabilities and will investigate all reports promptly.

## Upstream Dependencies & Agent Execution

Aginit executes commands on your local machine using standard system utilities (`git`, `node`, `pnpm`, `npx`). All skills are installed via the open `skills.sh` engine directly from upstream sources into `.agents/skills/`.

Always verify third-party skills before running arbitrary agent routines in high-security environments.
