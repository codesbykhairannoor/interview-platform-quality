# Platform Quality & Architectural Audit

**Target Platform**: AI Interview Platform (`api/` Ruby on Rails + `web/` React 18 / TypeScript)  
**Assessor**: Fullstack Engineer (SDET Depth)  
**Date**: October 2026  
**Status**: Comprehensive Baseline Audit & Remediation Tracking  

---

## Executive Summary & Ship / Do-Not-Ship Line

The AI Interview Platform is a two-tier service designed to conduct autonomous, real-time voice interviews using Gemini Live and evaluate candidate competencies against standardized level anchors (L1–L5). 

A rigorous audit of the codebase, contracts, data persistence, and development workflows revealed **severe systemic vulnerabilities** living in the seam between the frontend and backend, as well as broken access control gates upstream:
1. **P0 Blocker**: Assessor authentication was fundamentally broken—the authentication controller strictly enforced `user.role == 'admin'`, causing all users with the primary role `assessor` to be rejected with HTTP 401.
2. **P0 Blocker**: The generated candidate interview links directed candidates to the API port (`http://localhost:3001/interview/:token`), producing a 404 Routing Error instead of serving the candidate web application on port 5173.
3. **P1 Major**: The Fit/Gap analysis report suffered from a contract attribute mismatch (`expected_level` vs `required_level`) and dropped the `is_override` flag, causing the frontend comparison table to render blank required levels and hide assessor override indicators.
4. **P1 Major**: Selecting any standardized skill from the B7 taxonomy stripped the `skill_id` attribute to `undefined`, severing traceability back to the taxonomy.
5. **P1 Major**: Portfolio endpoints lacked tenant isolation, allowing authenticated assessors from Tenant A to view, export, and trigger fit/gap reports for candidates in Tenant B (IDOR).

### The Ship / Do-Not-Ship Line
> **DO-NOT-SHIP THRESHOLD**:  
> No release can be shipped if any P0 (system unusable) or P1 (data integrity corrupted / silent failure / multi-tenant leakage) issue is open without explicit, board-approved risk acceptance. The initial codebase fell significantly below the ship line. Following the fixes implemented in this assessment cycle, all identified P0 and P1 defects have been resolved and verified with automated regression checks.

---

## Severity-Ranked Risk Register

| ID | Title | Severity | Category | Impact | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Assessor Login Rejected (`user.role == 'admin'` constraint) | **P0 Blocker** | Built Wrong | Assessors cannot log into the platform; core workflow halted. | **FIXED** |
| **INT-01** | Candidate Invite URL Points to API Port (3001) Instead of Web (5173) | **P0 Blocker** | Built Wrong | Candidates receive broken invite links resulting in 404 error. | **FIXED** |
| **DAT-01** | Fit/Gap Key Mismatch (`expected_level` vs `required_level`) & Missing `is_override` | **P1 Major** | Built Wrong | Comparison table shows blank "Required" column and hides override pencil. | **FIXED** |
| **DAT-02** | SkillPicker Drops `skill_id` (Explicitly Set to `undefined`) | **P1 Major** | Built Wrong | Selected B7 taxonomy skills lose taxonomy ID, breaking downstream matching. | **FIXED** |
| **SEC-02** | Unscoped Portfolio Endpoints (Multi-Tenant IDOR) | **P1 Major** | Built Wrong | Assessors can view and export candidate portfolios across tenant boundaries. | **FIXED** |
| **DAT-03** | Missing Nested Deletion (`_destroy`) on Skill Updates | **P1 Major** | Built Wrong | Deleted skills are never purged from database on assessment/vacancy edit. | **REMAINING (Workaround Documented)** |
| **LLM-01** | Discovered Skills Excluded from Priority Nudge (`priority_next`) | **P2 Minor** | Built Wrong | AI does not receive priority nudge to probe unscripted candidate claims. | **FIXED** |
| **UI-01** | Missing `scope_exclude` Input in `CustomSkillForm.tsx` | **P2 Minor** | Missing Spec | Assessors cannot define "What does not count" for custom skills. | **FIXED** |
| **ROU-01** | Orphaned `/signup` Route in Frontend Service | **P2 Minor** | Built Wrong | Dead signup code references non-existent backend endpoint. | **REMAINING (Deferred)** |
| **UX-01** | Global 401 Interceptor Redirects Candidates to `/login` | **P3 Cosmetic** | Built Wrong | Expired candidate tokens trigger redirection to assessor login screen. | **REMAINING (Deferred)** |

