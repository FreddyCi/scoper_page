# Project Task Breakdown Template

**Author:** [Your Name]  
**Date:** [YYYY-MM-DD]  
**Based on:** PRD v[X.X], TRD v[X.X] (if applicable)

**Project Focus:** [One-sentence description of what this project accomplishes]

---

## Task Structure

Each task follows this format:

- **ID:** Unique identifier (PROJECT-###)
- **Title:** Short, action-oriented summary (3-7 words)
- **Status:** To Do / In Progress / Done / Blocked
- **Dependencies:** List of prerequisite task IDs
- **Priority:** Critical / High / Medium / Low
- **Description:** Full scope and expected deliverables
- **Completed Changes:** Detailed checklist of implementation steps (✅/🔄)
- **Test Strategy:** How to verify it's complete
- **Test Results:** Actual outcomes with build metrics
- **Assigned:** Owner or "Unassigned"
- **Context/Artifacts:** References to relevant PRD/TRD/Code/Docs, `.github/copilot-instructions.md` sections

---

## Example Task (Empty/Planning State)

### **ID:** PROJ-001

**Title:** [Action-oriented task title]  
**Status:** To Do  
**Dependencies:** None (or list task IDs)  
**Priority:** Critical  
**Description:** [Describe what needs to be built/implemented. Include expected deliverables, scope boundaries, and any specific requirements from PRD/TRD.]  
**Completed Changes:**
- 🔄 [Placeholder for work to be done]
**Test Strategy:** [Define how you'll verify this task is complete. Include commands to run, expected outputs, acceptance criteria.]  
**Test Results:**
- 🔄 [Pending implementation]
**Assigned:** Unassigned  
**Context/Artifacts:** [Reference PRD sections, TRD sections, documentation links, example code, .github/copilot-instructions.md sections]

---

## Example Task (Completed State)

### **ID:** PROJ-001

**Title:** Initialize project scaffold with TypeScript  
**Status:** Done  
**Dependencies:** None  
**Priority:** Critical  
**Description:** Bootstrap project with modern TypeScript tooling. Setup: Vite 7.x, React 19.x, TypeScript 5.9+, package manager (Bun/npm), ESLint + Prettier, path aliases (@/ → src/), hot reload. Create base directory structure, configure tsconfig.json with strict mode, add build scripts for development and production.  
**Completed Changes:**
- ✅ Created project root with `bun create vite` (React + TypeScript template)
- ✅ Installed latest dependencies: React 19.2.0, Vite 7.2.2, TypeScript 5.9.3
- ✅ Configured tsconfig.json with strict mode, path aliases (@/, @components/, @utils/)
- ✅ Set up Vite config with path resolution and optimizations
- ✅ Added ESLint + Prettier with React/TypeScript rules
- ✅ Created directory structure: src/{components,lib,utils,hooks,types,assets}
- ✅ Added dev/build/preview scripts to package.json
- ✅ Configured .gitignore (node_modules, dist, .env, .DS_Store)
- ✅ Created README.md with setup instructions
- ✅ Dev server running at localhost:5173 with <1s HMR
**Test Strategy:** `bun run dev` starts dev server; hot reload works on file save; `bun run build` produces optimized bundle; TypeScript strict mode compiles without errors; path aliases resolve correctly.  
**Test Results:**
- ✅ TypeScript compiles without errors (strict mode enabled)
- ✅ Dev server starts in 450ms
- ✅ HMR works (<100ms update time)
- ✅ Production build completes in 2.1s
- ✅ Build output: 142KB JS (45KB gzipped), 3.2KB CSS
- ✅ All path aliases (@/, @components/) resolve correctly
- ✅ ESLint passes with 0 warnings
- ✅ Prettier formatting applied successfully
**Assigned:** Completed  
**Context/Artifacts:** package.json, tsconfig.json, vite.config.ts, .eslintrc.json, README.md, .github/copilot-instructions.md §Foundation

---

## Task Phases Template

Below is a template for organizing tasks into logical phases. Customize phase names based on your project architecture.

---

## 🏗️ Phase 1: Foundation & Core Infrastructure

> **Purpose:** Establish base project structure, tooling, and core technical infrastructure

### **ID:** PROJ-001

**Title:** [Scaffold project with framework/tooling]  
**Status:** To Do  
**Dependencies:** None  
**Priority:** Critical  
**Description:** [Initialize project, configure build system, set up development environment]  
**Test Strategy:** [Build runs, dev server starts, hot reload works]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Technical Requirements, .github/copilot-instructions.md §Foundation, docs/setup-guide.md]  

---

### **ID:** PROJ-002

**Title:** [Set up state management / data layer]  
**Status:** To Do  
**Dependencies:** PROJ-001  
**Priority:** Critical  
**Description:** [Configure state management solution (Zustand/Redux/etc), define core data structures, implement persistence if needed]  
**Test Strategy:** [Store initializes, actions dispatch correctly, state updates trigger re-renders]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §System Components, .github/copilot-instructions.md §State Management, docs/architecture.md, docs/data-models.md]  

