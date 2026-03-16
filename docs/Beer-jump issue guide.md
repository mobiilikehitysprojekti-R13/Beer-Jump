# How to Write a Good GitHub Issue

**Project:** Beer Jump  
**Team:** Tomi Roumio, Leevi Määttä, Juho-Pekka Salo  
**Last updated:** 2026-03-16 (v1.1)

> This guide is written for this team and this project. Examples are taken directly from the Beer Jump backlog. both good and bad ones.

---

## Why this matters

A poorly written issue costs more time than writing it well in the first place. When an issue is vague, the developer either has to stop and ask questions, makes the wrong assumption and builds the wrong thing, or marks it done when it isn't. On a 3-person team with a course deadline, none of those outcomes are acceptable.

A well-written issue answers three questions before the developer even starts:

1. **What** needs to be built and for whom?
2. **How do I know when it's done?**
3. **What else does this depend on?**

---

## The anatomy of a good issue

Every issue in this project should have these five parts.

---

### 1. Title the user story

The title is a one-line user story in this format:

```
As a [who], I want [what] so that [why].
```

The **who** is the perspective the feature is written from. For Beer Jump there are exactly two valid values:

- `As a player`. something that affects gameplay or the player experience
- `As a developer`. a technical, infrastructure, or tooling task

**Do not write `As a user`.** It is too vague to be useful. Every human interacting with this app is a "user". When you write "As a player" you are committing to the game context, which gives the acceptance criteria a clear frame of reference. When you write "As a developer" you are committing to a technical deliverable that a player never directly sees.

If you are genuinely unsure which one to use, ask: would a player notice if this issue was never implemented? If yes. it's `As a player`. If only the codebase is affected. it's `As a developer`.

The **what** is the specific capability. Keep it to one thing. If you find yourself writing "and" in the title, split it into two issues.

The **why** is the reason it matters. This is often skipped but it's the most important part. it tells the team what outcome the issue is trying to achieve, which helps when making implementation decisions.

**Good titles from the Beer Jump backlog:**

```
✅ As a player, I want the game to gradually introduce harder platform types as I
   reach greater heights so that early game is approachable and high scores feel earned.

✅ As a developer, I want a frame-rate-independent game loop so that physics and
   movement behave consistently regardless of device speed.
```

**Bad titles from the Beer Jump backlog:**

```
❌ Create hiscore screen. no user, no why, too vague
❌ As a user I want the game to render smoothly. no "so that" clause, who is "user"?
❌ Create backend(Node). not a user story, and the tech choice is wrong
```

---

### 2. Body. context and background

Write 1–3 sentences explaining the context a new team member would need. Assume the reader hasn't read the architecture document.

- What system or screen does this live in?
- Are there any decisions already made that constrain the implementation?
- Is there a reference document or prior issue this builds on?

**Example. good body:**

```
The game loop runs via Reanimated useFrameCallback() on the UI thread (see
beer-jump-rendering-research.md). All platform positions are stored in a
Reanimated shared value array. This issue implements the fixed object pool
so that platforms are recycled rather than dynamically allocated during gameplay.

Depends on: #35 (game loop), #36 (physics), NEW-B (types)
```

**Example. bad body (the original backlog issues):**

```
[no body at all]
```

