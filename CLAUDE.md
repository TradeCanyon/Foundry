# Foundry - Project Guide for Claude

## Project Overview

**Foundry** is a unified AI agent graphical interface that transforms command-line AI agents into a modern, efficient chat interface. It supports multiple CLI AI tools including Gemini CLI, Claude Code, CodeX, Qwen Code, and more.

Forked and rebranded from Foundry (Foundry/Foundry) as a foundation for a larger tooling platform.

- **License**: Apache-2.0
- **Platform**: Cross-platform (macOS, Windows, Linux)

## Tech Stack

### Core

- **Electron 37.x** - Desktop application framework
- **React 19.x** - UI framework
- **TypeScript 5.8.x** - Programming language
- **Express 5.x** - Web server (for WebUI remote access)

### Build Tools

- **Webpack 6.x** - Module bundler (via @electron-forge/plugin-webpack)
- **Electron Forge 7.8.x** - Build tooling
- **Electron Builder 26.x** - Application packaging

### UI & Styling

- **Arco Design 2.x** - Enterprise UI component library
- **UnoCSS 66.x** - Atomic CSS engine
- **Monaco Editor 4.x** - Code editor

### AI Integration

- **Anthropic SDK** - Claude API
- **Google GenAI** - Gemini API
- **OpenAI SDK** - OpenAI API
- **MCP SDK** - Model Context Protocol

### Data & Storage

- **Better SQLite3** - Local database
- **Zod** - Data validation

## Project Structure

```
src/
├── index.ts                 # Main process entry
├── preload.ts               # Electron preload (IPC bridge)
├── renderer/                # UI application
│   ├── pages/               # Page components
│   │   ├── conversation/    # Chat interface (main feature)
│   │   ├── settings/        # Settings management
│   │   ├── cron/            # Scheduled tasks
│   │   └── login/           # Authentication
│   ├── components/          # Reusable UI components
│   ├── hooks/               # React hooks
│   ├── context/             # Global state (React Context)
│   ├── services/            # Client-side services
│   ├── i18n/                # Internationalisation
│   └── utils/               # Utility functions
├── process/                 # Main process services
│   ├── database/            # SQLite operations
│   ├── bridge/              # IPC communication
│   └── services/            # Backend services
│       ├── mcpServices/     # MCP protocol (multi-agent)
│       └── cron/            # Task scheduling
├── webserver/               # Web server for remote access
│   ├── routes/              # HTTP routes
│   ├── websocket/           # Real-time communication
│   └── auth/                # Authentication
├── worker/                  # Background task workers
├── channels/                # Agent communication system
├── common/                  # Shared utilities & types
└── agent/                   # AI agent implementations
```

## Development Commands

```bash
# Development
npm start              # Start dev environment
npm run webui          # Start WebUI server

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format with Prettier

# Testing
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report

# Building
npm run build          # Full build (macOS arm64 + x64)
npm run dist:mac       # macOS build
npm run dist:win       # Windows build
npm run dist:linux     # Linux build
```

## Code Conventions

### Naming

- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE
- **Unused params**: prefix with `_`

### TypeScript

- Strict mode enabled
- Use path aliases: `@/*`, `@process/*`, `@renderer/*`, `@worker/*`
- Prefer `type` over `interface` (per ESLint config)

### React

- Functional components only
- Hooks: `use*` prefix
- Event handlers: `on*` prefix
- Props interface: `${ComponentName}Props`

### Styling

- UnoCSS atomic classes preferred
- CSS modules for component-specific styles: `*.module.css`
- Use Arco Design semantic colours

### Comments

- English for code comments
- JSDoc for function documentation

## Git Conventions

### Commit Messages

- **Language**: English
- **Format**: `<type>(<scope>): <subject>`
- **Types**: feat, fix, refactor, chore, docs, test, style, perf

Examples:

```
feat(cron): implement scheduled task system
fix(webui): correct modal z-index issue
chore: remove debug console.log statements
```

## Branding

All references to the original "AionUi" and "iOfficeAI" branding have been
replaced with "Foundry". When adding new features, use "Foundry" consistently for:

- Application name and metadata
- CSS class prefixes (use `foundry-` prefix)
- Constant prefixes (use `FOUNDRY_`)
- Component naming (use `Foundry` prefix for base components)
- Environment variables (use `FOUNDRY_` prefix)
- Storage keys (use `foundry_` prefix)

### External Dependencies Note

`@office-ai/aioncli-core` and `@office-ai/platform` are upstream npm packages
from the original project. These are external dependencies and their internal
naming is outside our control.

## Architecture Notes

### Multi-Process Model

- **Main Process**: Application logic, database, IPC handling
- **Renderer Process**: React UI
- **Worker Processes**: Background AI tasks (gemini, codex, acp workers)

### IPC Communication

- Secure contextBridge isolation
- Type-safe message system in `src/renderer/messages/`

### WebUI Server

- Express + WebSocket
- JWT authentication
- Supports remote network access

### Cron System

- Based on `croner` library
- `CronService`: Task scheduling engine
- `CronBusyGuard`: Prevents concurrent execution

## Supported AI Agents

- Claude (via MCP)
- Gemini (Google AI)
- Codex (OpenAI)
- Qwen Code
- Iflow
- Custom agents via MCP protocol

## Internationalisation

