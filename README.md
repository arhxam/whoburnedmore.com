# whoburnedmore 🔥

<div align="center">

**Find out who burned more — submit your AI coding-agent token usage to the public leaderboard or run it locally!**

[![NPM Version](https://img.shields.io/npm/v/whoburnedmore.svg?style=for-the-badge&color=orange)](https://www.npmjs.com/package/whoburnedmore)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=for-the-badge)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/amiinwani/whoburnedmore.com/ci.yml?branch=main&style=for-the-badge)](https://github.com/amiinwani/whoburnedmore.com/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#architectural-overview">Architectural Overview</a> •
  <a href="#installation--usage">Quick Start</a> •
  <a href="#commands">Commands</a> •
  <a href="#advanced-configuration">Configuration</a> •
  <a href="#privacy--security-hardening">Privacy & Security</a> •
  <a href="#development--contribution">Contributing</a>
</p>

</div>

---

`whoburnedmore` is the ultimate developer tool for tracking, analyzing, and sharing token usage across AI coding assistants. It reads your local coding-agent telemetry, computes accurate token and cost statistics, and helps you publish daily aggregate numbers to a unified leaderboard.

🚀 **This is the real, production CLI** — the exact code published to npm and run on thousands of developers' machines. This repository is a public, always-in-sync open-source mirror of the tool.

---

## ⚡ Key Features

- 📊 **Multi-Agent Tracking**: Aggregates token statistics across Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor, and more.
- 🔒 **Privacy-First**: No prompts, code snippets, file contents, file paths, or repository names ever leave your machine. Only aggregate numbers (totals) are synchronized.
- 🖥️ **Offline Local Dashboard**: Run with `--local` to build a beautiful, fully interactive HTML dashboard on your machine without making any network requests.
- 🕒 **Automatic Background Sync**: Heals, configures, and maintains a lightweight background sync loop (15-min interval) using native operating system schedulers (`launchd`, `systemd`, `cron`, `schtasks`).
- 💵 **Cost Estimation**: Estimates USD cost for unrecognized models locally using a tiny, accurate, and up-to-date pricing table.

---

## 📐 Architectural Overview

`whoburnedmore` functions as a robust, lightweight client-side collection pipeline. It utilizes parallel execution workers to keep collection fast and transparent.

```
┌────────────────────────────────────────────────────────┐
│                      LOCAL MACHINE                     │
│                                                        │
│  ┌───────────────────┐    ┌─────────────────────────┐  │
│  │   Coding Agents   │    │  Claude Code / Codex    │  │
│  │  (Claude, Gemini) │    │       Transcripts       │  │
│  └─────────┬─────────┘    └────────────┬────────────┘  │
│            │ (via ccusage)             │               │
│            ▼                           ▼               │
│  ┌──────────────────────────────────────────────────┐  │
│  │               whoburnedmore CLI                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ 1. Collect & Map Daily Usage Data          │  │  │
│  │  │ 2. Deduplicate and Cap Payload Rows        │  │  │
│  │  │ 3. Compute Estimated Costs (Pricing Table) │  │  │
│  │  └──────────────────────┬─────────────────────┘  │  │
│  └─────────────────────────┼────────────────────────┘  │
│                            │                           │
│              (Secure HTTPS │ --local Mode (Offline)    │
│              Anonymous     ├───► Local HTML Dashboard  │
│              Submission)   │     (Opened in Browser)   │
│                            ▼                           │
└────────────────────────────┼───────────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │   Leaderboard API           │
              │   (Specified via Env/Config)│
              └─────────────────────────────┘
```

The system is composed of several core blocks working in synergy:

### 1. Data Collection & Extraction Flow

The collection pipeline (`src/collect.ts`) executes all tasks concurrently to minimize wall-clock latency:

- **`ccusage` Broker**: Dispatches concurrent subprocesses utilizing the bundled `ccusage` binary to read usage databases for supported agents (`claude`, `codex`, `gemini`, `copilot`, `opencode`, `amp`, `droid`, `goose`, `kimi`, `qwen`, `kilo`, `openclaw`, `hermes`, `pi`, `codebuff`).
- **Transcript Analyzer (`src/attribution.ts`)**: Scans local transcript log directories (such as `~/.claude/projects` and `~/.codex/sessions`) using an incremental, yield-based scanner that respects a 12-second time budget. It extracts tool-call counts, errors, and subagent invocation telemetry without looking at prompts, code, project/repo names, or conversation titles.
- **Cursor API Integrator (`src/cursor.ts`)**: Locates the local global storage SQLite database (`state.vscdb`) on the machine, extracts the WorkOS session token, constructs a secure cookie, and performs paginated HTTP requests to Cursor's server to collect personal usage events.

### 2. Aggregation & Verification

- **Deduplication**: Merges multiple logs covering matching daily windows, models, and tools to prevent database unique-key collisions when bulk-writing.
- **Cost Estimation (`src/pricing.ts`)**: For untracked costs in local transcripts, it maps known models (e.g., Anthropic Claude Sonnet/Opus, OpenAI GPT-4o, Google Gemini Flash) against a lightweight, hardcoded local pricing lookup table to calculate representative expenditures.
- **Payload Capping**: Limits submitted daily records (max 20,000) and session records (max 10,000) to ensure strict adherence to API rate/size boundaries, preventing larger accounts from failing validation checks.

### 3. Background Synchronization (`src/autosync.ts`)

Once initialized via the CLI, the scheduler configures a 15-minute sync interval. It dynamically inspects the host platform and installs a persistent background job using native schedulers:

- **macOS**: Configures a launchd plist (`com.whoburnedmore.sync.plist`) at `~/Library/LaunchAgents`.
- **Linux**: Prefers a systemd user timer (`whoburnedmore-sync.timer` & `whoburnedmore-sync.service` in `~/.config/systemd/user`) or fallback system-level cron.
- **Windows**: Registers a Scheduled Task under the Windows Task Scheduler (`schtasks`).
- **Foreground Daemon (`src/daemon.ts`)**: For ephemeral environments (e.g., containers, minimal VMs), users can run `whoburnedmore daemon` to keep syncing in the foreground.

---

## 📦 Installation & Usage

Run immediately using `npx` (fully zero-install and lightweight):

```bash
npx whoburnedmore
```

Or install it globally to always have it at your fingertips:

```bash
npm install -g whoburnedmore
whoburnedmore
```

---

## 🛠️ Commands

| Command                        | Description                                                                                             |
| :----------------------------- | :------------------------------------------------------------------------------------------------------ |
| `whoburnedmore`                | Sync current token usage, land on the leaderboard, and open your web dashboard.                         |
| `whoburnedmore --local`        | Generate an offline dashboard (HTML file) on your local machine and open it. No network calls are made. |
| `whoburnedmore --dry-run`      | Output the exact JSON payload that would be sent to the server, then terminate.                         |
| `whoburnedmore --no-submit`    | Collect token statistics locally and refresh the scheduler without uploading any data.                  |
| `whoburnedmore private`        | Make your leaderboard profile private.                                                                  |
| `whoburnedmore public`         | Restore public visibility of your leaderboard profile.                                                  |
| `whoburnedmore remove`         | Completely delete your dashboard and all its aggregated data from the server.                           |
| `whoburnedmore status`         | Display background sync status, check job health, and report freshness metrics.                         |
| `whoburnedmore install-sync`   | Explicitly turn on/install the 15-minute background sync job on your OS.                                |
| `whoburnedmore uninstall-sync` | Turn off and permanently uninstall the background sync scheduler.                                       |

---

## ⚙️ Advanced Configuration

Custom environment variables are automatically loaded from a `.env` file in your current directory or from the user configuration folder:

| Environment Variable        | Description                                                                                                                         |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `WHOBURNEDMORE_API`         | The base URL of the leaderboard API.                                                                                                |
| `WHOBURNEDMORE_WEB`         | The base URL of the front-end web dashboard.                                                                                        |
| `WHOBURNEDMORE_ROOT_DOMAIN` | The root tenant domain of the application.                                                                                          |
| `WHOBURNEDMORE_CONFIG_DIR`  | Folder path where identity credentials (`config.json`), offline assets, and logs are persisted. Default: `~/.config/whoburnedmore`. |
| `CLAUDE_CONFIG_DIR`         | Custom location to scan for Claude Code transcripts.                                                                                |

---

## 🛡️ Privacy & Security Hardening

This client was engineered from the ground up to guarantee absolute transparency and security:

- **Domain Restriction**: Prevents malicious link redirects. Auto-opened dashboard links are parsed and verified to ensure they only match your trusted `WHOBURNEDMORE_WEB` configuration.
- **Strict Shell Sanitization**: Background scheduler arguments (POSIX cron, macOS plist, Windows Task parameters) are comprehensively quoted, escaped, and normalized to prevent arbitrary shell injection.
- **Restricted File Privileges**: Local state configurations containing the secure identity keys are saved at a strict POSIX mode `0600` (readable/writable only by the owner) using transactional temp-write and atomic-rename operations.
- **Zero Telemetry**: No third-party tracking, crash reporting, or analytical payloads. You are completely in control of your data.

---

## 💻 Development & Contribution

We welcome contributions from the community! To set up `whoburnedmore` locally and start hacking:

### 1. Prerequisites

Ensure you have **Node.js 20+** and **npm** installed on your platform.

### 2. Setup

```bash
# Clone the repository
git clone https://github.com/amiinwani/whoburnedmore.com.git
cd whoburnedmore.com

# Install dependencies and perform initial build
npm install
```

### 3. Verification & Testing

Before opening a Pull Request, run the verification commands to check type safety and suite integrity:

```bash
# Run the test suite (Vitest)
npm test

# Check code typing
npm run lint

# Compile and bundle the source
npm run build
```

Please review [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines and codebase styles.

---

## 📄 License

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
