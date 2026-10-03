# Motif Studio Agents

17 agent skills that give any MCP client (Claude Code, Codex, VS Code, Cursor, Claude Desktop) a full animation studio team for Motif.

## Roster

| Department | Skill | Owns |
| --- | --- | --- |
| Direction | director | Brief, treatment, pipeline, final call (orchestrator) |
| Direction | producer | Deliverables, formats, aspect ratios, pass budget |
| Story and design | story | Beats, arc, reading order, animatic |
| Story and design | art-director | Composition, grid, color, style frames |
| Story and design | typographer | Type, variable axes, legibility |
| Animation | animator | The 12 principles, poses, arcs, overlap |
| Animation | timing | Durations, easing, stagger, rhythm |
| Animation | mograph | Cloners, effectors, procedural systems |
| Animation | rigger | Controls, templates, responsive layouts |
| Finishing | cinematographer | Camera, depth, parallax, transitions |
| Finishing | compositor | Look, blending, effects, motion blur |
| Finishing | fx | Particles, physics, simulations, reactive particles |
| Sound and interaction | sound-sync | Beat sync, audio-reactive reactors |
| Sound and interaction | interaction | States, triggers, UI motion |
| Quality and delivery | critic | Scored review and notes (read-only) |
| Quality and delivery | delivery | Exports, Lottie checks, verification |
| Shaders | agent-motif | Image or description → real-time kit shader: look-dev, fidelity scoring, tuning, SDK proposals (engine in `agent-motif/`) |

## Pipeline

Brief → Treatment → Style frame → Blocking → Splining → Polish → Review → Delivery.
The director runs it; each stage ends at a gate in Motif's Agent activity panel.

## Install

- Any MCP client: skills are served by `motif-bridge` as `motif://skills/{name}` resources and `/motif:<name>` prompts. Nothing to install.
- Claude Code: copy `skills/*` to `.claude/skills/` and `claude-code/agents/*` to `.claude/agents/` (or run `npx motif-bridge install-skills`).
- Codex: copy `skills/*` to your Codex skills folder (or run the installer).
- House style: edit `house-style.md` and place it in the project; the bridge serves it as `motif://brief/house-style`.

## Shared contract

Every skill defines: role and scope, craft rules, tools allowed, procedure, a 1–5 rubric reported in `end_pass`, and handoff notes tagged `@<skill>`.
