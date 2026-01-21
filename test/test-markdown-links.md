---
lang: en
---

# Markdown Link Title Protection Test

## Test Case 1: Link with double-quoted title
[test](https://example.com "title")

## Test Case 2: Link with single-quoted title
[test](https://example.com 'title')

## Test Case 3: Link with double-quoted title containing single quotes
[test](https://example.com "title with 'quotes'")

## Test Case 4: Link with single-quoted title containing double quotes
[test](https://example.com 'title with "quotes"')

## Test Case 5: Link without title
[test](https://example.com)

## Test Case 6: Multiple links on same line
Here are [link1](https://example.com "first title") and [link2](https://example.com 'second title') together.

## Test Case 7: Complex nested quotes in title
[complex](https://example.com "He said 'Hello' and she replied")

## Test Case 8: Regular quotes OUTSIDE links should still be converted
This is “text with quotes” that should be converted to smart quotes.

## Test Case 9: Mixed - link protection + normal conversion
This “sentence” has [a link](https://example.com "with a title") and “more quotes” to convert.
