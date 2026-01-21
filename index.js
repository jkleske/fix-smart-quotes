#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// === LANGUAGE DETECTION ===

const GERMAN_MARKERS = new Set([
  "und", "der", "die", "das", "ist", "für", "mit", "auf", "ein", "eine",
  "nicht", "sich", "auch", "dass", "werden", "sein", "haben", "können",
  "mehr", "oder", "wenn", "aber", "wird", "sind", "wurde", "durch",
  "bei", "nach", "vom", "zum", "zur", "aus", "wie", "kann", "noch",
  "nur", "über", "diese", "dieser", "dieses", "einem", "einen", "einer"
]);

const ENGLISH_MARKERS = new Set([
  "the", "and", "is", "of", "to", "in", "that", "for", "with", "this",
  "from", "are", "have", "was", "been", "will", "would", "could", "should",
  "which", "their", "there", "about", "into", "what", "when", "where",
  "can", "has", "had", "but", "not", "you", "all", "were", "they", "be",
  "how", "than", "then", "some", "these", "those", "such", "only", "also"
]);

// Quote characters by language
const QUOTES = {
  de: {
    openDouble: "\u201E",   // „
    closeDouble: "\u201C",  // "
    openSingle: "\u201A",   // ‚
    closeSingle: "\u2018"   // '
  },
  en: {
    openDouble: "\u201C",   // "
    closeDouble: "\u201D",  // "
    openSingle: "\u2018",   // '
    closeSingle: "\u2019"   // '
  }
};

// Check frontmatter for lang: field
function getLanguageFromFrontmatter(text) {
  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const langMatch = frontmatterMatch[1].match(/^lang:\s*(de|en)\s*$/m);
    if (langMatch) {
      return langMatch[1];
    }
  }
  return null;
}

// Language detection via word frequency heuristics
function detectLanguageFromContent(text) {
  const words = text.toLowerCase().match(/\b[a-zäöüß]+\b/g) || [];
  let germanScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (GERMAN_MARKERS.has(word)) germanScore++;
    if (ENGLISH_MARKERS.has(word)) englishScore++;
  }

  // Default to German on tie or insufficient data
  return englishScore > germanScore ? "en" : "de";
}

// Main language detection function
function detectLanguage(text) {
  // Priority 1: Frontmatter
  const frontmatterLang = getLanguageFromFrontmatter(text);
  if (frontmatterLang) {
    return frontmatterLang;
  }

  // Priority 2: Content analysis
  return detectLanguageFromContent(text);
}

// === INLINE PROTECTION PATTERNS ===
// These patterns protect technical areas within lines

// Liquid Tags: {% ... %}
const LIQUID_TAG_PATTERN = /\{%[\s\S]*?%\}/g;

// Liquid Output: {{ ... }}
const LIQUID_OUTPUT_PATTERN = /\{\{[\s\S]*?\}\}/g;

// Kramdown attributes (Jekyll): {: .class} or {: title="..."}
// IMPORTANT: Must come BEFORE HTML_ATTR!
const KRAMDOWN_ATTR_PATTERN = /\{:[^}]*\}/g;

// HTML attributes: href="...", style='...', class="...", data-foo="...", etc.
const HTML_ATTR_PATTERN = /\b([a-z][a-z0-9-]*)\s*=\s*(["'])((?:(?!\2)[^\\]|\\.)*)(\2)/gi;

// Markdown links: [text](url) and [text](url "title")
// Match entire construct to protect URLs and titles with any quote mix
const MD_LINK_PATTERN = /\[([^\]]*)\]\([^)]+\)/g;

