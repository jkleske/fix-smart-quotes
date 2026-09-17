const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const CLI = path.join(__dirname, "..", "index.js");

// Test helper: copy fixture, run CLI, check result, cleanup
function testFile(fixtureName, expectedPatterns, unexpectedPatterns = []) {
  const fixture = path.join(FIXTURES_DIR, fixtureName);
  const temp = path.join(FIXTURES_DIR, `_temp_${fixtureName}`);

  // Copy fixture to temp
  fs.copyFileSync(fixture, temp);

  try {
    // Run CLI
    execSync(`node "${CLI}" "${temp}"`, { stdio: "pipe" });

    // Read result
    const result = fs.readFileSync(temp, "utf8");

    // Check expected patterns
    for (const pattern of expectedPatterns) {
      if (!result.includes(pattern)) {
        throw new Error(`Expected pattern not found: ${pattern}`);
      }
    }

    // Check unexpected patterns
    for (const pattern of unexpectedPatterns) {
      if (result.includes(pattern)) {
        throw new Error(`Unexpected pattern found: ${pattern}`);
      }
    }

    console.log(`✓ ${fixtureName}`);
    return true;
  } catch (err) {
    console.error(`✗ ${fixtureName}: ${err.message}`);
    return false;
  } finally {
    // Cleanup
    if (fs.existsSync(temp)) {
      fs.unlinkSync(temp);
    }
  }
}

