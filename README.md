# fix-smart-quotes

Convert straight quotes to proper typographic (“smart”) quotes in Markdown files.

| Language | Before | After |
|----------|--------|-------|
| German | `"text"` | `„text“` (U+201E / U+201C) |
| English | `"text"` | `“text”` (U+201C / U+201D) |

## Why?

Claude (including Claude.ai, Claude Desktop, and Claude Code) consistently uses straight quotes (`"`) instead of typographic quotes. This applies to both generated text and edits to existing content. The reason: straight quotes are universally compatible. They work in code, terminals, and forms, avoiding encoding issues that can turn smart quotes into question marks.

Other AI assistants behave differently: ChatGPT and DeepSeek typically output smart quotes, while Claude and Gemini use straight quotes.

For prose and documentation, proper typography matters. German and English have distinct quote styles that convey professionalism and readability.

**Example - text with proper German quotes:**
```
Sie sagte: „Das ist wichtig.“
```

**After Claude edits or generates text:**
```
Sie sagte: "Das ist wichtig."
```

This tool restores the correct quotes: either manually via CLI or automatically after each Claude edit via hook.

## Installation

```bash
npm install -g fix-smart-quotes
```

Or use directly without installing:

```bash
npx fix-smart-quotes file.md
```

## CLI Usage

```bash
# Single file
fix-smart-quotes README.md

# Multiple files (shell expands glob)
fix-smart-quotes docs/*.md
```

## Claude Code Hook

Automatically fix quotes after Claude edits Markdown files.

**1. Create wrapper script** at `~/.claude/hooks/fix-smart-quotes-wrapper.sh`:

```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[[ ! "$FILE_PATH" =~ \.md$ ]] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0
npx fix-smart-quotes "$FILE_PATH"
exit 0
```

**2. Make executable:** `chmod +x ~/.claude/hooks/fix-smart-quotes-wrapper.sh`

**3. Add to** `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{"type": "command", "command": "~/.claude/hooks/fix-smart-quotes-wrapper.sh", "timeout": 30}]
    }]
  }
}
```

> **Note:** Claude Code passes file paths via stdin JSON, not environment variables. The wrapper script handles this.

> **Important:** After changing settings.json, restart Claude Code. Hook configuration is cached at startup.

## Features

- **Auto-detects language** via `lang:` frontmatter or content heuristics
- **Protects technical syntax:** code blocks, inline code, HTML attributes, Liquid/Jekyll templates, Kramdown attributes, Markdown links
- **Zero dependencies**

## Apostrophes

Apostrophes become `’` (U+2019) in both German and English files. A single mark is treated as an apostrophe between Latin-script letters, or after a Latin-script letter when no single quotation is open. Accented letters, including letters with combining accents, are supported. Apostrophes do not advance the file-wide quotation state, so subsequent single quotations still open and close correctly.

The same apostrophe rules apply immediately after inline code, Markdown links, and closing brackets (`]` or `)`), including wikilinks; protected content stays unchanged.

| Language | Before | After |
|----------|--------|-------|
| German | `Johannes' Auftrag` | `Johannes’ Auftrag` |
| German | `geht's` | `geht’s` |
| English | `the users' data and 'News'` | `the users’ data and ‘News’` |
| German | `[[Johannes Kleske]]' Auftrag und 'News'.` | `[[Johannes Kleske]]’ Auftrag und ‚News‘.` |

**Changed in 1.1.0:** In 1.0.x, mid-word apostrophes stayed straight. They now become U+2019, as do word-final apostrophes when no single quotation is open. Existing typographic single marks are classified by the same rules: U+2019 can be an apostrophe or an English closing quotation mark, depending on context. Running the tool again leaves these examples unchanged.

The classification is a heuristic with these limits:

- A word-final genitive apostrophe inside a single quotation is read as its closing mark.
- An apostrophe at the start of a word, such as in `'90s`, is read as an opening quotation mark.
- An opening single mark typed directly after a letter without a space is read as an apostrophe. In an English file, both marks in `He said'hello'` become U+2019.
- If an opening quotation mark is hidden in a protected region, such as Markdown link text, a closing mark after a word is read as an apostrophe.

Apostrophe detection is limited to Latin script; digits and other scripts are not treated as Latin letters. Unbalanced single quotations earlier in a file can affect later classification, so this is not a reliable repair for previously damaged text.

## License

MIT
