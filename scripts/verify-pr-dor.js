#!/usr/bin/env node

/**
 * Definition of Ready (DoR) Gate Checker
 * 
 * Enforces the core engineering principle: Work Needs Inputs.
 * A change cannot proceed without:
 * 1. Spec / PRD reference (link or identifier)
 * 2. Acceptance criteria / test scenarios (Given/When/Then or checklist)
 * 3. Solution / design plan (architectural or implementation note)
 * 4. Test coverage (automated test files modified or added)
 */

const fs = require('fs');
const { execSync } = require('child_process');

function getPrBody() {
    // 1. In GitHub Actions pull_request event
    if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
        try {
            const eventData = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
            if (eventData.pull_request) {
                return {
                    title: eventData.pull_request.title || '',
                    body: eventData.pull_request.body || '',
                    base: eventData.pull_request.base ? eventData.pull_request.base.sha : 'origin/main',
                    head: eventData.pull_request.head ? eventData.pull_request.head.sha : 'HEAD',
                };
            }
        } catch (e) {
            console.warn('[Gate] Could not parse GITHUB_EVENT_PATH:', e.message);
        }
    }

    // 2. Direct env variables
    if (process.env.PR_TITLE || process.env.PR_BODY) {
        return {
            title: process.env.PR_TITLE || '',
            body: process.env.PR_BODY || '',
            base: process.env.BASE_REF || 'HEAD~1',
            head: 'HEAD',
        };
    }

    // 3. Fallback: inspect latest commit message in local git
    try {
        const commitMsg = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
        const lines = commitMsg.split('\n');
        return {
            title: lines[0] || '',
            body: lines.slice(1).join('\n'),
            base: 'HEAD~1',
            head: 'HEAD',
        };
    } catch {
        return { title: '', body: '', base: 'HEAD~1', head: 'HEAD' };
    }
}

function getChangedFiles(baseRef) {
    try {
        const target = baseRef || 'HEAD~1';
        const diffOutput = execSync(`git diff --name-only ${target} HEAD`, { encoding: 'utf8' });
        return diffOutput.trim().split('\n').filter(Boolean);
    } catch {
        try {
            const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
            return statusOutput.trim().split('\n').map(l => l.slice(3).trim()).filter(Boolean);
        } catch {
            return [];
        }
    }
}

function runGate() {
    console.log('====================================================');
    console.log('   QUALITY NET: DEFINITION OF READY (DoR) CHECK     ');
    console.log('====================================================\n');

    const pr = getPrBody();
    const content = `${pr.title}\n${pr.body}`.toLowerCase();
    const errors = [];
    const passed = [];

    // Check 1: Spec / PRD Link
    const hasSpec = /(spec|prd|wiki|rfc|story|ticket)[\s:-]+(http|#|[a-z0-9_-]+)/i.test(content) ||
                    content.includes('http') ||
                    content.includes('prd-01') ||
                    content.includes('prd-02');
    if (hasSpec) {
        passed.push('Linked Spec / PRD identified');
    } else {
        errors.push('Missing linked Spec/PRD input. PR must link to or reference a specification/PRD.');
    }

    // Check 2: Acceptance Criteria
    const hasAc = /(acceptance criteria|acceptance-criteria|criteria|given[\s\S]*when[\s\S]*then|test scenarios|dod)/i.test(content);
    if (hasAc) {
        passed.push('Acceptance Criteria / Test Scenarios defined');
    } else {
        errors.push('Missing Acceptance Criteria. PR must contain explicit acceptance criteria or Given/When/Then scenarios.');
    }

    // Check 3: Design / Solution Plan
    const hasPlan = /(solution|design|implementation|plan|approach|root cause)/i.test(content);
    if (hasPlan) {
        passed.push('Design Plan / Solution rationale provided');
    } else {
        errors.push('Missing Solution/Design Plan. PR must describe the implementation approach or root cause.');
    }

    // Check 4: Test Presence
    const changedFiles = getChangedFiles(pr.base);
    const testFiles = changedFiles.filter(f =>
        f.includes('spec/') ||
        f.includes('test/') ||
        f.endsWith('.test.ts') ||
        f.endsWith('.test.tsx') ||
        f.endsWith('.spec.ts') ||
        f.endsWith('_spec.rb')
    );

    // Skip test presence requirement only if documentation-only PR
    const isDocOnly = changedFiles.length > 0 && changedFiles.every(f => f.endsWith('.md') || f.startsWith('assessment/') || f.startsWith('docs/'));

    if (testFiles.length > 0 || isDocOnly) {
        passed.push(isDocOnly ? 'Documentation-only change (test presence check bypassed)' : `Automated tests present (${testFiles.length} test files modified)`);
    } else {
        errors.push('Missing automated tests. Code changes must include or update test files (Vitest or RSpec).');
    }

    // Print Results
    passed.forEach(p => console.log(` [PASS] ${p}`));
    console.log('');

    if (errors.length > 0) {
        console.error(' [BLOCKED] The Quality Gate blocked this change:');
        errors.forEach(e => console.error(`   - ${e}`));
        console.error('\nRemediation: Update the Pull Request description using the PR template with required inputs and include tests.\n');
        process.exit(1);
    }

    console.log(' [SUCCESS] All Definition of Ready gates passed. Change is ready for build & validate.\n');
    process.exit(0);
}

runGate();
