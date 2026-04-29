---
name: accessibility
description: WCAG 2.1 AA accessibility patterns for levelrise — color contrast, ARIA, keyboard navigation, reduced motion, and component checklist
---

## What I do

Guide writing accessible UI components and fixing accessibility violations in the levelrise codebase. This skill covers WCAG 2.1 AA compliance patterns specific to our dark-themed gaming UI with OKLCH colors, @base-ui/react components, and Tailwind CSS v4.

## When to use me

- Adding new interactive components or pages
- Fixing axe-core violations from `tests/smoke/a11y.spec.ts`
- Reviewing color contrast for new color tokens
- Adding form controls, modals, or custom interactive elements
- Auditing keyboard navigation

## Target standard

**WCAG 2.1 AA** — the mid-tier accessibility standard. Key requirements:

| Criterion                    | Requirement                                        |
| ---------------------------- | -------------------------------------------------- |
| 1.4.3 Contrast (Minimum)     | Text: 4.5:1, Large text (18px+ bold or 24px+): 3:1 |
| 1.4.11 Non-text Contrast     | UI components and graphical objects: 3:1           |
| 2.1.1 Keyboard               | All functionality available via keyboard           |
| 2.4.1 Bypass Blocks          | Skip navigation link to bypass repeated content    |
| 2.4.7 Focus Visible          | Keyboard focus indicator is visible                |
| 2.3.1 Three Flashes          | No content flashes more than 3 times per second    |
| 1.3.1 Info and Relationships | Semantic HTML structure                            |

## Tooling

### oxlint (compile-time)

The `jsx-a11y` plugin is built into oxlint and enabled in `.oxlintrc.json`. Rules include `alt-text`, `aria-props`, `click-events-have-key-events`, `heading-has-content`, `no-autofocus`, `prefer-tag-over-role`, `role-has-required-aria-props`, and more.

To add or adjust a11y rules, edit the `rules` section in `.oxlintrc.json` under the `jsx-a11y/` prefix:

```json
"jsx-a11y/new-rule-name": "error"
```

### Playwright axe-core (runtime)

`@axe-core/playwright` scans rendered pages for violations. Test file: `tests/smoke/a11y.spec.ts`. See the `e2e-testing` skill for patterns.

## Color contrast — OKLCH dark mode

The app uses OKLCH color tokens defined in `src/app/globals.css`. Dark mode is the primary theme.

### Key background surfaces

| Token          | OKLCH Value             | Approx hex | Usage              |
| -------------- | ----------------------- | ---------- | ------------------ |
| `--background` | `oklch(0.13 0.02 260)`  | `#0d1117`  | Page background    |
| `--card`       | `oklch(0.17 0.02 260)`  | `#161b22`  | Cards, sidebar     |
| `--muted`      | `oklch(0.2 0.02 260)`   | `#1c2129`  | Muted surfaces     |
| `--secondary`  | `oklch(0.22 0.025 260)` | `#21262d`  | Secondary surfaces |

### Minimum text lightness for 4.5:1 contrast

On `--card` background (~`#161b22`), text needs OKLCH lightness of approximately:

- **Full opacity gold** (`--gold` at L=0.78): passes easily
- **Gold at /50 opacity**: fails (~3.1:1). Minimum safe opacity: **/70** (~4.7:1)
- **Gold at /60 opacity**: borderline (~4.0:1). Use **/70** minimum

### Muted gameplay colors (on tinted backgrounds)

Win/loss pill text appears on semi-transparent backgrounds (`bg-win/20`, `bg-loss/20`). The muted token values have been tuned for 4.5:1:

| Token           | Dark mode value        | Usage                                      |
| --------------- | ---------------------- | ------------------------------------------ |
| `--win-muted`   | `oklch(0.72 0.12 150)` | Win pill text on `bg-win/20`               |
| `--loss-muted`  | `oklch(0.72 0.16 27)`  | Loss pill text on `bg-loss/20`             |
| `--destructive` | `oklch(0.72 0.22 27)`  | Error text on `bg-destructive/10` or `/20` |

### Rules of thumb

1. **Never use gold opacity below /70** for text on dark surfaces
2. **Muted color tokens must have L >= 0.70** for text on `/20` tinted backgrounds
3. **Test with axe-core** after any color token change — `npm run test:smoke`

## ARIA patterns

### Icon-only buttons

Every button with only an icon and no visible text MUST have `aria-label`:

```tsx
<Button variant="ghost" size="icon" aria-label="Close menu">
  <X className="h-4 w-4" />
</Button>
```

### Progress bars

The `@base-ui/react` Progress component needs `aria-label`:

```tsx
<Progress value={75} aria-label="Win rate: 75%" />
```

### Interactive Badge elements

Badge renders as `<span>` by default. When used as a clickable toggle, render as a button:

```tsx
<Badge
  variant={isSelected ? "default" : "secondary"}
  className="cursor-pointer"
  render={<button type="button" />}
  onClick={() => toggle()}
>
  {label}
</Badge>
```

### Select triggers

Add `aria-label` when there's no visible label adjacent:

```tsx
<SelectTrigger aria-label="Filter by result">
  <SelectValue placeholder="All results" />
</SelectTrigger>
```

**CRITICAL: Base UI `SelectValue` displays the raw `value` string, NOT the `SelectItem` label.** This is the #1 recurring UI bug in this codebase. The `placeholder` prop only works when NO value is selected. When a value IS selected (including the default), `SelectValue` renders the raw value string (e.g. `"suggested"` instead of `"Suggested"`).

**The ONLY reliable fix** is to use the `children` render function, which receives the current value and lets you map it to the correct label:

```tsx
// WRONG — shows raw value "suggested"
<SelectValue placeholder="Suggested" />

// WRONG — placeholder only shows when value is null/undefined
<SelectValue placeholder={t("sort.suggested")} />

// CORRECT — children function maps value to label
<SelectValue placeholder={t("sort.suggested")}>
  {(value: string) => {
    const labels: Record<string, string> = {
      suggested: t("sort.suggested"),
      newest: t("sort.newestFirst"),
      oldest: t("sort.oldestFirst"),
    };
    return labels[value] ?? value;
  }}
</SelectValue>
```

**MANDATORY: Every `<SelectValue>` in this codebase MUST use the children function pattern.** No exceptions. The `placeholder` prop alone is never sufficient when a default value is set.

### Tooltip triggers

`TooltipTrigger` renders a `<button>` element. If the content is an icon-only element, it **must** have an `aria-label` — otherwise axe-core reports a `button-name` violation:

```tsx
// WRONG — button has no accessible name
<Tooltip>
  <TooltipTrigger>
    <Info className="h-3.5 w-3.5" />
  </TooltipTrigger>
  ...
</Tooltip>

// CORRECT — aria-label provides the accessible name
<Tooltip>
  <TooltipTrigger aria-label={t("tooltipLabel")}>
    <Info className="h-3.5 w-3.5" />
  </TooltipTrigger>
  ...
</Tooltip>
```

Remember: every `aria-label={t("key")}` requires keys in BOTH `messages/en.json` AND `messages/es.json`.

### Dialogs and drawers

Focus trapping is handled automatically by `@base-ui/react/dialog`. No manual implementation needed for Dialog, AlertDialog, or drawer patterns using Dialog primitives.

## Keyboard navigation

### Skip link

The app has a "Skip to main content" link in `src/app/(app)/layout.tsx` that targets `<main id="main-content">`. This is visually hidden until focused.

### Focus indicators

- **UI components** (Button, Input, Select, etc.): Have `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` via component library
- **Native buttons/selects**: Have global `focus-visible` outline styles in `globals.css` using the `--ring` color token
- **Rule**: Never add `outline: none` without a visible `focus-visible` replacement

### Tab order

- Never use positive `tabIndex` values (disrupts natural order)
- `tabIndex={0}` is fine for making non-interactive elements focusable when adding `role` and keyboard handlers
- **Prefer semantic HTML** (`<button>`, `<a>`) over `role="button"` on divs/spans. The `prefer-tag-over-role` oxlint rule enforces this.
- Non-interactive elements that must be clickable: use `<button type="button">` with appropriate styling instead of `div` + `role="button"` + `tabIndex` + `onKeyDown`

## Reduced motion

`src/app/globals.css` includes a `@media (prefers-reduced-motion: reduce)` block that:

- Sets `animation-duration: 0.01ms` and `transition-duration: 0.01ms` on all elements
- Disables `hover-lift` transforms
- Switches `scroll-behavior` to `auto`

No per-component changes needed — the global media query handles everything.

## New component checklist

When adding a new interactive component:

1. [ ] Icon-only buttons have `aria-label`
2. [ ] Form inputs have associated `<label>` (or `aria-label` / `aria-labelledby`)
3. [ ] Color contrast meets 4.5:1 for normal text, 3:1 for large text
4. [ ] Component is keyboard-operable (Tab to focus, Enter/Space to activate)
5. [ ] Focus indicator is visible
6. [ ] Custom interactive elements use semantic HTML (`<button>`, `<a>`) — avoid `role="button"` on divs
7. [ ] Images have `alt` text (decorative images use `alt=""`)
8. [ ] Progress bars have `aria-label`
9. [ ] Animations respect `prefers-reduced-motion` (handled globally)
10. [ ] Run `npm run lint` — jsx-a11y rules catch many issues at compile time
11. [ ] Run `npm run test:smoke` — axe-core catches runtime violations
12. [ ] **i18n: Every `aria-label={t("key")}` has matching keys in BOTH `messages/en.json` AND `messages/es.json`** — see the `i18n` skill for details. Missing keys crash the app at runtime.