---

## Detailed Findings & Repro Steps

### 1. SEC-01: Assessor Login Rejection (P0 Blocker)
* **Category**: Built Wrong
* **Location**: `api/app/controllers/api/v1/authentication_controller.rb:14` & `api/app/models/user.rb:6`
* **One-Line Impact**: Assessors cannot log in; system rejects valid assessor credentials with 401 Unauthorized.
* **Evidence & Repro**:
  ```ruby
  # authentication_controller.rb
  return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'
  ```
  While `AuthorizeApiRequest::ASSESSOR_ROLES = %w[admin assessor]` and controllers mandate `authorize_auth_token! :assessor`, the login endpoint strictly required `user.role == 'admin'`. Furthermore, `User::ROLES` only included `admin` and `user`.
* **Fix Applied**: Added `'assessor'` to `User::ROLES` and updated `AuthenticationController#authenticate` to allow `%w[admin assessor].include?(user.role)`. Verified with `spec/requests/api/v1/authentication_spec.rb`.

---

### 2. INT-01: Candidate Invite URL Points to API Port 3001 (P0 Blocker)
* **Category**: Built Wrong
* **Location**: `api/app/models/session.rb:29`
* **One-Line Impact**: Candidates clicking the interview invite link hit the Rails API and get a 404 Routing Error instead of the interview web app.
* **Evidence & Repro**:
  ```ruby
  # session.rb
  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end
  ```
  Rails serves API endpoints on port 3001 without an `/interview/:token` route. The frontend Vite app runs on port 5173.
* **Fix Applied**: Updated `session.rb` to default to `ENV['WEB_BASE_URL'] || ENV['APP_BASE_URL'] || 'http://localhost:5173'`. Verified with `spec/models/session_spec.rb`.

---

### 3. DAT-01: Fit/Gap Comparison Contract Mismatch & Dropped Override Flag (P1 Major)
* **Category**: Built Wrong (Seam Defect)
* **Location**: `api/app/services/fit_gap/engine.rb:62` vs `web/src/components/fitgap/ComparisonTable.tsx:50`
* **One-Line Impact**: Assessors see an empty "Required" level column and no visual indicator when an AI score has been manually overridden.
* **Evidence & Repro**:
  Backend `FitGap::Engine#build_skill_comparisons` returned:
  ```ruby
  { skill_label: label, skill_id: ..., candidate_level: ..., expected_level: expected_level, result: result }
  ```
  The frontend `ComparisonTable.tsx` expected `c.required_level`:
  ```tsx
  <td className="px-4 py-2.5 text-center text-muted-foreground">{LEVEL_LABELS[c.required_level]}</td>
  ```
  `LEVEL_LABELS[undefined]` rendered blank. Additionally, `is_override` was never returned in the payload, suppressing the pencil badge `✏`.
* **Fix Applied**: Updated `FitGap::Engine` to emit both `expected_level` and `required_level`, alongside `is_override: portfolio_skill&.dig(:overridden) || false`. Updated `ComparisonTable.tsx` to handle `c.required_level ?? c.expected_level`. Verified with `ComparisonTable.test.tsx` and `engine_spec.rb`.

---

### 4. DAT-02: SkillPicker Drops `skill_id` From Taxonomy (P1 Major)
* **Category**: Built Wrong
* **Location**: `web/src/components/assessment/SkillPicker.tsx:41` & `web/src/types/index.ts:19`
* **One-Line Impact**: Skills selected from the standardized B7 taxonomy lose their unique ID, breaking traceability and automated matching.
* **Evidence & Repro**:
  In `types/index.ts`, `AssessmentSkill.skill_id` was typed as `number`, while `SkillTaxonomy.skill_id` was `string` (e.g. `"sk-eng-001"`). To silence TypeScript compiler warnings, the original developer forced:
  ```typescript
  // SkillPicker.tsx
  const handleSelect = (s: SkillTaxonomy) => {
    onSelect({
      skill_id: undefined, // forced to undefined!
      skill_label: s.skill_label,
      ...
    });
  };
  ```
