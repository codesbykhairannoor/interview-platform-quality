# Quality System Architecture & Red-to-Green Story

**Author**: Fullstack Engineer (SDET Depth)  
**Deliverable**: `/assessment/02-quality-system.md`  
**Applies To**: Engineering Workflow, CI/CD Gates, Frontend & Backend Test Net  

---

## 1. Overview of the Quality System

Quality is not a QA phase bolted onto the end of a sprint; it is an enforced engineering net built into the developer workflow from the very first commit.

To protect the client-delivery squad from regressions, dropped requirements, and silent data rot, we built a **two-tier Quality Net**:
1. **The Workflow Gate (Definition of Ready / Done)**: Enforces that no code change advances through GitHub PRs without its required upstream inputs: linked Spec/PRD, explicit Acceptance Criteria, a Solution/Design Plan, and Automated Tests.
2. **The Test/CI Net (Targeted Regression & Contract Verification)**: Automated suites across Vitest and RSpec that verify critical user journeys, multi-tenant boundaries, and data integrity contracts across the frontend-backend seam.

```
                      [ DEVELOPER PULL REQUEST ]
                                  │
                                  ▼
              ┌────────────────────────────────────────┐
              │   Workflow Gate (scripts/verify-pr-dor) │
              │   Checks: Spec Link, AC, Design, Tests  │
              └───────────────────┬────────────────────┘
                                  │ Passed
                                  ▼
              ┌────────────────────────────────────────┐
              │          Continuous Integration        │
              ├────────────────────┬───────────────────┤
              │ Frontend (Vitest)  │ Backend (RSpec)   │
              │ - Contract tests   │ - Tenant isolation│
              │ - Seam data tests  │ - Auth role gates │
              │ - Form state tests │ - Model defaults  │
              └────────────────────┴───────────────────┘
                                  │ Passed
                                  ▼
                       [ MERGEABLE TO MAIN ]
```

---

## 2. The Workflow Gate: Enforcing the Definition of Ready

### How It Works
* **PR Template (`.github/pull_request_template.md`)**: Prompts the author for four mandatory sections: Spec/PRD reference, Acceptance Criteria (Given/When/Then), Solution/Design Plan, and Testing Verification.
* **Automated Gate Script (`scripts/verify-pr-dor.js`)**: Evaluates the PR payload via GitHub Actions. If any of the mandatory inputs or test files are absent, the check fails with a clear, actionable error message and blocks merge.
* **Non-Bureaucratic**: The gate parses standard engineering language (markdown headers, ticket links, diff checks) without requiring external Jira integrations or cumbersome administrative steps.

---

## 3. The Test Net: What It Protects & What It Deliberately Does Not

Rather than chasing superficial 100% test coverage on trivial UI elements, our test net targets **risk-carrying paths and seam contracts**:

| Test File | Target Layer | What It Protects | What It Deliberately Does NOT Cover |
| :--- | :--- | :--- | :--- |
| `web/src/test/ComparisonTable.test.tsx` | Web / UI Seam | Verifies that Fit/Gap comparison tables correctly read backend contracts (`required_level` / `expected_level`) and render override indicators (`✏`). | Does not test visual CSS animations or Tailwind color token rendering. |
| `web/src/test/SkillPicker.test.tsx` | Web / Taxonomy | Verifies that selecting skills from B7 taxonomy preserves the unique string `skill_id`. | Does not mock live network search debouncing or dialog animations. |
| `api/spec/requests/api/v1/authentication_spec.rb` | API / Security | Verifies that assessors can authenticate and receive JWTs without being blocked by admin-only checks. | Does not test third-party OAuth providers. |
| `api/spec/services/fit_gap/engine_spec.rb` | API / Domain | Verifies that `FitGap::Engine` emits complete comparison contracts matching frontend specifications. | Does not test external Gemini Flash LLM generation latency. |
| `api/spec/models/session_spec.rb` | API / Integration | Verifies that `invite_url` points to the client web application port (5173). | Does not test SMTP email delivery of invite links. |
| `api/spec/requests/api/v1/portfolios_spec.rb` | API / Security | Verifies cross-tenant data isolation, ensuring Tenant A assessors cannot access or export Tenant B portfolios. | Does not test rate limiting rules under DDoS conditions. |