// Inline code: `...`
const INLINE_CODE_PATTERN = /`[^`]+`/g;

// === PROTECT/RESTORE SYSTEM ===

// Placeholder markers (no null bytes as they cause issues)
const PROTECT_START = "__PROT_";
const PROTECT_END = "_TORP__";

function createProtector() {
  const segments = [];

  function protect(text, pattern) {
    return text.replace(pattern, (match) => {
      const index = segments.length;
      segments.push(match);
      return `${PROTECT_START}${index}${PROTECT_END}`;
    });
  }

  function restore(text) {
    const pattern = new RegExp(`${PROTECT_START}(\\d+)${PROTECT_END}`, "g");
    let result = text;
    let prevResult;
    // Repeat until no placeholders remain (for nested protected patterns)
    do {
      prevResult = result;
      result = result.replace(pattern, (_, index) => {
        return segments[parseInt(index, 10)];
      });
    } while (result !== prevResult);
    return result;
  }

  function reset() {
    segments.length = 0;
  }

  return { protect, restore, reset };
}

// Helper: Is this character a letter?
function isLetter(char) {
  return /[a-zA-ZäöüßÄÖÜ]/.test(char);
}

// Normalize typographic quotes to straight quotes
function normalizeQuotes(text) {
  return text
    // Double quotes → straight "
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    // Single quotes → straight '
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
}

// Replace quotes in text, updating toggle state
function replaceQuotesInText(text, state, quotes) {
  const normalizedText = normalizeQuotes(text);
  let processed = "";

  for (let k = 0; k < normalizedText.length; k++) {
    const currentChar = normalizedText[k];
    const prevChar = k > 0 ? normalizedText[k - 1] : "";
    const nextChar = k < normalizedText.length - 1 ? normalizedText[k + 1] : "";

    if (currentChar === '"') {
      // Straight double quote
      if (state.doubleQuoteOpen) {
        processed += quotes.openDouble;
      } else {
        processed += quotes.closeDouble;
      }
      state.doubleQuoteOpen = !state.doubleQuoteOpen;
    } else if (currentChar === "'") {
      // Straight single quote - ignore apostrophes within words
      const isApostrophe = isLetter(prevChar) && isLetter(nextChar);

      if (isApostrophe) {
        // Keep apostrophes unchanged (e.g., "it's", "We've")
        processed += currentChar;
      } else {
        // Replace as quote
        if (state.singleQuoteOpen) {
          processed += quotes.openSingle;
        } else {
          processed += quotes.closeSingle;
        }
        state.singleQuoteOpen = !state.singleQuoteOpen;
      }
    } else {
      processed += currentChar;
    }
  }
  return processed;
}

// Process a single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const protectedRanges = [];

  // Detect YAML frontmatter (only at file start)
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && lines[i].trim() === "---") {
      inFrontmatter = true;
      protectedRanges.push({ start: i, end: -1, type: "frontmatter" });
    } else if (inFrontmatter && lines[i].trim() === "---") {
      protectedRanges[protectedRanges.length - 1].end = i;
      inFrontmatter = false;
      break;
    }
  }

  // Detect code blocks
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("```")) {
      if (!inCodeBlock) {
        protectedRanges.push({ start: i, end: -1, type: "codeblock" });
        inCodeBlock = true;
      } else {
        protectedRanges[protectedRanges.length - 1].end = i;
        inCodeBlock = false;
      }
    }
  }

  // Check if line is fully protected
  function isProtectedLine(lineIndex) {
    return protectedRanges.some(
      (range) => lineIndex >= range.start && lineIndex <= range.end
    );
  }

  // Detect language
  const lang = detectLanguage(content);
  const quotes = QUOTES[lang];

  // Create protector instance
  const protector = createProtector();

  // Initialize quote state OUTSIDE processLine so it persists across lines
  const state = { doubleQuoteOpen: true, singleQuoteOpen: true };

  // Process line with protect → replace → restore
  function processLine(line) {
    protector.reset();

    // PROTECT: Order matters!
    let processed = protector.protect(line, INLINE_CODE_PATTERN);
    processed = protector.protect(processed, LIQUID_TAG_PATTERN);
    processed = protector.protect(processed, LIQUID_OUTPUT_PATTERN);
    processed = protector.protect(processed, KRAMDOWN_ATTR_PATTERN);
    processed = protector.protect(processed, HTML_ATTR_PATTERN);
    processed = protector.protect(processed, MD_LINK_PATTERN);

    // REPLACE: Replace quotes using shared state (persists across lines)
    processed = replaceQuotesInText(processed, state, quotes);

    // RESTORE: Restore protected areas
    processed = protector.restore(processed);

    return processed;
  }

  // Process all lines
  const resultLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (isProtectedLine(i)) {
      resultLines.push(lines[i]);
      continue;
    }
    resultLines.push(processLine(lines[i]));
  }

  fs.writeFileSync(filePath, resultLines.join("\n"), "utf8");
  const langLabel = lang === "de" ? "German" : "English";
  console.log(`\u2713 Fixed quotes (${langLabel}): ${filePath}`);
}

// === MAIN ===

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: fix-smart-quotes <file.md> [file2.md ...]");
    process.exit(1);
  }

  let hasErrors = false;

  for (const arg of args) {
    try {
      if (!fs.existsSync(arg)) {
        console.error(`Error: File not found: ${arg}`);
        hasErrors = true;
        continue;
      }
      processFile(arg);
    } catch (err) {
      console.error(`Error processing ${arg}: ${err.message}`);
      hasErrors = true;
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
