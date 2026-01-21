const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