Many of the original Beer Jump issues (#3–#32) had no body. That forces the developer to go read the architecture document, guess, or ask. Don't make them do that.

---

### 3. Acceptance criteria. the definition of done

This is the most important part. Acceptance criteria are a checklist of conditions that must all be true before the issue can be closed. Each item should be:

- **Specific**. not "it works", but "when X happens, Y occurs"
- **Testable**. someone can verify it without asking the author
- **Binary**. it's either done or it isn't, no partial credit

Use GitHub's markdown checkbox syntax:

```markdown
- [ ] Condition one
- [ ] Condition two
```

**Good acceptance criteria (from NEW-G. collision detection):**

```
- [ ] Platform collision only fires when velocityY.value > 0 (BeerGuy is falling)
- [ ] BeerGuy's feet bounding box checked against each active platform's top edge
- [ ] On platform collision: velocityY.value = JUMP_VELOCITY (instant bounce)
- [ ] Enemy collision: top of enemy = bounce (stomp), sides/bottom = death
- [ ] All collision logic runs as worklet functions on the UI thread
- [ ] Bounding boxes configurable per entity in gameConfig.ts
```

Every item is specific and testable. You can run the game and verify each one.

**Bad acceptance criteria:**

```
- [ ] Collision works correctly
- [ ] Game feels good
- [ ] Performance is acceptable
```

None of these are testable. "Works correctly" according to whom? "Feels good" means nothing you can check.

**The performance trap:** If you write "the game runs smoothly", that's untestable. Write the actual condition instead:

```
- [ ] Game maintains ≥55 fps for 5 continuous minutes on a mid-range Android device
      with all platform types and at least 3 enemies active simultaneously
```

---

### 4. Phase and epic label

Every issue should state which phase of the milestone plan it belongs to and which epic it is part of. This helps during sprint planning when the team is deciding what to work on next.

```
**Phase:** 1.  Core loop
**Epic:** Game Engine
```

The six phases for Beer Jump are:

| Phase        | Deliverable                                        |
| ------------ | -------------------------------------------------- |
| 1. Core loop | BeerGuy moves, jumps, dies. Static platforms only. |
| 2. Game feel | Platform variety, enemies, difficulty, score       |
| 3. UI        | All screens and pixel art assets                   |
| 4. Firebase  | Auth, leaderboard, offline caching                 |
| 5. Screens   | Settings, Shop, account management                 |
| 6. Polish    | Power-ups, sound, score markers, Google Sign-In    |

---

### 5. Dependencies

If this issue cannot be started until another issue is done, say so explicitly. Link the blocking issue with `#number`.

```
**Depends on:** #35, #36, NEW-B (types must be defined first)
**Blocked by:** nothing. can start immediately
```

This is not optional. Undeclared dependencies are the main reason developers start work, get stuck halfway through, and have to context-switch. On a small team that wastes half a day.

A good rule: before posting an issue, ask yourself "what would I need to have already built to start this?" Those are your dependencies.

---

## The complete template

Copy this for every new issue. The **title field** in GitHub is the user story line. everything below goes in the **description body**.

```markdown
<!-- TITLE FIELD (one line, goes in the GitHub issue title input): -->

As a [player / developer], I want [specific capability] so that [outcome or reason].

<!-- DESCRIPTION BODY (everything below goes in the text area): -->

## Context

[1–3 sentences explaining background, relevant architecture decisions, and references.
Link to the architecture doc section or another issue if relevant.]

**Depends on:** #X, #Y (or "nothing. can start immediately")

## Acceptance criteria

- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]

## Notes

[Optional: assumptions made, things to confirm with the team, known open questions,
suggested implementation approach. Flag assumptions explicitly. write "Suggested
approach:" not "Implementation is:"]

**Phase:** [1–6]. [name]  
**Epic:** [Game Engine / Gameplay / Screens / Firebase / Art / Polish]
```

---

## Common mistakes. and how to fix them

### Mistake 1: The title is a task, not a story

```
❌ Create hiscore screen
✅ As a player, I want to view a global leaderboard so that I can see how my
   score compares to other players.
```

Tasks don't explain why something is being built. When a task gets cut during a sprint, the team has no way to evaluate whether cutting it is acceptable. because they don't know what outcome it was supposed to produce.

---

### Mistake 2: One issue covers too many things

```
❌ As a developer, I want the app entry point configured so that navigation,
   auth, and state initialise correctly on launch.
```

This was NEW-A in the gap analysis. It actually covers three separate concerns. navigation setup (#3), anonymous auth wiring (#18), and Zustand initialisation (#39). all of which already had their own issues. Before writing a new issue, search the backlog for anything that overlaps with your acceptance criteria, not just with your title.

---

### Mistake 3: Acceptance criteria read across issue boundaries

```
❌ - [ ] Sound respects the toggle from SettingsScreen (US-11)
✅ - [ ] Sound respects the sound on/off toggle from Settings (#7)
```

Use real issue numbers (`#7`), not made-up IDs (`US-11`). Anyone reading the issue can click `#7` and immediately see the referenced issue. They cannot look up `US-11` anywhere.

---

### Mistake 4: Assumptions are baked in silently

```
❌ - [ ] Score = Math.floor(cameraY / SCORE_PER_UNIT)
```

This was NEW-M. The formula looks like a fact but it's actually a design decision. Another team member might have a completely different mental model of how score should work. Write it as:

```
✅ - [ ] Score is height-based (not time-based). Suggested formula:
         Math.floor(Math.abs(cameraY.value) / SCORE_PER_UNIT).
         confirm with team before coding, value goes in gameConfig.ts
```

The rule: if you invented it while writing the issue, it's an assumption. Flag it.

---

### Mistake 5: Letting a wrong title survive unchallenged

The Beer Jump backlog has `#8` titled "Create hiscore screen" and `#9` titled "Create inventory screen". These are not duplicates. they're two different screens. But `#8`'s title appears to be a copy-paste typo: the intended issue was almost certainly "Create inventory screen" (matching `#10` which is also inventory-related), with `#9` being the actual hiscore screen.

The issue was posted, nobody caught it, and it sat in the backlog uncorrected. This happens because early in a project people post issues quickly and reviewers skim titles without reading carefully.

**The fix is a 30-second review habit:** when you post an issue, the person who reads it first should reply with one sentence confirming they understand what it's asking for. If their understanding doesn't match yours, the title needs rewriting. This is especially important for screen creation issues where a wrong name silently misdirects whoever picks it up.

Also search the backlog before posting. The real near-duplicates in the Beer Jump backlog were:

- `#17` (sign in) and `#18` (auto sign-in on first launch). almost identical scope, both cover anonymous auth
- `#3` (setup navigation) and `#19` (navigate the application). the same concern from two different framings

When you find a near-duplicate, don't post a new issue. Add a comment to the existing one explaining the additional context, or explicitly reference it in the new issue's body to explain how they differ.

---

### Mistake 6: Phase 6 issues with no path to get there

If you post a Phase 6 (Polish) issue while Phase 1 isn't complete, the issue will sit in the backlog for weeks and accumulate stale context. Instead, keep later-phase issues as draft notes in the architecture document until Phase 3 or 4 is underway. Post them to GitHub when they're 2–3 phases away from being started, not 5.

---

## Sizing. how big should one issue be?

A well-sized issue should be completable by one person in **1–3 days**. If you estimate it would take longer, split it. If it would take a few hours, consider whether it should be a sub-task under an existing issue instead.

**Too big (consider splitting):**

```
⚠️ As a developer, I want the Firebase project configured and connected to the
   app so that player data can be read and written reliably.
```

This is issue #47 in the Beer Jump backlog. As written it bundles Firebase project creation, Firestore initialisation, anonymous auth, security rules, and leaderboard functions. That could be a week of work across two people simultaneously. Whether to split it is a team judgement call. if one person owns Firebase start to finish, keeping it as one issue is fine. If two people might work on it in parallel, split it: Firebase project setup + auth wiring as one issue, Firestore schema + leaderboard functions as another, Security Rules as a third. The rule is: **one issue, one person, no parallelism conflicts**.

**About right:**

```
✅ As a developer, I want Firestore Security Rules that enforce data integrity
   so that the leaderboard cannot be written to by unauthenticated clients.
```

One person, one day, clear definition of done.

**Too small (make it a sub-task instead):**

```
❌ Add SCORE_PER_UNIT constant to gameConfig.ts
```

This is a single line of code. It should be a checkbox inside a larger issue, not a standalone issue.

---

## Writing a bug report

Bugs are a different shape from features. The goal of a bug report is to let someone else reproduce the problem and verify the fix. without the original reporter being in the room.

**Title format for bugs:**

```
[Bug] [screen or system]. [what actually happens] instead of [what should happen]

Example: [Bug] Game screen. BeerGuy falls through static platform at altitude 3000+
```

**Body format for bugs:**

```markdown
## Steps to reproduce

1. Start a new run
2. Climb to approximately altitude 3000
3. Land on a static (green) platform

## What happens

BeerGuy falls through the platform without bouncing.

## What should happen

BeerGuy should bounce immediately on contact with any static platform
(velocityY.value = JUMP_VELOCITY).

## How often does it happen

Every time / Intermittent (~3 out of 5 attempts) / Once

## Device and Expo Go version

Android 14, Pixel 7, Expo Go 2.31.2

## Acceptance criteria (for the fix)

- [ ] BeerGuy bounces on all static platforms at all altitudes
- [ ] No regression. BeerGuy still falls through fake platforms
- [ ] Tested on both Android and iOS

**Phase:** [whichever phase introduced the broken code]  
**Epic:** [same epic as the feature that is broken]
```

Two things that make bug reports fail: vague reproduction steps ("it just stopped working"), and acceptance criteria that only describe the fix without checking for regressions. Always add a regression check.

---

## Before you post. a checklist

Run through this before submitting any issue:

- [ ] Title follows "As a [player / developer], I want [what] so that [why]". no "As a user"
- [ ] Title has been read back to yourself out loud. does it describe exactly one thing?
- [ ] Body has at least 1 sentence of context
- [ ] Dependencies are listed with real `#number` references, not made-up IDs
- [ ] Every acceptance criterion is specific and testable
- [ ] No criterion says "works correctly", "feels good", or "is fast" without a measurable condition
- [ ] Assumptions are flagged with "Suggested:" or "Confirm with team". not stated as facts
- [ ] I searched the backlog for duplicates and near-duplicates before posting
- [ ] The issue is completable by one person in 1–3 days. if not, consider splitting
- [ ] Phase and epic are labelled
- [ ] If it's a bug: steps to reproduce are specific enough for someone else to follow without asking me

---

## Quick reference. issue types in this project

| Type           | Title format                                                     | Acceptance criteria focus on                               |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Player feature | `As a player, I want...`                                         | What the player sees and experiences                       |
| Developer task | `As a developer, I want...`                                      | Files created, functions implemented, constraints met      |
| Bug            | `[Bug] [system]. [what happens] instead of [what should happen]` | Reproduction steps + fixed state + regression check        |
| Chore          | `As a developer, I want...`                                      | Codebase state after the work (refactor, cleanup, tooling) |

---

_Last updated: 2026-03-16. Issue writing guide v1.1 (corrected #8/#9 duplicate claim; added bug report format; expanded who/user guidance; clarified title field vs body; added title read-back step to checklist; made sizing example more nuanced)_