---

### **ID:** PROJ-003

**Title:** [Configure API/service layer]  
**Status:** To Do  
**Dependencies:** PROJ-001  
**Priority:** High  
**Description:** [Set up HTTP client, define API contracts, implement error handling, configure environment variables for endpoints]  
**Test Strategy:** [API calls succeed, errors handled gracefully, types enforced, environment config works]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Technical Requirements, .github/copilot-instructions.md §API Patterns, docs/api-contracts.md, docs/environment-config.md]  

---

## 🎨 Phase 2: UI Components & Design System

> **Purpose:** Build reusable component library and establish visual design patterns

### **ID:** PROJ-010

**Title:** [Integrate design system / component library]  
**Status:** To Do  
**Dependencies:** PROJ-001  
**Priority:** High  
**Description:** [Add UI library (Shadcn, React Spectrum, MUI, etc.), configure theming, set up typography/colors/spacing system]  
**Test Strategy:** [Components render correctly, theming applies, responsive behavior works]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Design & UX Requirements, .github/copilot-instructions.md §UI Components, docs/design-system.md, docs/theming-guide.md]  

---

### **ID:** PROJ-011

**Title:** [Build core layout components]  
**Status:** To Do  
**Dependencies:** PROJ-010  
**Priority:** Medium  
**Description:** [Create app shell, navigation, header/footer, sidebar, responsive containers]  
**Test Strategy:** [Layouts render on different screen sizes, navigation works, accessibility checks pass]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Design & UX Requirements, .github/copilot-instructions.md §Layout Patterns, docs/design-system.md, docs/component-specs.md]  

---

## 🔌 Phase 3: Feature Implementation

> **Purpose:** Implement core product features and user-facing functionality

### **ID:** PROJ-020

**Title:** [Implement Feature A]  
**Status:** To Do  
**Dependencies:** PROJ-002, PROJ-010  
**Priority:** High  
**Description:** [Build primary feature with UI, business logic, state management, and data flow]  
**Test Strategy:** [Feature works end-to-end, handles edge cases, integrates with state/API]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §System Components §5.X, PRD §Workflows §6.X, .github/copilot-instructions.md §Features, docs/feature-specs.md, docs/user-flows.md]  

---

### **ID:** PROJ-021

**Title:** [Implement Feature B]  
**Status:** To Do  
**Dependencies:** PROJ-020  
**Priority:** Medium  
**Description:** [Build secondary feature]  
**Test Strategy:** [Feature functional, tested with various inputs]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §System Components §5.X, PRD §Workflows §6.X, .github/copilot-instructions.md §Features, docs/feature-specs.md, docs/user-flows.md]  

---

## 🔐 Phase 4: Authentication & Security

> **Purpose:** Implement user authentication, authorization, and security measures

### **ID:** PROJ-030

**Title:** [Set up authentication flow]  
**Status:** To Do  
**Dependencies:** PROJ-003  
**Priority:** Critical  
**Description:** [Implement OAuth/JWT/session auth, login/logout flows, token management, protected routes]  
**Test Strategy:** [Users can log in/out, tokens refresh correctly, protected routes enforce auth]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Technical Requirements §9.3, .github/copilot-instructions.md §Authentication, docs/auth-flow.md, docs/security.md]  

---

## 🧪 Phase 5: Testing & Quality Assurance

> **Purpose:** Ensure code quality, test coverage, and reliability

### **ID:** PROJ-040

