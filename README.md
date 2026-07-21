# 🚀 Unlink Application

Welcome to the **Unlink** Application repository! Unlink is a high-performance **Application & Focus Blocker** built primarily using React Native / Expo. The app helps users manage their screen time by blocking distracting apps instantly.

## 📱 Open Source & Transparency
We believe in absolute privacy. That is why the core of Unlink is completely open source. You can view the code, verify the permissions, and build it yourself.

## 💬 Contact the Developer
If you have any questions, want to report a bug, or are interested in contributing, you can reach the founder directly!
**Telegram:** [@shahileeee](https://t.me/shahileeee)

## 🏗️ Getting Started
Please refer to our [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for a complete breakdown of the architecture and how to run the project locally.

## 🚀 Releases & Versioning
We use GitHub Actions to automate our release process. 
- **Alpha Testing:** Pushing to the `develop` branch automatically builds an Android APK and creates a new Release on the GitHub Releases tab.
- **Beta/Production:** Will be cut from the `main` branch when the app is ready.

Current Version Status: **Alpha Testing**

---

## 🤖 AI-Assisted Development Workflow

This project ships with **19 curated engineering skills** from [mattpocock/skills](https://github.com/mattpocock/skills) inside [`.agents/`](./.agents/). Every AI agent (Antigravity, Claude, Codex, etc.) that opens this repo picks them up automatically — no setup needed for the team.

> **No vibe coding.** Every skill enforces a question-first, action-second loop. The agent aligns with you *before* touching code — preventing the #1 time-waster: building the wrong thing.

---

### 🆚 Without Skills vs With Skills

| Situation | ❌ Without skills | ✅ With skills |
|---|---|---|
| New feature | Agent starts coding immediately, guesses at requirements | `/grill-with-docs` → forces alignment first, produces a spec |
| Bug fix | Agent tries random fixes, gets lost | `/diagnosing-bugs` → systematic root cause before any code change |
| Feature improvement | Agent rewrites too much or too little | `/grill-me` → agree on scope, then `/implement` one thing at a time |
| Design / UX improvement | Agent makes aesthetic choices you didn't ask for | `/prototype` first → validate the idea, then `/implement` |
| Architecture gets messy | Agent keeps adding to already bad structure | `/improve-codebase-architecture` → audit first, plan before touching |
| Choosing a library | Agent picks what it knows best, not what fits | `/research` → evaluate options against your actual constraints |
| Merge conflicts | Agent guesses at intent, breaks things | `/resolving-merge-conflicts` → resolves with full context of both sides |
| PR ready | Agent says "done" but missed edge cases | `/code-review` → catches it before merge |
| Session ends | All context is lost, next session starts blind | `/handoff` → crisp summary doc for the next session |

---

### 🆕 Building a New Feature

**Never start coding before running this flow.**

```
/grill-with-docs  →  /to-spec  →  /to-tickets  →  /implement  →  /tdd  →  /code-review  →  /handoff
```

**Step by step:**

| Step | Command | What happens |
|---|---|---|
| 1 | `/grill-with-docs` | Agent interviews you with targeted questions. Forces alignment before any code. Outputs a spec doc. |
| 2 | `/to-spec` | Formalises the discussion into a written spec (`docs/specs/<feature>.md`) |
| 3 | `/to-tickets` | Breaks the spec into Linear tickets — one per sub-task with clear scope |
| 4 | `/implement` | Implements one ticket at a time. Structured, no overreach. |
| 5 | `/tdd` | For complex logic — write tests first, then implementation |
| 6 | `/code-review` | Reviews your branch before PR. Catches what you and the agent missed. |
| 7 | `/handoff` | Writes a session summary so the next session (or teammate) starts with full context |

**Example — adding a "Schedule Blocks" feature:**
```
"run /grill-with-docs on the idea of scheduling app blocks by time of day"
→ Agent asks 10-15 questions, outputs docs/specs/schedule-blocks.md

"use /to-tickets on the schedule-blocks spec, create them in Linear"
→ Linear tickets created with clear scope and blocking edges

"implement the ticket: Create ScheduleRule data model"
"use /tdd to implement: Evaluate active block rules at app launch"
"/code-review on the schedule-blocks branch"
"/handoff — summarize what's done and what's next"
```

---

### 🐛 Fixing a Bug

**Never guess at a fix. Diagnose first.**

```
/grill-me  →  /diagnosing-bugs  →  /implement  →  /code-review
```

| Step | Command | What happens |
|---|---|---|
| 1 | `/grill-me` | Quick alignment — agent asks what you've already tried and what you know |
| 2 | `/diagnosing-bugs` | Systematic root-cause analysis. Agent builds a hypothesis, tests it, eliminates candidates. |
| 3 | `/implement` | Once root cause is confirmed, implement the fix cleanly |
| 4 | `/code-review` | Verify the fix doesn't introduce regressions |

**Example — blocker not firing on cold boot:**
```
"the block isn't activating when the phone restarts — /grill-me first"
→ Agent asks what you know, what you've checked, what changed

"/diagnosing-bugs — cold boot blocker issue"
→ Agent traces the boot sequence, finds the foreground service isn't persisting

"implement the fix: persist the VPN session across device restart"
"/code-review on the boot-fix branch"
```

---

### ✨ Improving an Existing Feature

**Scope first, then improve. Never let the agent rewrite more than agreed.**

```
/grill-me  →  /implement  →  /code-review
```

Or if it needs a proper redesign:

```
/grill-with-docs  →  /to-spec  →  /implement  →  /code-review
```

| Step | Command | What happens |
|---|---|---|
| 1 | `/grill-me` | Agree on exactly what "better" means before touching anything |
| 2 | `/implement` | Implement only what was agreed — nothing more |
| 3 | `/code-review` | Check nothing else changed |

**Example — making the block timer UX smoother:**
```
"the focus session timer feels clunky — /grill-me on what 'better' means here"
→ Agent asks: better visually? better performance? better haptics?
→ You agree: smoother animation on countdown + haptic on session end

"implement: smoother countdown animation and haptic feedback on Focus Session end"
"/code-review"
```

---

### 🎨 Design & UX Improvements

**Prototype before committing. Kill bad ideas early.**

```
/grill-me  →  /prototype  →  /implement  →  /code-review
```

| Step | Command | What happens |
|---|---|---|
| 1 | `/grill-me` | Align on what "more awesome" means — don't let the agent guess at aesthetics |
| 2 | `/prototype` | Build a throwaway version to validate the idea fast |
| 3 | `/implement` | Once validated, build the real thing properly |
| 4 | `/code-review` | Final check |

**Example — redesigning the home screen:**
```
"I want the home screen to feel more premium — /grill-me"
→ Agent asks: dark mode changes? animation style? layout changes? what's the reference?

"/prototype a new home screen layout with glassmorphism cards"
→ Quick throwaway to see if it looks right

"implement the home screen redesign based on the prototype"
"/code-review"
```

---

### 🏗️ Architecture & Refactoring

**Audit before you refactor. Never refactor blind.**

```
/improve-codebase-architecture  →  /grill-me  →  /implement  →  /code-review
```

| Step | Command | What happens |
|---|---|---|
| 1 | `/improve-codebase-architecture` | Agent scans the codebase and produces an HTML report of all improvement opportunities |
| 2 | `/grill-me` | Pick one opportunity and align on the approach before touching it |
| 3 | `/implement` | Refactor only what was agreed |
| 4 | `/code-review` | Verify no regressions |

**Example:**
```
"/improve-codebase-architecture — the blocker engine is getting messy"
→ Agent produces a prioritised report of issues

"/grill-me on the highest priority item: splitting the VPN manager from the rule evaluator"
"implement: extract RuleEvaluator from VpnManager into its own module"
"/code-review"
```

---

### 📋 Quick Reference

| Command | Use for |
|---|---|
| `/grill-with-docs` | New feature — align + produce spec |
| `/grill-me` | Bug, improvement, design — quick alignment |
| `/to-spec` | Turn a conversation into a written spec |
| `/to-tickets` | Break a spec into Linear tickets |
| `/implement` | Build one thing, structured |
| `/tdd` | Complex logic — tests first |
| `/prototype` | Validate an idea before committing |
| `/diagnosing-bugs` | Root-cause a bug systematically |
| `/wayfinder` | Understand unfamiliar code before touching it |
| `/code-review` | Before every PR |
| `/improve-codebase-architecture` | Planned refactor sessions |
| `/codebase-design` | Design a new subsystem |
| `/domain-modeling` | Define core entities and relationships |
| `/research` | Explore a library/approach before choosing |
| `/resolving-merge-conflicts` | Untangle messy merges |
| `/handoff` | End of every session — write a summary |
| `/teach` | Teach the agent Unlink-specific terminology |
| `/triage` | Triage open Linear issues |

---

### 🔧 Team Setup

- **`.agents/` is committed** — every teammate gets all 19 skills automatically when they clone the repo.
- **Run `/setup-matt-pocock-skills` once per machine** — configures Linear as the issue tracker.
- **Use `/teach` on day one** — teach the agent your domain terms (`Focus Session`, `BlockRule`, `VPN bypass`) so it speaks your language from the start.

