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
You are the Lead Systems Security, Performance, and Architecture Reviewer for the "PulseNOC" project.
PulseNOC is a mission-critical NOC telemetry and prober platform that monitors:
1. Debian laptop system health (CPU, RAM, storage disk, network I/O, thermals, processes).
2. Remote external services (HTTP/HTTPS, TCP/UDP ports, ICMP ping, DNS).

Your primary responsibility is to audit incoming code changes for:
1. SECURITY:
   - Credential or token leakage, exposed secrets, private keys.
   - Command injection vulnerabilities (SSH exec, shell execution, prober arguments).
   - Unauthenticated or exposed sensitive API endpoints.
   - Insecure deserialization, SQL injection, or unvalidated user inputs.
2. PERFORMANCE:
   - Resource & memory leaks (unclosed sockets, unreleased DB pools/clients, uncleaned interval/timeout timers).
   - CPU bottlenecks, synchronous blocking loops, unbounded queries without pagination.
   - Hanging external service probers (missing network timeouts, deadlocks).
   - Excessive re-renders or WebSocket channel flooding.
3. BUGS & LOGIC ERRORS:
   - Unhandled Promise rejections and silent crashes.
   - Null pointer or undefined dereferencing.
   - Race conditions in state synchronization or prober scheduling.
   - Broken network protocol error handling.
4. ENHANCEMENT SUGGESTIONS:
   - Code resiliency, architectural best practices, maintainability polish, defensive programming.

Categorize every finding into one of 4 strict severity tiers:
- "CRITICAL": Severe vulnerability (RCE, injection), credential leak, catastrophic server crash, data loss. (STRICTLY BLOCKS MERGE)
- "HIGH": Concrete logic bug, severe performance bottleneck, memory leak, unhandled fatal crash, significant security weakness. (STRICTLY BLOCKS MERGE)
- "MEDIUM": Non-critical performance optimization opportunity, subtle edge-case flaw, defensive improvement. (DOES NOT BLOCK MERGE)
- "LOW": Enhancement suggestion, minor code readability, non-blocking refactoring tip. (DOES NOT BLOCK MERGE)

Return your response ONLY as valid JSON matching this schema:
{
  "summary": "Executive summary of the changes with security & performance health score (0-100)",
  "verdict": "PASS" | "FAIL",
  "can_merge": boolean (MUST be false if there is ANY High or Critical finding),
  "findings": [
    {
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "category": "Security" | "Performance" | "Bug" | "Enhancement",
      "file": "path/to/file",
      "line": "approx line number or range",
      "title": "Concise issue title",
      "description": "Clear explanation of the risk, bug, or performance impact",
      "recommendation": "Actionable, concrete fix"
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

      // 1. Security Check: Hardcoded secrets & credentials
      if (!currentFile.endsWith('.example') && !currentFile.endsWith('.md') && !currentFile.includes('scripts/ai-reviewer.mjs')) {
        if (/((password|secret|api_key|private_key|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"])/i.test(addedContent)) {
          findings.push({
            severity: 'CRITICAL',
            category: 'Security',
            file: currentFile,
            line: `${i + 1}`,
            title: 'Potential hardcoded secret or token detected',
            description: 'Sensitive credentials must never be committed to git repositories.',
            recommendation: 'Move credentials to environment variables (.env).',
          });
        }
      }

      // 2. Security Check: Unsafe shell command execution (Command Injection risk)
      if (isCodeFile(currentFile)) {
        if (/exec(Sync)?\s*\(\s*`[^`]*\$\{/.test(addedContent)) {
          findings.push({
            severity: 'HIGH',
            category: 'Security',
            file: currentFile,
            line: `${i + 1}`,
            title: 'Potential Command Injection in shell execution',
            description: 'Interpolating raw variables into shell commands allows remote arbitrary command execution.',
            recommendation: 'Use execFile, spawn with argument arrays, or sanitize inputs strictly.',
          });
        }

        // 3. Performance / Bug Check: Unhandled infinite loop or potential memory leak
        if (/setInterval\s*\(/.test(addedContent) && !/clearInterval/.test(addedContent) && currentFile.includes('frontend/src')) {
          findings.push({
            severity: 'MEDIUM',
            category: 'Performance',
            file: currentFile,
            line: `${i + 1}`,
            title: 'Uncleaned interval timer risk',
            description: 'Setting intervals in frontend components without returning cleanup in useEffect causes memory leaks.',
            recommendation: 'Ensure clearInterval is returned in the useEffect cleanup function.',
          });
        }
      }
    }
  }

  const hasHighOrCritical = findings.some(f => f.severity === 'HIGH' || f.severity === 'CRITICAL');
  return {
    summary: 'Heuristic security & performance scanner (Configure GEMINI_API_KEY in repository secrets for full LLM analysis).',
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

  let report = `## 🛡️ PulseNOC AI Reviewer: Security, Performance & Bug Gatekeeper\n\n`;

  if (canMerge) {
    report += `### ✅ VERDICT: MERGE ALLOWED\n`;
    report += `Code passed all Security & Performance gates. No High or Critical severity findings detected.\n\n`;
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
