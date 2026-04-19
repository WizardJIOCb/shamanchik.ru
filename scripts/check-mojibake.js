#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = process.cwd();
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".sh"
]);

const suspiciousPatterns = [
  /\uFFFD/g,
  /Ð./g,
  /Ñ./g,
  /Р°/g,
  /Рё/g,
  /Рѕ/g,
  /Рµ/g,
  /РЅ/g,
  /Р»/g,
  /С‚/g,
  /СЊ/g,
  /СЏ/g,
  /С‹/g,
  /С‡/g,
  /С€/g,
  /С‰/g,
  /вЂ/g,
  /в„/g,
  /в€/g,
  /вЃ/g,
  /в‚/g
];

function getTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return output
    .split("\u0000")
    .filter(Boolean)
    .filter((filePath) => textExtensions.has(path.extname(filePath).toLowerCase()));
}

function isBinary(content) {
  return content.includes("\u0000");
}

function getSuspicionScore(content) {
  return suspiciousPatterns.reduce((total, pattern) => {
    const matches = content.match(pattern);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function main() {
  const offenders = [];

  for (const relativePath of getTrackedFiles()) {
    const absolutePath = path.join(repoRoot, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");

    if (isBinary(content)) {
      continue;
    }

    const score = getSuspicionScore(content);

    if (score >= 3) {
      offenders.push({ relativePath, score });
    }
  }

  if (offenders.length) {
    console.error("Push blocked: detected possible mojibake in tracked files.");
    for (const offender of offenders) {
      console.error(`- ${offender.relativePath} (score: ${offender.score})`);
    }
    console.error("Fix encoding to clean UTF-8 before pushing.");
    process.exit(1);
  }

  console.log("Encoding check passed.");
}

main();
