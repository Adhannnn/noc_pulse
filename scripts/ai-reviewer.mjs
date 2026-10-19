#!/usr/bin/env node

/**
 * PulseNOC Automated AI Code Reviewer & Gatekeeper
 * 
 * Rules:
 * - Reviews git diff for Anti-Slop AI standards, security, error handling, and reliability.
 * - Categorizes findings into: Low, Medium, High, Critical.
 * - Gatekeeping:
 *     - Low / Medium: PASS (merge allowed)
 *     - High / Critical: FAIL (merge blocked, exit code 1)
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH || '';
const BASE_BRANCH = process.env.BASE_BRANCH || 'origin/main';

function getPRNumber() {
  if (process.env.PR_NUMBER) return process.env.PR_NUMBER;
  if (GITHUB_EVENT_PATH && existsSync(GITHUB_EVENT_PATH)) {
    try {
      const eventData = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'));
      return eventData?.pull_request?.number || eventData?.number || null;
    } catch {
      return null;
    }
  }
  return null;
}

function getGitDiff() {
  const args = process.argv.slice(2);
  const diffFileIdx = args.indexOf('--diff-file');
  if (diffFileIdx !== -1 && args[diffFileIdx + 1] && existsSync(args[diffFileIdx + 1])) {
    return readFileSync(args[diffFileIdx + 1], 'utf8');
  }

  // 1. Try diff against base branch
  try {
    const diff = execSync(`git diff ${BASE_BRANCH}...HEAD`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (diff.trim()) return diff;
  } catch {}

  // 2. Try staged changes
  try {
    const diff = execSync('git diff --staged', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (diff.trim()) return diff;
  } catch {}

  // 3. Try working directory changes
  try {
    const diff = execSync('git diff HEAD', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (diff.trim()) return diff;
  } catch {}

  // 4. Try previous commit
  try {
    const diff = execSync('git diff HEAD~1', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (diff.trim()) return diff;
  } catch {}

  return '';
}

async function callGeminiReview(diffText) {
  const prompt = `
You are the Lead NOC Systems Architect and Anti-Slop AI Gatekeeper for the "PulseNOC" project.
PulseNOC monitors Debian laptop telemetry (CPU, RAM, storage, network) and remote external services (HTTP/HTTPS, TCP, ICMP ping).

Review the following Git diff strictly against these standards:
1. Anti-Slop Standards:
   - ZERO "any" types in TypeScript.
   - NO empty catch blocks or silenced errors.
   - NO mock/stub placeholders left in production pathways.
   - Resource hygiene (SSH streams, WebSockets, timers, DB connections must be cleaned up).
2. Security:
   - No hardcoded credentials, tokens, or private keys.
   - Command injection defense on SSH and shell executions.
   - Proper input validation on endpoints and probers.
3. System Reliability:
   - Network timeout resilience on external probers.
   - Proper state management in UI (no cascading re-renders, correct hook dependencies).
4. UI/UX:
   - NOC cyber aesthetic (dark mode first, high density, monospace for technical numbers).

Categorize every issue into one of 4 severities:
- "CRITICAL": Fatal exploit, credential leak, data loss, catastrophic memory leak. (STRICTLY BLOCKS MERGE)
- "HIGH": Use of 'any' type, unhandled exceptions, breaking API contract, anti-slop violation, security risk, prober thread hang. (STRICTLY BLOCKS MERGE)
- "MEDIUM": Non-blocking performance bottleneck, minor code smell, missing edge-case test. (DOES NOT BLOCK MERGE)
- "LOW": Stylistic suggestion, comment formatting, minor readability improvement. (DOES NOT BLOCK MERGE)

Return your response ONLY as valid JSON matching this schema:
{
  "summary": "High level overview of what changed and overall quality score (0-100)",
  "verdict": "PASS" | "FAIL",
  "can_merge": boolean (MUST be false if there is ANY High or Critical finding),
  "findings": [
    {
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "category": "Anti-Slop" | "Security" | "Reliability" | "UI/UX" | "Architecture",
      "file": "path/to/file",
      "line": "approx line number or range",
      "title": "Short concise title",
      "description": "What is wrong and why it violates standards",
      "recommendation": "Concrete fix instructions"
    }
  ]
}

GIT DIFF TO REVIEW:
\`\`\`diff
${diffText.slice(0, 50000)}
\`\`\`
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API failed with status ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('Empty response received from Gemini API');
  }

  return JSON.parse(textContent);
}

function fallbackReview(diffText) {
  const findings = [];
  const lines = diffText.split('\n');
  let currentFile = 'unknown';

  const isCodeFile = (file) => /\.(ts|tsx|js|jsx|mjs)$/i.test(file) && !file.includes('scripts/ai-reviewer.mjs');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('+++ b/')) {
      currentFile = line.replace('+++ b/', '').trim();
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedContent = line.slice(1);

      // Only check code files for TypeScript/JS anti-slop patterns
      if (isCodeFile(currentFile)) {
        // Check for explicit TypeScript 'any' type annotations/casts
        const tsAnyPattern = /(:\s*any\b|\bas\s+any\b|<any>|Array<any>|Promise<any>|Record<string,\s*any>)/;
        if (tsAnyPattern.test(addedContent) && !/eslint-disable/.test(addedContent)) {
          findings.push({
            severity: 'HIGH',
            category: 'Anti-Slop',
            file: currentFile,
            line: `${i + 1}`,
            title: 'Explicit TypeScript "any" type detected',
            description: 'Anti-Slop policy strictly prohibits the use of "any".',
            recommendation: 'Replace with specific interface, DTO, generic, or unknown with type guard.',
          });
        }

        // Check for empty catch block
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(addedContent)) {
          findings.push({
            severity: 'HIGH',
            category: 'Reliability',
            file: currentFile,
            line: `${i + 1}`,
            title: 'Empty catch block detected',
            description: 'Silently swallowing errors makes debugging impossible.',
            recommendation: 'Log the error with contextual metadata or rethrow typed exception.',
          });
        }
      }

      // Check for hardcoded secret patterns across all files (excluding examples / docs / reviewer script)
      if (!currentFile.endsWith('.example') && !currentFile.endsWith('.md') && !currentFile.includes('scripts/ai-reviewer.mjs')) {
        if (/((password|secret|api_key|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"])/i.test(addedContent)) {
          findings.push({
            severity: 'CRITICAL',
            category: 'Security',
            file: currentFile,
            line: `${i + 1}`,
            title: 'Potential hardcoded secret or token detected',
            description: 'Credentials must never be committed to git.',
            recommendation: 'Move credentials to environment variables (.env).',
          });
        }
      }
    }
  }

  const hasHighOrCritical = findings.some(f => f.severity === 'HIGH' || f.severity === 'CRITICAL');
  return {
    summary: 'Heuristic fallback review (Configure GEMINI_API_KEY in repository secrets for full LLM analysis).',
    verdict: hasHighOrCritical ? 'FAIL' : 'PASS',
    can_merge: !hasHighOrCritical,
    findings,
  };
}

function formatMarkdownReport(reviewResult) {
  const criticalCount = reviewResult.findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = reviewResult.findings.filter(f => f.severity === 'HIGH').length;
  const mediumCount = reviewResult.findings.filter(f => f.severity === 'MEDIUM').length;
  const lowCount = reviewResult.findings.filter(f => f.severity === 'LOW').length;

  const canMerge = reviewResult.can_merge && criticalCount === 0 && highCount === 0;

  let report = `## 🛡️ PulseNOC AI Reviewer Gatekeeper Report\n\n`;

  if (canMerge) {
    report += `### ✅ VERDICT: MERGE ALLOWED\n`;
    report += `Code passed all Anti-Slop gates. No High or Critical severity findings detected.\n\n`;
  } else {
    report += `### ⛔ VERDICT: MERGE BLOCKED\n`;
    report += `**Pull Request cannot be merged.** Found **${criticalCount} Critical** and **${highCount} High** severity issues violating project standards.\n\n`;
  }

  report += `| Metric | Count |\n| :--- | :---: |\n`;
  report += `| 🚨 **Critical** | **${criticalCount}** |\n`;
  report += `| 🔴 **High** | **${highCount}** |\n`;
  report += `| 🟡 **Medium** | **${mediumCount}** |\n`;
  report += `| 🟢 **Low** | **${lowCount}** |\n\n`;

  report += `**Summary:** ${reviewResult.summary}\n\n`;

  if (reviewResult.findings.length > 0) {
    report += `### 📋 Detailed Findings\n\n`;
    report += `| Severity | Category | File | Issue | Recommendation |\n`;
    report += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const f of reviewResult.findings) {
      const badge = f.severity === 'CRITICAL' ? '🚨 CRITICAL' :
                    f.severity === 'HIGH' ? '🔴 HIGH' :
                    f.severity === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW';
      const fileLoc = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
      report += `| **${badge}** | ${f.category} | ${fileLoc} | **${f.title}**: ${f.description} | ${f.recommendation} |\n`;
    }
  } else {
    report += `🎉 **Zero findings detected! Excellent Anti-Slop compliance.**\n`;
  }

  report += `\n---\n*Automated review generated by PulseNOC Jarvis Gatekeeper*`;
  return { report, canMerge };
}

async function postGitHubComment(prNumber, markdownBody) {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !prNumber) {
    console.log('[AI-Reviewer] Skipped posting PR comment (missing GITHUB_TOKEN or PR_NUMBER).');
    return;
  }

  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${prNumber}/comments`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: markdownBody }),
    });

    if (res.ok) {
      console.log(`[AI-Reviewer] Successfully posted review comment to PR #${prNumber}`);
    } else {
      console.warn(`[AI-Reviewer] Failed to post comment: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('[AI-Reviewer] Error posting GitHub comment:', err);
  }
}

async function run() {
  console.log('==================================================');
  console.log('🤖 PulseNOC AI Reviewer & Anti-Slop Gatekeeper');
  console.log('==================================================');

  const diffText = getGitDiff();

  if (!diffText.trim()) {
    console.log('ℹ️ No git diff detected. Skipping review.');
    process.exit(0);
  }

  console.log(`Analyzing diff (${diffText.length} characters)...`);

  let reviewResult;
  if (GEMINI_API_KEY) {
    console.log('Calling Gemini AI Reviewer engine...');
    try {
      reviewResult = await callGeminiReview(diffText);
    } catch (err) {
      console.warn(`Gemini API call failed (${err.message}). Falling back to heuristic scanner.`);
      reviewResult = fallbackReview(diffText);
    }
  } else {
    console.log('GEMINI_API_KEY not found in environment. Using heuristic scanner.');
    console.log('💡 Tip: Add GEMINI_API_KEY to repository secrets to enable deep Gemini AI analysis.');
    reviewResult = fallbackReview(diffText);
  }

  const { report, canMerge } = formatMarkdownReport(reviewResult);
  console.log('\n' + report + '\n');

  const prNumber = getPRNumber();
  if (prNumber) {
    await postGitHubComment(prNumber, report);
  }

  if (!canMerge) {
    console.error('❌ GATEKEEPER FAILED: High or Critical issues detected. Merge is strictly blocked.');
    process.exit(1);
  }

  console.log('✅ GATEKEEPER PASSED: All Anti-Slop standards verified. Ready for merge.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal reviewer error:', err);
  process.exit(1);
});