**Title:** [Set up testing infrastructure]  
**Status:** To Do  
**Dependencies:** PROJ-001  
**Priority:** High  
**Description:** [Configure test runner (Vitest/Jest), testing library, coverage reporting, CI integration]  
**Test Strategy:** [Tests run successfully, coverage reports generated, CI pipeline passes]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Technical Requirements, .github/copilot-instructions.md §Testing, docs/testing-strategy.md, docs/ci-cd-setup.md]  

---

### **ID:** PROJ-041

**Title:** [Write unit tests for core modules]  
**Status:** To Do  
**Dependencies:** PROJ-040  
**Priority:** Medium  
**Description:** [Test state management, utilities, business logic, API client]  
**Test Strategy:** [> 80% coverage on critical paths, edge cases handled]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Technical Requirements, .github/copilot-instructions.md §Testing Standards, docs/testing-strategy.md, docs/test-examples.md]  

---

### **ID:** PROJ-042

**Title:** [Write integration tests]  
**Status:** To Do  
**Dependencies:** PROJ-041  
**Priority:** Medium  
**Description:** [Test feature flows, component integration, API mocking]  
**Test Strategy:** [End-to-end scenarios work, mocked API responses validated]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Workflows, .github/copilot-instructions.md §Integration Testing, docs/testing-strategy.md, docs/integration-test-examples.md]  

---

## 📦 Phase 6: Build & Deployment

> **Purpose:** Optimize production builds and establish deployment pipeline

### **ID:** PROJ-050

**Title:** [Optimize production build]  
**Status:** To Do  
**Dependencies:** PROJ-020, PROJ-021  
**Priority:** High  
**Description:** [Configure code splitting, tree shaking, asset optimization, bundle analysis, lazy loading]  
**Test Strategy:** [Build completes <30s, bundle size optimized, lazy loading works, lighthouse score > 90]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Technical Requirements §9.4, .github/copilot-instructions.md §Build Optimization, docs/build-config.md, docs/performance-targets.md]  

---

### **ID:** PROJ-051

**Title:** [Set up CI/CD pipeline]  
**Status:** To Do  
**Dependencies:** PROJ-050  
**Priority:** High  
**Description:** [Configure GitHub Actions/GitLab CI, automated testing, build on PR, deploy to staging/prod]  
**Test Strategy:** [Pipeline runs on commits, tests execute, builds deploy automatically]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Timeline & Milestones, .github/copilot-instructions.md §Deployment, docs/ci-cd-setup.md, docs/deployment-guide.md]  

---

## 📚 Phase 7: Documentation & Polish

> **Purpose:** Finalize documentation, accessibility, and user experience refinements

### **ID:** PROJ-060

**Title:** [Write developer documentation]  
**Status:** To Do  
**Dependencies:** All previous phases  
**Priority:** Medium  
**Description:** [README with setup instructions, architecture docs, API documentation, contribution guide]  
**Test Strategy:** [New developer can set up project following README, docs are accurate]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Overview, PRD §System Components, .github/copilot-instructions.md, docs/architecture.md, docs/contributing.md]  

---

### **ID:** PROJ-061

**Title:** [Accessibility audit & fixes]  
**Status:** To Do  
**Dependencies:** PROJ-011, PROJ-020  
**Priority:** High  
**Description:** [Run axe/WAVE audit, fix keyboard navigation, ARIA labels, color contrast, screen reader support]  
**Test Strategy:** [axe DevTools shows 0 violations, keyboard navigation works, screen reader announces correctly]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Design & UX Requirements §10.1, .github/copilot-instructions.md §Accessibility, docs/accessibility-guidelines.md, docs/wcag-checklist.md]  

---

## 🎯 Phase 8: Feature Completeness Validation

> **Purpose:** Final validation that all requirements from PRD are met

### **ID:** PROJ-070

**Title:** [PRD requirements verification]  
**Status:** To Do  
**Dependencies:** All feature tasks  
**Priority:** Critical  
**Description:** [Verify every PRD requirement is implemented, acceptance criteria met, stakeholder review completed]  
**Test Strategy:** [Checklist all PRD sections, demo to stakeholders, sign-off received]  
**Assigned:** Unassigned  
**Context/Artifacts:** [PRD §Goals, PRD §Deliverables, PRD §Success Metrics, docs/acceptance-criteria.md, docs/testing-checklist.md]  