Supported languages: English (en-US), Chinese Simplified (zh-CN), Chinese Traditional (zh-TW), Japanese (ja-JP), Korean (ko-KR), Turkish (tr-TR)

Translation files: `src/renderer/i18n/locales/*.json`

## Skills Index

| Skill    | Purpose                                                              | Triggers                                               |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| **i18n** | Key naming, sync checking, hardcoded detection, translation workflow | Adding user-facing text, creating components with text |

> Skills are located in `.claude/skills/` and loaded automatically when relevant.

## Key Configuration Files

| File               | Purpose                     |
| ------------------ | --------------------------- |
| `tsconfig.json`    | TypeScript compiler options |
| `forge.config.ts`  | Electron Forge build config |
| `uno.config.ts`    | UnoCSS styling config       |
| `.eslintrc.json`   | Linting rules               |
| `.prettierrc.json` | Code formatting             |
| `jest.config.js`   | Test configuration          |

## Testing

- **Framework**: Jest + ts-jest
- **Structure**: `tests/unit/`, `tests/integration/`, `tests/contract/`
- Run with `npm test`

## Native Modules

The following require special handling during build:

- `better-sqlite3` - Database
- `node-pty` - Terminal emulation
- `tree-sitter` - Code parsing

These are configured as externals in Webpack.

---

# Operating Principles

> **Philosophy:** You are the hands; I am the architect. Move fast, but never faster than I can verify.

## Current Mode: BUILD

| Mode         | Behavior                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------- |
| **EXPLORE**  | Relaxed scope. Suggest freely. Skip planning for small experiments. Still surface assumptions. |
| **BUILD**    | Full discipline. Plan before executing. Verify before done. Strict scope.                      |
| **DEBUG**    | High autonomy. Chase the bug. Minimal check-ins until fixed.                                   |
| **REFACTOR** | Propose full scope first. Get approval on blast radius. Test equivalence.                      |

Say "switch to [MODE]" to change.

---

## Core Behaviors

### Surface Assumptions (Critical)

Before non-trivial work:

```
ASSUMPTIONS:
1. [requirement interpretation]
2. [approach]
3. [existing code/architecture assumption]
→ Proceeding unless corrected.
```

Skip for obvious single-file changes under 50 lines.

### Stop on Confusion (Critical)

When you hit inconsistencies or ambiguity: **STOP. Don't guess.**

```
CONFUSION:
- [what conflicts]
- Options: (a) ... (b) ...
- Which takes precedence?
```

### Push Back When Warranted

You're not a yes-machine. If my approach has problems:

1. Point it out directly
2. Explain the concrete downside
3. Propose an alternative
4. Accept if I override

**Sycophancy is a failure mode.** Push back on architecture, security, correctness. Not on style preferences.

### Scope Discipline

Touch only what you're asked to touch. **No unsolicited renovation.**

- Don't remove comments you don't understand
- Don't "clean up" adjacent code
- Don't delete "unused" code without asking

### Simplicity

Before finishing: Can this be fewer lines? Would a senior dev say "why didn't you just..."?

**If you build 1000 lines when 100 suffice, you've failed.**

---

## Communication Formats

### After Changes

```
CHANGES MADE:
- [file]: [what and why]

THINGS I DIDN'T TOUCH:
- [file]: [why left alone]

POTENTIAL CONCERNS:
- [risks/edge cases]
```

"THINGS I DIDN'T TOUCH" is mandatory for multi-file changes.

### Multi-Step Progress

```
PROGRESS [3/7]:
✓ Done: [what]
→ Now: [current]
○ Next: [remaining]
```

### When Stuck

```
STUCK:
- Attempting: [goal]
- Tried: [approaches]
- Blocked by: [specific issue]
- Need: [what unblocks]
```

Surface blockers within 2-3 attempts. Don't spin.

---

## Task Files

Maintain these in `tasks/`:

| File           | Purpose                                   |
| -------------- | ----------------------------------------- |
| `todo.md`      | Current tasks with checkboxes             |
| `lessons.md`   | Mistakes + patterns to prevent recurrence |
| `decisions.md` | Architecture decisions with rationale     |

### lessons.md Format

After ANY correction, add:

```markdown
## [Date] - [Title]

**Trigger:** What happened
**Pattern:** Rule to prevent recurrence
```

**Review lessons.md at session start.**

---

## Decision Rules

| Situation                                | Action             |
| ---------------------------------------- | ------------------ |
| Clear task, single file                  | Proceed            |
| Multiple approaches, similar effort      | Pick one, note why |
| Multiple approaches, different tradeoffs | Ask                |
| Outside stated scope                     | Ask                |
| Found unrelated bug                      | Note it, don't fix |
| Architectural decision                   | Always ask         |

---

## Quality Gates

Before marking done (BUILD mode):

- [ ] Runs without errors
- [ ] Tested happy path
- [ ] Assumptions validated
- [ ] Edge cases considered
- [ ] Would a staff engineer approve?

---

## Failure Modes to Avoid

1. Wrong assumptions unchecked → Surface early
2. Silently resolving ambiguity → Stop and ask
3. Sycophantic agreement → Push back
4. Scope creep → Stay surgical
5. Over-engineering → Simplest solution
6. Sunk cost continuation → Stop and replan if sideways
7. Confidence without verification → Test first
8. Repeating mistakes → Update lessons.md
