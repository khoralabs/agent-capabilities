# Security policy

## Supported versions

Security fixes are applied to the latest release on the default branch. Older major/minor lines may not receive backports unless noted in release notes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

1. Use [GitHub private vulnerability reporting](https://github.com/khoralabs/agent-capabilities/security/advisories/new) for this repository, if enabled, **or**
2. Contact the maintainers through your organization's usual secure channel if you are an internal contributor.

Include:

- A clear description of the issue and impact
- Steps to reproduce or a minimal proof of concept
- Affected package versions and commit SHA if known

We aim to acknowledge reports within a few business days and will coordinate disclosure timing with you.

## Scope notes

This library hashes capability definitions and helps hosts record attribution metadata. It does **not** provide authentication, authorization for end users, or encrypted storage. Hosts remain responsible for protecting persistence backends, API keys, and model provider credentials.