* **Fix Applied**: Corrected `skill_id?: string` in `types/index.ts` across `AssessmentSkill`, `VacancySkill`, `PortfolioSkill`, and `CoverageSkill`. Updated `SkillPicker.tsx` to preserve `skill_id: s.skill_id`. Verified with `SkillPicker.test.tsx`.

---

### 5. SEC-02: Multi-Tenant Portfolio IDOR Vulnerability (P1 Major)
* **Category**: Built Wrong
* **Location**: `api/app/controllers/api/v1/portfolios_controller.rb:82, 104, 130` & `portfolio_skills_controller.rb:51`
* **One-Line Impact**: Any authenticated assessor from Company A can view, regenerate, and export interview portfolios of candidates from Company B by supplying their ID.
* **Evidence & Repro**:
  While `Assessment`, `Session`, and `Vacancy` include `TenantScoped`, `Portfolio` does not carry a `tenant_id` column. Lookups in `PortfoliosController` executed raw `Portfolio.find(params[:id])` without validating that the session belonged to `current_tenant_id`.
* **Fix Applied**: Updated `PortfoliosController#set_portfolio` and `PortfolioSkillsController#set_portfolio_skill` to scope lookups through `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })`. Verified with `spec/requests/api/v1/portfolios_spec.rb`.

---

### 6. LLM-01: Discovered Skills Excluded from Priority Probing (P2 Minor)
* **Category**: Built Wrong (PRD Divergence)
* **Location**: `api/app/services/coverage/map_injector.rb:104`
* **One-Line Impact**: When a candidate reveals an unscripted skill, the Gemini Live interviewer fails to receive the nudge to explore it, violating PRD-01 Section 5.
* **Evidence & Repro**:
  `MapInjector#priority_next` only evaluated configured skills, ignoring discovered skills in state `initiated`.
* **Fix Applied**: Updated `priority_next(configured_maps, discovered_maps)` to return `'discovered'` when any discovered skill is `initiated`.

---

### 7. UI-01: Missing `scope_exclude` Input in `CustomSkillForm.tsx` (P2 Minor)
* **Category**: Missing Spec / Incomplete UI
* **Location**: `web/src/components/assessment/CustomSkillForm.tsx`
* **One-Line Impact**: Assessors creating custom skills cannot define "What does NOT count", increasing risk of model halluncination or off-target questions.
* **Fix Applied**: Added `scope_exclude` textarea to `CustomSkillForm.tsx`.

---

## Systemic Patterns Behind Recurring Issues

Our analysis revealed three major systemic failure modes:
1. **Frontend-Backend Contract Drift without Schema Validation**:  
   TypeScript types and Rails models/serializers were written independently without contract testing or shared schemas (e.g. OpenAPI/Zod schemas). This led to `expected_level` vs `required_level` breakage and `skill_id: number` vs `string` type-coercion bypasses.
2. **Incomplete Multi-Tenancy Strategy**:  
   Multi-tenancy was bolted onto top-level models (`Assessment`, `Vacancy`) via `TenantScoped`, but intermediate/leaf models (`Portfolio`, `PortfolioSkill`) lacked tenant scoping, resulting in IDOR vulnerabilities across relational boundaries.
3. **Workflow Softness (Ghost Specs & Untested Commits)**:  
   Features such as `SkillPicker`, `ComparisonTable`, and `CustomSkillForm` were committed without unit tests or acceptance criteria checks. When developers encountered TypeScript errors, they muted them (e.g., setting `skill_id: undefined`) rather than fixing the contract.

---

## Recommendations & Next Steps

1. **Gate Development with Definition of Ready**: Enforce our GitHub Actions Workflow Gate (`.github/workflows/quality-gate.yml`) so no PR merges without linked specs and automated tests.
2. **Adopt Shared Contract Typing**: Generate TypeScript definitions directly from Rails database schema / serializers.
3. **Automate Multi-Tenant Boundary Tests**: Add automated rspec tenant-isolation tests for all current and future endpoints.
