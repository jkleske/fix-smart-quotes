# fix-smart-quotes

Convert straight quotes to proper typographic ("smart") quotes in Markdown files.

| Language | Before | After |
|----------|--------|-------|
| German | `"text"` | `„text“` (U+201E / U+201C) |
| English | `"text"` | `“text”` (U+201C / U+201D) |

## Why?

Claude (including Claude.ai, Claude Desktop, and Claude Code) consistently uses straight quotes (`"`) instead of typographic quotes. This applies to both generated text and edits to existing content. The reason: straight quotes are universally compatible—they work in code, terminals, forms, and avoid encoding issues that can turn smart quotes into question marks.

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

This tool restores the correct quotes—either manually via CLI, or automatically after each Claude edit via hook.

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

The primary use case: automatically fix quotes in files that Claude Code just edited. The hook runs **only** on files modified by Claude's Write or Edit tools—not on your entire project.

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "npx fix-smart-quotes \"$FILE_PATH\"",
        "timeout": 30
      }]
    }]
  }
}
```

This means: After Claude writes or edits a file, immediately run the quote fixer on that specific file.

## Features

- **Auto-detects language** via `lang:` frontmatter or content heuristics
- **Protects technical syntax:** code blocks, inline code, HTML attributes, Liquid/Jekyll templates, Kramdown attributes, Markdown links
- **Zero dependencies**

## License

MIT
