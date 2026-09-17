---
title: Word-final apostrophe - Plan
type: fix
date: 2026-09-17
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Word-final apostrophe - Plan

## Goal Capsule

**Objective:** Running the tool over a Markdown file never turns an apostrophe into a quotation mark. Genitives such as `Johannes' Auftrag` and elisions such as `geht's` come out with the typographic apostrophe U+2019, already-correct apostrophes survive, and real single quotations after an apostrophe still open and close correctly.

**Means:** Classify apostrophes before the single-quote toggle runs, and emit U+2019 for them without touching the toggle state (KTD1, KTD2).

**Authority:** The user's decisions in this plan override the current code comment in `index.js` that apostrophes are kept unchanged. The README says nothing about apostrophes today; R8 adds the topic fresh. The test scenarios in U1 override any reading of the prose rules.

**Stop conditions:** Stop and report if a fix for the cases in U1 would require changing how double quotes, protected regions or language detection work.

**Out of scope, decided by the user:** no `npm publish`, no change to the Claude Code hook or its wrapper script, no repair of already-damaged files in any vault. The work ends with a committed branch.

## Product Contract

### Summary

`fix-smart-quotes` v1.0.3 treats an apostrophe at the end of a word as a single quotation mark. Because the open/close state is kept for the whole file, the first such apostrophe becomes an opening mark, the next a closing mark, and every real single quotation after it is inverted. The tool also flattens correct U+2019 characters before deciding, so correct text is damaged on every run.

### Problem Frame

