# Release Notes — AI Interview Platform v1.0.0

**Release Date**: October 2026  
**Version**: `v1.0.0`  
**Quality Status**: RELEASABLE (Verified by Automated Release Gate)  

---

## What Version v1.0.0 Delivers

This release delivers the stabilized foundational release of the **AI Interview Platform**, transforming raw initial prototypes into a secure, hardened, client-ready system.

### Key Capabilities Delivered

1. **Autonomous Live Audio Interview Engine**:
   - Real-time two-way audio streaming between candidates and Google Gemini Live.
   - Dynamic coverage tracking that probes technical answers based on behavioral anchors (L1–L5).
   - Natural wrap-up and pacing controls aligned with assessment time limits.

2. **Automated Competency Portfolios & Fit/Gap Analysis**:
   - Automatic post-interview transcript evaluation extracting direct quotes as candidate evidence.
   - Algorithmic Fit/Gap benchmarking against specific vacancy requirements.
   - Comprehensive assessor override workflows allowing human-in-the-loop scoring adjustments.
   - One-click PDF and JSON portfolio exports.

---

## Critical Fixes Included in v1.0.0

* **[P0 Blocker Resolved] Assessor Authentication**: Fixed issue where users with the `assessor` role were rejected during login. Assessors can now authenticate and access candidate evaluation dashboards seamlessly.
* **[P0 Blocker Resolved] Candidate Invite Link Resolution**: Corrected default invite URL generation to route candidates to the web application port (5173) rather than the API server port (3001), preventing 404 Routing Errors.
* **[P1 Major Resolved] Fit/Gap Contract Harmonization**: Unified `required_level` and `expected_level` attributes between backend and frontend, fixing empty required levels and restoring visual human override indicators (`✏`).
* **[P1 Major Resolved] Taxonomy Traceability**: Resolved issue where selecting skills from the B7 taxonomy stripped `skill_id` to `undefined`.
* **[P1 Major Resolved] Multi-Tenant Portfolio Isolation**: Enforced strict tenant-scoping across all portfolio view, export, and override operations, closing cross-tenant IDOR vulnerabilities.

---

## Quality System & Verification

* **Workflow Gate (DoR)**: Verified via automated Pull Request linting (`scripts/verify-pr-dor.js`).
* **Regression Suites**: 100% passing tests across Vitest frontend suites and RSpec backend suites.
* **Release Decision Record**: Documented in [`assessment/03-release-decision.md`](assessment/03-release-decision.md).
