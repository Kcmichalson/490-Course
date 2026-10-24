# Project Log

A running record of what I planned and what changed. Newest entries at the
bottom. Claude Code updates this at the end of every milestone.

## Milestone status

- [ ] M1 — Bridge core and hex math
- [ ] M2 — TTS exporter
- [ ] M3 — Calibration on our real table
- [ ] M4 — GM access without copy-paste (local MCP server)
- [ ] M5 — Combat state and change log
- [ ] Later — Line of sight, cover, reaction triggers, action accounting

---

## [date] — Session 0: Planning (before any code)

**Planned**
- Project: a local bridge that reads our LANCER battlefield from Tabletop
  Simulator and gives the AI GM an exact snapshot (hex positions,
  distances, terrain, objective, stats) whenever I say "your turn."
- Origin: during a previous combat the GM had to reconstruct positions from
  angled screenshots and kept losing track of distances, terrain, and the
  objective. [Add what you want recorded about that session.]
- Approaches considered: hex coordinates in chat, an interactive website,
  a TTS Lua bridge, and a fully automated AI GM. Chose the TTS bridge, with
  copy-paste reports first and on-demand GM access later.
- Stack: TTS Lua (thin exporter) + Python standard-library bridge on
  127.0.0.1. All math in Python so it's testable without TTS.

**Changed**
- Dropped publishing the snapshot to an externally reachable service; the
  bridge stays local only. If the GM runs in Claude, a local MCP server
  (M4) covers on-demand access.
- [Anything carried over or discarded from the earlier prototype.]

**Problems / open questions**
- LANCER footprint shapes for Size 2+ and how they orient; range
  measurement between multi-hex units
- Whether TTS `WebRequest` reaches 127.0.0.1 (verify in M2)
- Lua bundling approach (M2)

**Next**
- Commit CLAUDE.md, SPEC.md, LOG.md, .claude/, tool-log/README.md, and
  .gitignore in GitHub Desktop.
- Start Claude Code: read all three, propose the M1 plan and file
  structure, and list ambiguities before writing code.

---

## [date] — Session 1 prompt log (M1)

**AI Assistant:** Claude Code ([model]) in the Claude desktop app  
**Repository:** https://github.com/Kcmichalson/490-Course (folder `Artifact3/`)

Every prompt I sent this session, in order. Long pastes are condensed into
[brackets]. Answers I gave through Claude's multiple-choice questions count
as prompts. Each fix lists how it was verified.

### Prompt 1
* **User Prompt:**  
  > *"..."*
* **What the AI Provided:**  
  ...
* **Where the Model Misread Me:**  
  ...
* **How It Was Verified:** (for each fix)  
  ...