---

## 📝 Task Management Guidelines

### Status Definitions

- **To Do**: Task defined but work not started
- **In Progress**: Active development, assigned to someone
- **Done**: All test results passing, code merged, documented
- **Blocked**: Cannot proceed due to external dependency or issue

### Priority Guidelines

- **Critical**: Blocks other work, must complete before proceeding
- **High**: Core functionality, needed for MVP
- **Medium**: Important but not blocking, can be parallelized
- **Low**: Nice-to-have, polish, optimizations

### Dependency Tracking

- List task IDs that must complete before this task can start
- Use "None" for foundational tasks with no prerequisites
- Update dependencies as project evolves

### Completed Changes Format

Use checkboxes to track granular progress:

```markdown
**Completed Changes:**
- ✅ [Specific implementation detail] 
- ✅ [Another completed item]
- 🔄 [Work in progress]
- 🔄 [Pending work]
```

### Test Results Format

Include quantitative metrics where possible:

```markdown
**Test Results:**
- ✅ Build time: 2.3s (target: <5s)
- ✅ Bundle size: 245KB gzipped (target: <500KB)
- ✅ TypeScript errors: 0 (strict mode)
- ✅ Test coverage: 87% (target: >80%)
- ✅ Lighthouse score: 94/100 (target: >90)
- 🔄 Integration testing pending deployment
```

---

## Project-Specific Customization

When using this template:

1. **Replace placeholder IDs**: Change `PROJ-###` to your project acronym (e.g., `PMA-###`, `TESS-###`)
2. **Customize phases**: Rename/reorder phases to match your architecture (e.g., "Tauri Setup", "Go Sidecar", "Temporal Workflows")
3. **Add technology-specific tasks**: Include tasks for your specific stack (Rust commands, database migrations, API contracts)
4. **Define metrics**: Set specific targets for build times, bundle sizes, test coverage based on your project requirements
5. **Update references**: Link to your actual PRD, TRD, architecture docs, and relevant external documentation
6. **Reference agent instructions**: Ensure every task's **Context/Artifacts** includes references to `.github/copilot-instructions.md` or `.cursorrules` sections relevant to that task (e.g., "§State Management", "§IPC Patterns", "§Testing Standards")

---

## Common Task Patterns

### Frontend Tasks
- Component scaffolding
- State management integration
- API client setup
- Routing configuration
- Form validation
- Responsive design

### Backend Tasks
- Database schema design
- API endpoint implementation
- Authentication middleware
- Business logic modules
- Background job processing
- Caching layer

### DevOps Tasks
- Docker containerization
- Environment configuration
- CI/CD pipeline setup
- Monitoring/logging
- Performance optimization
- Security hardening

### Cross-Cutting Tasks
- Error handling strategy
- Logging infrastructure
- Analytics integration
- Internationalization (i18n)
- Accessibility (a11y)
- Documentation

---

## Tips for Effective Task Breakdown

1. **Keep tasks atomic**: Each task should be completable in 1-4 hours
2. **Make tasks testable**: Define clear acceptance criteria and test strategy
3. **Track dependencies explicitly**: Prevents parallelization bottlenecks
4. **Document as you go**: Update "Completed Changes" and "Test Results" immediately
5. **Use phases for mental models**: Helps prioritize and communicate progress
6. **Reference PRD sections**: Ensures traceability to requirements
7. **Include metrics**: Build times, bundle sizes, test coverage make progress tangible
8. **Update status frequently**: Keeps team aligned on what's in flight
9. **Link to agent instructions**: Always reference `.github/copilot-instructions.md`, `.cursorrules`, or similar files in **Context/Artifacts** so AI agents can understand project-specific conventions, architecture patterns, and coding standards

---

## Success Indicators

A well-formed task breakdown achieves:

- **Clear ownership**: Every critical task has an assignee
- **Minimal blockers**: Dependencies identified early, resources allocated
- **Measurable progress**: Test results provide objective completion criteria
- **Low ambiguity**: Any team member can pick up a task and execute
- **Traceable to requirements**: Every task maps to PRD/TRD sections
- **Realistic estimates**: Phases complete on predictable timelines