The tool runs as a post-edit hook over entire files. Every run rewrites text nobody touched, and manual corrections are undone by the next run. A read-only count in the author's vault found 1,281 certainly wrong characters in 742 files. German genitives of names ending in s, ß, x or z are the main trigger; English plural possessives (`users' data`) hit the same path.

### Requirements

- R1. A single quote character directly after a letter and not followed by a letter is an apostrophe when no single quotation is currently open. It is written as U+2019 and does not change the open/close state.
- R2. A single quote character between two letters is an apostrophe and is written as U+2019. This replaces the current behavior of leaving it straight, in German and English files alike.
- R3. An existing typographic single mark is classified by exactly the same rules as a straight one (R1, R2, R4). Consequence: an existing U+2019 after a letter stays U+2019 and leaves the state alone when no single quotation is open; when a quotation is open it is read as the closing mark, as today.
- R4. A real single quotation (`'News'`) still becomes the language's opening and closing marks, including when it follows an apostrophe in the same file or on a later line.
- R5. The tool is idempotent for all of the above: a second run over its own output changes nothing.
- R6. Letter detection covers all Latin-script letters including accented ones, so `André' Text` behaves like `Jonas' Text`. It deliberately does not cover other scripts: in `他说'新闻'` the marks are a quotation, and v1.0.3 handles it correctly today.
- R7. These limits are documented, not solved: a genitive inside a single quotation is read as the closing mark; an apostrophe at the start of a word (`'90s`) is read as an opening mark; an opening single mark typed directly after a letter without a space (`He said'hello'`) is read as an apostrophe; and when the opening mark of a quotation sits inside a protected region (for example inside link text), the closing mark after a word is read as an apostrophe.
- R9. A single mark directly after a protected region (inline code, Markdown link) or after a closing bracket `]` or `)` counts as word-final: with no single quotation open it is an apostrophe (U+2019, no state change), and followed by a Latin letter it is an apostrophe regardless of state (`` `code`'s ``). This covers `[[Johannes Kleske]]' Auftrag`, `[Reuters](https://example.com)' Paywall` and `` `code`'s behavior ``. Added after code review on user decision; v1.0.3 and the first implementation pass both turn these into a quotation mark and invert every later single quotation in the file. Protected regions themselves stay unchanged.
- R8. The README describes the new apostrophe behavior and the limits from R7. The version becomes 1.1.0, because R2 changes output for existing users.

### Scope Boundaries

Double-quote handling, protected regions, language detection and the CLI interface stay as they are. Processing only changed lines instead of whole files is a separate question and not part of this plan.

### Sources

The defect analysis with symptom, cause, test cases and counts lives outside this repo in the author's notes (`Genitiv-Apostroph wird zum Anführungszeichen 2026-09-17`). The repo's `index.js` was diffed against the analyzed npx copy of v1.0.3 and is byte-identical, so its findings apply here.

## Planning Contract

### Key Technical Decisions

- KTD1. **Apostrophes are decided before the toggle and never touch it.** In `replaceQuotesInText`, the apostrophe check runs first; only characters that fail it reach the open/close branch. This is what keeps later quotations in step (R4).
- KTD2. **The state flag is inverted relative to its name.** `state.singleQuoteOpen` starts as `true` and the code emits `openSingle` when it is `true`. So `true` means "the next mark opens", i.e. no quotation is open. R1's condition "no single quotation open" is therefore `state.singleQuoteOpen === true`. Implementing it by the variable's name would invert the fix. Renaming the flag is allowed if double and single are renamed together and tests stay green; it is not required.
- KTD3. **Keep flattening; correctness comes from classification, not from preservation.** `normalizeQuotes` keeps mapping U+2018, U+2019, U+201A and U+201B to the straight quote. Every single mark, whatever its original code point, then goes through the one classification in `replaceQuotesInText` (R1, R2, otherwise toggle). A correct U+2019 survives because it is re-classified as an apostrophe, not because it is skipped. Do not add a special case that exempts existing U+2019 from the toggle: a letter-preceded U+2019 is also the English closing mark, and exempting it makes the second run end in a different state than the first (breaks R4 and R5). If `normalizeQuotes` needs a change after all, only its single-quote line is in scope; the double-quote line stays untouched and the double-quote stop condition is not triggered.
- KTD4. **Existing wrong marks get no special treatment.** A U+201A or U+2018 after a letter in existing text is normalized and then classified by R1. With no quotation open it becomes U+2019, which usually repairs a damaged genitive. This is a state-dependent heuristic, not a reliable repair: if the file-wide toggle is out of step (unbalanced single marks earlier in the file, or an opening mark hidden in a protected region), a legitimate closing mark after a word also becomes U+2019. v1.0.3 already damages that same character (it writes an opening mark there), so this is a different wrong output, not a new class of damage. Do not advertise the tool as a repair for previously damaged files.
- KTD5. **`isLetter` uses `/[\p{Script=Latin}]/u`, and a preceding combining mark counts as part of its letter.** Latin script covers accented letters without pulling in scripts where a mark between two characters is a quotation (R6). For the character before the mark, skip back over `\p{M}` so a decomposed `Andre\u0301'` behaves like `André'`. Latin letters used in real prose are all in the BMP (only rare phonetic extensions are not), so the existing per-code-unit loop is sufficient; do not rewrite it to code points. Digits stay non-letters, so `'90s`, `5'` and `6'2"` keep their current handling.

### Assumptions

- In English files a closing single quote is also U+2019, the same code point as the apostrophe. R3's "does not change state" applies only when no quotation is open; with a quotation open, a letter-preceded U+2019 is the closing mark, as today.
- Tests keep the existing fixture-file style (`test/fixtures/*.md` plus pattern checks in `test/test.js`). An added helper for exact whole-file comparison and for a second run is fine.

## Implementation Units

### U1. Failing tests for apostrophes

**Goal:** Pin the behavior before changing code.
**Requirements:** R1–R7.
**Files:** `test/test.js`, new fixtures under `test/fixtures/` (for example `apostrophe-de.md`, `apostrophe-en.md`).
**Approach:** Add fixtures and assertions for the cases below. Assert with exact expected strings using `\u` escapes, and assert the absence of U+201A and U+2018 directly after a letter where an apostrophe is expected. Add a helper that runs the CLI twice and compares both outputs (R5). Confirm the new tests fail on the current code before starting U2.
**Test Scenarios** (input → expected, German file unless noted):

1. `Johannes' Auftrag` → `Johannes’ Auftrag`
2. `Strauß' Rede` → `Strauß’ Rede`
3. `Marx' Thesen` → `Marx’ Thesen`
4. `Schulz' Vorschlag` → `Schulz’ Vorschlag`
5. `(die Paywall ist Reuters')` → `(die Paywall ist Reuters’)`
6. `Johannes’ Auftrag` → unchanged
7. `Zwei Genitive: Jonas' Konzept und Johannes' Auftrag` → both U+2019, no alternation
8. `geht's` → `geht’s`
9. `'News'` → `‚News‘`
10. `Jonas' Konzept, dann 'News'` → `Jonas’ Konzept, dann ‚News‘`
11. Two genitives on two separate lines, followed by `'News'` on a third line → both U+2019, quotation correct (file-wide state)
12. English file: `the users' data and 'News'` and `it's` → `users’`, `‘News’`, `it’s`
13. `André' Text` → `André’ Text`, also with a decomposed `e` + U+0301; and `他说'新闻'` in an English file → `他说‘新闻’` (unchanged from v1.0.3)
14. Idempotence: second run over the output of cases 1–13 changes nothing. The English fixture must contain a second single quotation after `'News'` later in the file, so a state drift between first and second run becomes visible
15. Documented limit, pinned so a future change is noticed: `'Johannes' Auftrag'` → German `‚Johannes‘ Auftrag’`, English `‘Johannes’ Auftrag’` (open, close, then apostrophe; the state ends balanced, which differs from v1.0.3)
16. Documented limit, pinned: `He said'hello'` in an English file → `He said’hello’` (first mark is between two letters, second is word-final with no quotation open, so both are apostrophes)

**Verification:** `npm test` shows the new cases failing and the three existing fixture tests passing.

### U2. Apostrophe classification in the replacer

**Goal:** Make U1 pass.
**Requirements:** R1–R6.
**Files:** `index.js` (`isLetter`, `normalizeQuotes`, `replaceQuotesInText`).
**Approach:** Apply KTD1–KTD5. Update the code comments that currently say apostrophes are kept unchanged.
**Verification:** `npm test` fully green, including idempotence.

### U4. Apostrophe after protected regions and closing brackets

**Goal:** Close the review finding (R9). Runs after U2; its README line belongs to U3's section.
**Requirements:** R9, R4, R5.
**Files:** `test/test.js`, new fixtures under `test/fixtures/`, `index.js` (single-quote branch of `replaceQuotesInText` only), `README.md`.
**Approach:** Tests first, failing before the change. In the apostrophe check, treat the previous character as word-final when it is a Latin letter (existing), the end of a protector placeholder (the text before the mark ends with `PROTECT_END`), or `]` / `)`. Do not change `createProtector`, its patterns or the placeholder format; use the existing `PROTECT_END` constant rather than a literal.
**Test Scenarios** (exact output plus second run):

17. German: `[[Johannes Kleske]]' Auftrag und 'News'.` → `[[Johannes Kleske]]’ Auftrag und ‚News‘.`
18. German: `[Reuters](https://example.com)' Paywall und 'Zitat'.` → U+2019 after the link, `‚Zitat‘`
19. English: ``The `code`'s behavior and then 'Real quote' works.`` → `` `code`’s `` and `‘Real quote’`
20. English: `[link](https://example.com)'s title and 'Quote'` → `’s` and `‘Quote’`
21. Unchanged behavior, pinned: a quotation that wraps a protected region with both marks outside (``'`code`'`` and `'[link](https://example.com)'`) still opens and closes, German and English
22. Unchanged behavior, pinned: `(siehe 'Anhang')` and `[siehe 'Anhang']` still open and close

**Verification:** `npm test` green; scenarios 1–16 unchanged.

### U3. Documentation and version

**Goal:** Users can see what changed and what the limits are.
**Requirements:** R7, R8.
**Files:** `README.md`, `package.json`.
**Approach:** Add a short "Apostrophes" section with two or three examples, the behavior change from 1.0.x, and the limits from R7. Bump the version to 1.1.0.
**Verification:** README examples match the test expectations character for character.

## Verification Contract

- `npm test` (runs `node test/test.js`) passes with all existing and new cases.
- Manual spot check: run `node index.js` on a scratch copy of a German Markdown file containing genitives and a single quotation, then run it again; the second run produces no diff.
- `git status` shows changes only in `index.js`, `README.md`, `package.json`, `test/` and this plan.

## Definition of Done

- Expected outputs in tests are exact strings, not only absence checks, because a wrong result can still end in a balanced state.
- All requirements R1–R8 are covered by a passing test or, for R7 and R8, by README text.
- Work is committed on a branch named for the fix, not on `main`. Nothing is published and nothing outside this repo is modified.
- No leftover temp fixtures (`_temp_*`) or abandoned experiment code in the diff.