// Compare the entire fixture and run twice to catch quote-state drift (scenario 14).
function testExactFile(fixtureName, expected) {
  const fixture = path.join(FIXTURES_DIR, fixtureName);
  const temp = path.join(FIXTURES_DIR, `_temp_${fixtureName}`);
  fs.copyFileSync(fixture, temp);

  try {
    execFileSync(process.execPath, [CLI, temp], { stdio: "pipe" });
    const first = fs.readFileSync(temp, "utf8");
    execFileSync(process.execPath, [CLI, temp], { stdio: "pipe" });
    const second = fs.readFileSync(temp, "utf8");

    const errors = [];
    if (first !== expected) {
      const actualLines = first.split("\n");
      expected.split("\n").forEach((line, index) => {
        if (line !== actualLines[index]) {
          errors.push(`line ${index + 1}: expected ${JSON.stringify(line)}, got ${JSON.stringify(actualLines[index])}`);
        }
      });
      if (actualLines.length !== expected.split("\n").length) {
        errors.push("Unexpected number of lines");
      }
    }

    // Explicitly reject opening marks at the expected Latin apostrophe positions.
    for (const match of expected.matchAll(/[\p{Script=Latin}]\p{M}*\u2019/gu)) {
      const index = match.index + match[0].length - 1;
      if (/[\u201A\u2018]/.test(first[index] || "")) {
        errors.push(`Opening single quote at apostrophe position ${index}`);
      }
    }
    if (second !== first) errors.push("Second run changed the output");
    if (errors.length) throw new Error(errors.join("\n  "));

    console.log(`✓ ${fixtureName} (exact output and idempotence)`);
    return true;
  } catch (err) {
    console.error(`✗ ${fixtureName}: ${err.message}`);
    return false;
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

// Run tests
console.log("Running tests...\n");

let passed = 0;
let failed = 0;

// Test 1: German quotes
if (testFile("german.md", [
  "\u201ETest\u201C",      // „Test"
  "\u201EHallo Welt\u201C" // „Hallo Welt"
])) {
  passed++;
} else {
  failed++;
}

// Test 2: English quotes
if (testFile("english.md", [
  "\u201Ctest\u201D",        // "test"
  "\u201CHello World\u201D"  // "Hello World"
])) {
  passed++;
} else {
  failed++;
}

// Test 3: Protected areas unchanged
if (testFile("protected.md", [
  'href="https://example.com"',  // HTML attribute unchanged
  'style="color: red;"',         // HTML attribute unchanged
  '"%Y-%m-%d"',                  // Liquid unchanged
  'title="tooltip"',             // Kramdown unchanged
  '`echo "test"`'                // Inline code unchanged
], [
  'href=\u201E',  // Should NOT have German quotes in href
  'href=\u201C'   // Should NOT have English quotes in href
])) {
  passed++;
} else {
  failed++;
}

const exactFixtures = [
  ["apostrophe-de.md", [
    "---", "lang: de", "---",
    "Johannes\u2019 Auftrag",                         // 1
    "Strau\u00DF\u2019 Rede",                       // 2
    "Marx\u2019 Thesen",                             // 3
    "Schulz\u2019 Vorschlag",                        // 4
    "(die Paywall ist Reuters\u2019)",               // 5
    "Johannes\u2019 Auftrag",                         // 6: already typographic
    "Zwei Genitive: Jonas\u2019 Konzept und Johannes\u2019 Auftrag", // 7
    "geht\u2019s",                                   // 8
    "\u201ANews\u2018",                            // 9
    "Jonas\u2019 Konzept, dann \u201ANews\u2018",  // 10
    "Jonas\u2019 Konzept",                           // 11: state across lines
    "Johannes\u2019 Auftrag",
    "\u201ANews\u2018",
    "Andr\u00E9\u2019 Text",                        // 13: composed Latin accent
    "Andre\u0301\u2019 Text",                       // 13: decomposed Latin accent
    ""
  ].join("\n")],
  ["apostrophe-en.md", [
    "---", "lang: en", "---",
    "the users\u2019 data and \u2018News\u2019",   // 12
    "it\u2019s",
    "\u4ED6\u8BF4\u2018\u65B0\u95FB\u2019",   // 13: Chinese quotation
    "and then \u2018Updates\u2019",                 // 14: later quotation catches drift
    ""
  ].join("\n")],
  ["apostrophe-limit-de.md", [
    "---", "lang: de", "---",
    "\u201AJohannes\u2018 Auftrag\u2019",          // 15
    ""
  ].join("\n")],
  ["apostrophe-limit-en.md", [
    "---", "lang: en", "---",
    "\u2018Johannes\u2019 Auftrag\u2019",          // 15
    ""
  ].join("\n")],
  ["apostrophe-adjacent-en.md", [
    "---", "lang: en", "---",
    "He said\u2019hello\u2019",                     // 16
    ""
  ].join("\n")],
  ["apostrophe-markup-de.md", [
    "---", "lang: de", "---",
    "[[Johannes Kleske]]\u2019 Auftrag und \u201ANews\u2018.", // 17
    "[Reuters](https://example.com)\u2019 Paywall und \u201AZitat\u2018.", // 18
    "(Reuters)\u2019 Paywall und \u201AZitat\u2018.", // R9: literal closing parenthesis
    ""
  ].join("\n")],
  ["apostrophe-markup-en.md", [
    "---", "lang: en", "---",
    "The `code`\u2019s behavior and then \u2018Real quote\u2019 works.", // 19
    "[link](https://example.com)\u2019s title and \u2018Quote\u2019", // 20
    ""
  ].join("\n")],
  ["quotation-protected-de.md", [
    "---", "lang: de", "---",
    "\u201A`code`\u2018",                          // 21
    "\u201A[link](https://example.com)\u2018",
    ""
  ].join("\n")],
  ["quotation-protected-en.md", [
    "---", "lang: en", "---",
    "\u2018`code`\u2019",                          // 21
    "\u2018[link](https://example.com)\u2019",
    ""
  ].join("\n")],
  ["quotation-brackets-de.md", [
    "---", "lang: de", "---",
    "(siehe \u201AAnhang\u2018)",                  // 22
    "[siehe \u201AAnhang\u2018]",
    ""
  ].join("\n")]
];

for (const [fixtureName, expected] of exactFixtures) {
  if (testExactFile(fixtureName, expected)) passed++;
  else failed++;
}

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