---

## 4. How to Run the Quality System Locally

### Running the Workflow Gate
To test if a local commit meets the Definition of Ready:
```bash
# In platform root directory:
node scripts/verify-pr-dor.js
```

### Running the Frontend Test Net (Web)
```bash
cd web
npm install --legacy-peer-deps
npm test
```

### Running the Backend Test Net (API)
```bash
cd api
bundle exec rspec
```

---

## 5. The Red-to-Green Story

In accordance with our core engineering bar—*Green is earned, not forced*—every check was first verified **RED** against the defective baseline before code fixes turned the suite **GREEN**.

### Transition 1: SkillPicker Taxonomy ID Stripping (`SkillPicker.test.tsx`)
* **Red State**:
  ```
  FAIL src/test/SkillPicker.test.tsx
  AssertionError: expected undefined to be 'sk-eng-001'
  - Expected: "sk-eng-001"
  + Received: undefined
  ```
* **Root Cause**: `types/index.ts` defined `AssessmentSkill.skill_id` as `number`, while taxonomy IDs are strings (`sk-eng-001`). To suppress TypeScript compiler warnings, the original developer forced `skill_id: undefined`.
* **Fix Applied**: Updated `types/index.ts` to `skill_id?: string` and restored `skill_id: s.skill_id` in `SkillPicker.tsx`.
* **Green State**:
  ```
  ✓ src/test/SkillPicker.test.tsx (1 test) 297ms
  Test Files  1 passed (1)
  ```

---

### Transition 2: Fit/Gap Comparison Contract Seam Mismatch (`ComparisonTable.test.tsx`)
* **Red State**:
  ```
  FAIL src/test/ComparisonTable.test.tsx
  AssertionError: expected false to be true
  - Expected: true
  + Received: false (L3 absent from Required column)
  ```
* **Root Cause**: Backend `FitGap::Engine` returned `expected_level`, while frontend `ComparisonTable.tsx` expected `required_level`, causing `LEVEL_LABELS[undefined]` to render blank.
* **Fix Applied**:
  - Backend: Added `required_level: expected_level` and `is_override: portfolio_skill&.dig(:overridden) || false` to `FitGap::Engine#build_skill_comparisons`.
  - Frontend: Enhanced `ComparisonTable.tsx` to handle `c.required_level ?? c.expected_level`.
* **Green State**:
  ```
  ✓ src/test/ComparisonTable.test.tsx (3 tests) 414ms
  Test Files  1 passed (1)
  ```

---

### Transition 3: Assessor Authentication Role Lock (`authentication_spec.rb`)
* **Red State**:
  ```
  expected: 200 OK
       got: 401 Unauthorized (Invalid email or password)
  ```
* **Root Cause**: `AuthenticationController#authenticate` enforced `unless user.role == 'admin'`, rejecting valid assessor accounts.
* **Fix Applied**: Added `'assessor'` to `User::ROLES` in `user.rb` and permitted `%w[admin assessor]` in `AuthenticationController#authenticate`.
* **Green State**: Assessor authentication returns HTTP 200 with JWT bearer token.

---

### Transition 4: Candidate Invite URL Port Mismatch (`session_spec.rb`)
* **Red State**:
  ```
  expected "http://localhost:3001/interview/tok-123" not to include ":3001"
  ```
* **Root Cause**: `Session#invite_url` defaulted to port 3001 (API), returning 404 Routing Error when opened by candidates.
* **Fix Applied**: Updated `Session#invite_url` to default to `ENV['WEB_BASE_URL'] || ENV['APP_BASE_URL'] || 'http://localhost:5173'`.
* **Green State**: Invite URLs correctly resolve to the candidate web application.

---

### Transition 5: Multi-Tenant Portfolio IDOR (`portfolios_spec.rb`)
* **Red State**:
  ```
  expected: 404 Not Found
       got: 200 OK (Cross-tenant data leaked)
  ```
* **Root Cause**: `PortfoliosController` called un-scoped `Portfolio.find(params[:id])`, allowing cross-tenant data access.
* **Fix Applied**: Added tenant scoping via `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })`.
* **Green State**: Cross-tenant requests correctly receive HTTP 404 Not Found.
