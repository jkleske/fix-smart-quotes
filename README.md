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

## License

MIT
