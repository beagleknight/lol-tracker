# i18n — Internationalization Skill

Multi-language support for LoL Tracker using `next-intl`.

## Architecture

- **Library**: `next-intl` with cookie-based locale detection
- **Supported languages**: English (`en`), Spanish (`es`)
- **Two independent settings**:
  - **UI Language** (`language` column) — controls which translation file is used (en/es)
  - **Formatting Locale** (`locale` column) — controls date/number formatting (en-GB, en-US, es-ES)
- **Locale delivery**: Cookie (`language`) set on login + language change; `src/i18n/request.ts` reads it
- **Login page**: Uses `Accept-Language` header fallback (no cookie exists yet)
- **Metadata stays English** — "LoL Tracker" is a brand name

## Key Files

| File                          | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `messages/en.json`            | English translations (~290 keys, 17 namespaces)              |
| `messages/es.json`            | Spanish translations (AI-generated, gaming terms in English) |
| `src/i18n/request.ts`         | next-intl config: cookie → Accept-Language → default `en`    |
| `src/types/next-intl.d.ts`    | Type augmentation for type-safe `t()` keys                   |
| `src/app/actions/settings.ts` | `updateLanguage()` server action                             |
| `src/lib/auth.ts`             | Sets `language` cookie in `signIn` callback                  |
| `next.config.ts`              | Wrapped with `createNextIntlPlugin()`                        |

## Namespaces

Each component file uses a single namespace via `useTranslations("NamespaceName")`:

`Sidebar`, `MatchCard`, `Pagination`, `HighlightsEditor`, `Login`, `Dashboard`, `Matches`, `MatchDetail`, `Review`, `Scout`, `Analytics`, `Coaching`, `CoachingDetail`, `CompleteSession`, `ActionItems`, `ScheduleSession`, `Duo`, `Settings`, `Errors`

## How to Add a New String

1. Add the key to `messages/en.json` under the appropriate namespace
2. Add the corresponding Spanish translation to `messages/es.json`
3. Use `t("keyName")` in the component (already has `useTranslations` set up)
4. For interpolation: `t("key", { variable: value })`
5. For plurals: `"{count, plural, one {# game} other {# games}}"`
6. For rich text (inline components): Use `<tag>content</tag>` in JSON, then `t.rich("key", { tag: (chunks) => <Component>{chunks}</Component> })`

## How to Add a New Language

1. Create `messages/{code}.json` — copy `en.json` and translate all values
2. Add the language to `SUPPORTED_LANGUAGES` in `src/i18n/request.ts`
3. The settings dropdown and cookie logic will pick it up automatically
4. Gaming terms (KDA, CS, Win Rate, LP, champion names, rune names) should stay in English

## Conventions

- **Sentence case everywhere** — see section below
- **Gaming terms stay English** in ALL languages: KDA, CS, Win Rate, LP, champion names, rune names, VOD
- **Server action errors** return error codes (not messages); codes are translated client-side via `Errors.codes.*`
- **Rich text format**: Use `<tag>content</tag>` in JSON, NOT `{variable}` for inline components
- **Variable shadowing**: Never name a `.map()` callback parameter `t` — it shadows the translation function. Use descriptive names like `topic`, `item`, etc.
- **No `new Date()` in client components** at module level — causes Next.js prerender errors. Use `useEffect` to initialize.

## CRITICAL: Sentence case — MANDATORY

All user-facing text **MUST** use sentence case. Only the first word of a phrase and proper nouns / acronyms are capitalized. **No Title Case anywhere** — not in i18n values, hardcoded TSX strings, or changelog titles.

### What sentence case looks like

| Wrong (Title Case)              | Right (sentence case)           |
| ------------------------------- | ------------------------------- |
| "Current Rank"                  | "Current rank"                  |
| "Session Win Rate"              | "Session win rate"              |
| "VOD Review Notes"              | "VOD review notes"              |
| "Back to Matches"               | "Back to matches"               |
| "Coaching Flow UX Improvements" | "Coaching flow UX improvements" |

### Proper nouns to preserve (always capitalized)

LoL Tracker, Riot, Discord, Ascent, League of Legends, Settings (when referring to the page name in navigation context, e.g. sidebar label)

### Acronyms to preserve (always uppercase)

KDA, CS, LP, CSV, VOD, AI, UI, UX

### Where it applies

1. **`messages/en.json`** — all string values
2. **`messages/es.json`** — all string values (Spanish follows its own capitalization rules, but avoid unnecessary capitals mid-sentence)
3. **Hardcoded strings in TSX** — button labels, fallback text, placeholder text
4. **Changelog titles** — `title:` field in `changelog/en/*.mdx` and `changelog/es/*.mdx` frontmatter

### Checklist for every new string

Before committing any i18n value or hardcoded UI string:

1. Is only the first word capitalized (plus proper nouns/acronyms)? If not, fix it.
2. Does the Spanish translation also follow sentence case? Check it.
3. Run `npm run build` — it validates i18n structure but won't catch casing, so review manually.

## CRITICAL: i18n keys for aria-labels

When adding `aria-label={t("key")}` (or any new `t()` call) for accessibility fixes, you **MUST** immediately add the translation key to **BOTH** `messages/en.json` and `messages/es.json`. Missing keys cause runtime crashes — the app will throw a missing translation error.

This is the most commonly forgotten step when fixing accessibility violations. Every `aria-label`, `aria-labelledby`, or other ARIA attribute that uses `t()` requires a corresponding entry in both message files.

Checklist for every new `t()` call:

1. Identify the namespace (from `useTranslations("NamespaceName")` in the same file)
2. Add the key to `messages/en.json` under that namespace
3. Add the Spanish translation to `messages/es.json` under the same namespace
4. Verify with `npm run build` — the type system catches missing keys at build time
