# TODO.md Tracking

## Overview

This skill ensures `TODO.md` stays in sync with actual project state. Every implementation task must be reflected in `TODO.md` immediately — never batch updates or defer them to "later".

## Rules

### 1. Read TODO.md at session start

Before starting any implementation work, read `TODO.md` to understand:
- What's already done
- What's in progress
- What's planned but not started

This prevents duplicate work and ensures you know the current state.

### 2. Update TODO.md after every completed task

**Immediately** after finishing an implementation task (before moving to the next one):

- If the task corresponds to an existing `TODO.md` item: mark it `[x]` with `~~strikethrough~~`
- If the task is new work not in `TODO.md`: add a new `[x]` item in the appropriate section
- If the task partially completes an item: update the description to reflect what's done and what remains

Do NOT wait until the end of a session to batch-update checkboxes. Each task gets its checkbox updated right away.

### 3. Format conventions

**Completed items:**
```markdown
- [x] ~~Original task description~~ (brief context on how it was done or any deviations)
```

**Partially completed items** (keep unchecked, update description):
```markdown
- [ ] Original task — partially done: X is complete, remaining: Y and Z
```

**New items** added for work not originally in TODO.md:
```markdown
- [x] Description of what was implemented (added retroactively)
```

**Removed/dropped items:**
```markdown
- [x] ~~Original task description~~ (removed — reason)
```

### 4. Section placement

- Performance optimizations go under `## Performance`
- Bug fixes or polish go under `## Polish`
- New features go under the relevant `## Features — X` section
- If no section fits, add one following the existing naming pattern

### 5. Include in commits

`TODO.md` changes should be included in the same commit as the implementation work they document. This keeps the file and code in sync in git history.

## Files

- `TODO.md` — The project TODO list (root of repository)
