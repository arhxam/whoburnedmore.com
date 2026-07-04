# Security

`whoburnedmore` is a CLI that runs on your machine, reads your local AI-agent usage,
and submits **daily aggregate numbers** to whoburnedmore.com. This document is the threat
model — what the tool does with untrusted input and how it's hardened — because you should
be able to verify it before running it.

> **Want an independent second opinion first?** [🔍 Ask Claude to audit this repo →][audit] —
> it reads the source and reports exactly what data leaves your machine, every server it
> contacts, and whether it's safe to run, ending with a clear go / no-go verdict.

## What leaves your machine
Only bounded aggregates: per day/tool/model token counts, estimated cost, and optional
session/tool/skill/project **names + counts**. Never your prompts, code, file contents, or
file paths. `--dry-run` prints the exact payload; `--local` uploads nothing at all.

## Threat model & mitigations
- **Server-controlled URLs.** The dashboard/board URL comes back from the server. The CLI
  **only auto-opens it if it is an `https` URL on the expected web host** (`isTrustedWebUrl`),
  and the OS opener is only ever handed an `http(s)`/`file` URL (`isOpenableUrl`). A
  malicious or MITM'd response cannot make the CLI launch `javascript:`/`file:`/custom-scheme
  URLs or inject `-`-prefixed flags into `open`. (Use HTTPS; the API host is pinned.)
- **Subprocess spawns.** `ccusage`, the browser opener, and the auto-sync installers use
  fixed argv where the platform allows it. The scheduled sync command is
  `npm exec --yes --ignore-scripts --package whoburnedmore@latest -- whoburnedmore sync`:
  launchd values are XML-escaped, cron values are POSIX-quoted, and Windows task commands
  are quoted. The `ccusage` arguments are fixed constants (no server/user data).
- **Untrusted transcript input.** Malformed/huge transcript stores are bounded (file-count,
  per-file-size, and time budgets) so a pathological store cannot hang or OOM the CLI;
  duplicate rows are merged before submit.
- **Local secret.** The per-machine key lives in `~/.config/whoburnedmore/config.json` at
  mode `0600`, re-asserted on every write.
- **Local dashboard.** `--local` writes a self-contained HTML file; all user-derived values
  are HTML-escaped.
- **Supply chain.** Runtime dependencies are exact-pinned and audited.

## Reporting a vulnerability
Please report privately via **GitHub Security Advisories**
(<https://github.com/amiinwani/whoburnedmore.com/security/advisories/new>) rather than a
public issue. We aim to respond quickly.

[audit]: https://claude.ai/new?q=Please%20audit%20this%20open-source%20CLI%20for%20safety%20before%20I%20run%20it%3A%20https%3A%2F%2Fgithub.com%2Farhxam%2Fwhoburnedmore.com%0A%0AIt%20is%20run%20with%20%22npx%20whoburnedmore%22%20and%20reads%20my%20local%20AI%20coding-agent%20usage%20(Claude%20Code%2C%20Codex%2C%20Cursor%2C%20and%20similar%20tools).%20Read%20the%20ACTUAL%20source%20code%20in%20the%20repository%20and%20tell%20me%20plainly%3A%0A%0A1.%20Exactly%20what%20data%20it%20collects%2C%20and%20precisely%20what%20leaves%20my%20machine%20versus%20what%20never%20does.%0A2.%20Every%20network%20endpoint%20or%20server%20it%20contacts.%0A3.%20Whether%20it%20could%20exfiltrate%20my%20source%20code%2C%20prompts%2C%20secrets%2C%20credentials%2C%20tokens%2C%20or%20files.%0A4.%20Any%20supply-chain%2C%20subprocess%2C%20or%20background%20%2F%20auto-update%20risks.%0A%0AThen%20give%20me%20a%20final%20go%20%2F%20no-go%20verdict%3A%20is%20it%20safe%20to%20run%2C%20and%20is%20it%20trying%20to%20steal%20any%20of%20my%20data%3F
