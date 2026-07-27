# 📘 PRD — [Project Name]
*([Optional Tagline or Project Codename])*

**Author:** [Your Name]  
**Date:** [YYYY-MM-DD]  
**Version:** v1.0  
**Status:** Draft / In Review / Approved  

---

## 1. Overview

[Provide a clear, concise description of what this project is and what it accomplishes. Answer these questions:]

* What problem does this solve?
* Who is the primary user/audience?
* What are the key outputs/deliverables?
* How does this fit into the broader ecosystem?

[Example: "This project provides a desktop application for real-time meeting transcription and AI-powered note generation, helping product managers capture action items without manual note-taking."]

---

## 2. Goals

### 2.1 Primary Goals

[List the **must-have** objectives that define success. These are non-negotiable for v1.0.]

1. [Goal 1: Clear, measurable objective]
2. [Goal 2: Another core requirement]
3. [Goal 3: Essential feature or capability]
4. [Goal 4: Critical user outcome]
5. [Goal 5: Key technical achievement]

### 2.2 Secondary Goals

[List **nice-to-have** features that enhance the product but aren't required for initial launch.]

* [Secondary goal 1]
* [Secondary goal 2]
* [Secondary goal 3]

---

## 3. Non-Goals

[Explicitly state what this project will **NOT** do. This prevents scope creep and clarifies boundaries.]

This PRD **does not** define:

* [Non-goal 1: Feature/capability intentionally excluded]
* [Non-goal 2: Related but separate project]
* [Non-goal 3: Future enhancement saved for later versions]
* [Non-goal 4: Out-of-scope use case]
* [Non-goal 5: External dependency or integration]

---

## 4. Users & Personas

### 4.1 [Primary Persona Name]

**Role:** [Job title or user type]  
**Needs:** [What they're trying to accomplish]  
**Pain Points:** [Current challenges this project addresses]  
**Success Criteria:** [How they'll measure value]

**Example:** Product Manager at mid-sized tech company, attends 6-8 meetings daily, struggles to capture action items while actively participating, needs meeting notes within 5 minutes of meeting end.

---

### 4.2 [Secondary Persona Name]

**Role:** [Job title or user type]  
**Needs:** [What they're trying to accomplish]  
**Pain Points:** [Current challenges]  
**Success Criteria:** [How they measure value]

---

### 4.3 [Additional Personas as Needed]

[Include technical personas like "DevOps Engineer managing deployment" or "AI Agent consuming API" if relevant]

---

## 5. System Components

[Describe the major technical components, features, or modules that make up the system.]

### 5.1 [Component A: Name]

**Purpose:** [What this component does]  
**Key Features:**
* [Feature 1]
* [Feature 2]
* [Feature 3]

**Technologies:** [Specific tech stack if known]  
**Dependencies:** [What this relies on]

---

### 5.2 [Component B: Name]

**Purpose:** [What this component does]  
**Key Features:**
* [Feature 1]
* [Feature 2]

**Technologies:** [Tech stack]  
**Dependencies:** [Prerequisites]

---

### 5.3 [Component C: Name]

[Continue for each major component...]

---

## 6. Workflows

[Define the key user journeys and system processes. Show step-by-step flows.]

### 6.1 [Primary Workflow: Name]

**Trigger:** [What initiates this flow]  
**Steps:**

1. [Step 1: User action or system event]
2. [Step 2: System response]
3. [Step 3: Next action]
4. [Step 4: Outcome]

**Expected Outcome:** [What success looks like]  
**Edge Cases:** [Alternative paths or error scenarios]

---

### 6.2 [Secondary Workflow: Name]

**Trigger:** [What starts this process]  
**Steps:**

1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Outcome:** [Success state]

---

### 6.3 [Additional Workflows]

[Include onboarding, error handling, admin workflows, etc.]

---

## 7. User Stories

[Optional section for Agile teams. Format: As a [persona], I want [goal], so that [benefit].]

### Must-Have (P0)

1. **As a** [persona], **I want** [capability], **so that** [benefit]
2. **As a** [persona], **I want** [capability], **so that** [benefit]
3. **As a** [persona], **I want** [capability], **so that** [benefit]

### Should-Have (P1)

1. **As a** [persona], **I want** [capability], **so that** [benefit]
2. **As a** [persona], **I want** [capability], **so that** [benefit]

### Could-Have (P2)

1. **As a** [persona], **I want** [capability], **so that** [benefit]

---

## 8. Success Metrics

[Define measurable KPIs to track post-launch. Be specific with numbers.]

### 8.1 [Category 1: e.g., User Adoption]

* **Metric:** [Active daily users]
* **Target:** [100+ users within 30 days of launch]
* **Measurement:** [Analytics dashboard tracking]

### 8.2 [Category 2: e.g., Performance]

* **Metric:** [API response time]
* **Target:** [< 200ms p95 latency]
* **Measurement:** [Application monitoring logs]

### 8.3 [Category 3: e.g., Quality]

* **Metric:** [User satisfaction score]
* **Target:** [> 4.5/5 stars in feedback surveys]
* **Measurement:** [In-app feedback system]

### 8.4 [Category 4: e.g., Business Impact]

* **Metric:** [Time saved per user]
* **Target:** [30+ minutes per day]
* **Measurement:** [User-reported time tracking]

---

## 9. Technical Requirements

[Define technical constraints, architecture decisions, and platform requirements.]

### 9.1 Platform & Environment

* **Supported Platforms:** [macOS 12+, Windows 10+, Linux (Ubuntu 20.04+)]
* **Runtime:** [Node.js 20+, Python 3.11+, Go 1.23+]
* **Browser Support:** [Chrome 120+, Firefox 121+, Safari 17+] (if web app)

### 9.2 Architecture

* **Architecture Pattern:** [Microservices / Monolith / Event-Driven / etc.]
* **Data Flow:** [Diagram or description of how data moves through the system]
* **Key Integrations:** [External APIs, databases, third-party services]

### 9.3 Security & Privacy

* **Authentication:** [OAuth 2.0, JWT, SSO]
* **Data Encryption:** [AES-256 at rest, TLS 1.3 in transit]
* **Compliance:** [GDPR, SOC 2, HIPAA if applicable]
* **Privacy Considerations:** [User data handling, retention policies]

### 9.4 Performance Targets

* **Load Time:** [< 2 seconds initial page load]
* **Throughput:** [1000 requests/second]
* **Scalability:** [Support 10,000 concurrent users]
* **Availability:** [99.9% uptime SLA]

### 9.5 Data Requirements

* **Database:** [PostgreSQL 15, MongoDB 7, SQLite]
* **Data Models:** [Key entities and relationships]
* **Storage:** [100GB initial capacity, 1TB max]
* **Backup/Recovery:** [Daily automated backups, 4-hour RTO]

---

## 10. Design & UX Requirements

[Optional: Include design principles, mockups, or user experience guidelines.]

### 10.1 Design Principles

* [Principle 1: e.g., "Mobile-first responsive design"]
* [Principle 2: e.g., "Accessibility WCAG 2.1 AA compliance"]
* [Principle 3: e.g., "Dark mode support"]

### 10.2 Key Screens/Views

* **[Screen 1 Name]:** [Purpose and key elements]
* **[Screen 2 Name]:** [Purpose and key elements]
* **[Screen 3 Name]:** [Purpose and key elements]

### 10.3 Mockups/Wireframes

[Link to Figma, Sketch, or embed images if available]

---

## 11. Risks & Mitigations

[Identify potential issues and how you'll address them.]

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| [Risk 1: e.g., Third-party API rate limits] | High | Medium | [Implement caching layer, negotiate higher rate limits] |
| [Risk 2: e.g., User adoption slower than expected] | Medium | Low | [Beta testing program, phased rollout, user feedback loop] |
| [Risk 3: e.g., Technical complexity exceeds estimates] | High | Medium | [MVP scope reduction, phased feature delivery] |
| [Risk 4: e.g., Security vulnerability discovered] | Critical | Low | [Regular security audits, bug bounty program] |

---

## 12. Dependencies & Assumptions

### 12.1 Dependencies

**Internal:**
* [Dependency 1: e.g., Authentication service must be deployed first]
* [Dependency 2: e.g., Design system v2.0 completion]

**External:**
* [Dependency 3: e.g., OpenAI API availability]
* [Dependency 4: e.g., Cloud infrastructure provisioning]

### 12.2 Assumptions

* [Assumption 1: e.g., Users have stable internet connection (5+ Mbps)]
* [Assumption 2: e.g., Target users have microphone access]
* [Assumption 3: e.g., Budget approval for cloud hosting costs]
* [Assumption 4: e.g., No major platform API breaking changes during development]

---

## 13. Timeline & Milestones

[Provide a high-level roadmap. Detailed tasks go in the Task Breakdown document.]

| Milestone | Target Date | Deliverables | Dependencies |
|-----------|-------------|--------------|--------------|
| **M1: Foundation** | [YYYY-MM-DD] | [Core infrastructure, scaffolding] | None |
| **M2: MVP Features** | [YYYY-MM-DD] | [Primary user workflows functional] | M1 |
| **M3: Beta Launch** | [YYYY-MM-DD] | [Limited user testing, feedback collection] | M2 |
| **M4: GA Release** | [YYYY-MM-DD] | [Public launch, documentation complete] | M3 |
| **M5: Post-Launch** | [YYYY-MM-DD] | [Performance optimization, bug fixes] | M4 |

---

## 14. Deliverables

[Checklist of tangible outputs expected from this project.]

**Documentation:**
- [ ] Technical architecture diagram
- [ ] API documentation
- [ ] User guide / help documentation
- [ ] Admin documentation
- [ ] README with setup instructions

**Code & Infrastructure:**
- [ ] Production-ready codebase
- [ ] CI/CD pipeline configured
- [ ] Deployment scripts
- [ ] Database migrations
- [ ] Monitoring & logging setup

**Testing:**
- [ ] Unit test suite (>80% coverage)
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance/load testing results
- [ ] Security audit report

**Design:**
- [ ] High-fidelity mockups
- [ ] Design system documentation
- [ ] Accessibility audit

**Other:**
- [ ] Task breakdown document (use TASK_BREAKDOWN_TEMPLATE.md)
- [ ] Agent instructions (.github/copilot-instructions.md or .cursorrules)
- [ ] Launch plan
- [ ] Runbook for operations team

---

## 15. Open Questions

[Track unresolved decisions that need stakeholder input.]

1. **[Question 1]:** [e.g., Should we support offline mode in v1.0 or defer to v2.0?]  
   **Decision Maker:** [Name/Role]  
   **Due Date:** [YYYY-MM-DD]  
   **Status:** Open / Resolved

2. **[Question 2]:** [e.g., Which authentication provider should we prioritize (Google vs Microsoft)?]  
   **Decision Maker:** [Name/Role]  
   **Due Date:** [YYYY-MM-DD]  
   **Status:** Open / Resolved

3. **[Question 3]:** [Additional questions...]  
   **Decision Maker:** [Name/Role]  
   **Due Date:** [YYYY-MM-DD]  
   **Status:** Open / Resolved

---

## 16. Future Enhancements (v2.0+)

[Capture ideas for future iterations without committing to them now.]

* [Enhancement 1: e.g., Mobile app for iOS/Android]
* [Enhancement 2: e.g., AI-powered meeting scheduling suggestions]
* [Enhancement 3: e.g., Integration with calendar systems]
* [Enhancement 4: e.g., Multi-language support]
* [Enhancement 5: e.g., Video recording and analysis]

---

## 17. Appendix

### 17.1 Glossary

[Define project-specific terms and acronyms.]

* **[Term 1]:** [Definition]
* **[Term 2]:** [Definition]
* **[Acronym]:** [Full name and explanation]

### 17.2 References

[Link to related documents, research, or external resources.]

* [TRD (Technical Requirements Document)]: [Link]
* [Competitive Analysis]: [Link]
* [User Research Findings]: [Link]
* [Design Mockups (Figma)]: [Link]
* [API Documentation]: [Link]

### 17.3 Change Log

[Track major revisions to this PRD.]

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | [YYYY-MM-DD] | [Name] | Initial draft |
| v1.1 | [YYYY-MM-DD] | [Name] | [Summary of changes] |
| v2.0 | [YYYY-MM-DD] | [Name] | [Summary of changes] |

---

## Document Metadata

**Stakeholders:**
- **Owner:** [Name, Role]
- **Contributors:** [Names, Roles]
- **Reviewers:** [Names, Roles]
- **Approvers:** [Names, Roles]

**Review Cycle:**
- **Last Reviewed:** [YYYY-MM-DD]
- **Next Review:** [YYYY-MM-DD]
- **Review Frequency:** [Quarterly / As needed]

**Related Documents:**
- Task Breakdown: [Link to TASK_BREAKDOWN_TEMPLATE.md instance]
- Agent Instructions: [Link to .github/copilot-instructions.md]
- Architecture Diagram: [Link or attachment]
- Design Files: [Link to Figma/Sketch]

---

## Tips for Using This Template

1. **Fill out sections iteratively**: Start with Overview, Goals, and Users. Refine technical details as you go.
2. **Keep it concise**: Each section should be scannable. Use bullets and tables over long paragraphs.
3. **Link liberally**: Reference TRDs, task breakdowns, designs, and external docs to avoid duplication.
4. **Update the PRD as you learn**: This is a living document. Capture decisions in the Change Log.
5. **Review with stakeholders early**: Get alignment on Goals and Non-Goals before deep technical planning.
6. **Use this with the Design Workflow**: Follow the ChatGPT → RepoMix → Context7 → LM Studio pattern from `.github/copilot-instructions.md`.
7. **Create agent instructions alongside**: Draft `.github/copilot-instructions.md` or `.cursorrules` in parallel so AI agents can consume this PRD effectively.
8. **Track open questions aggressively**: Don't let unresolved decisions block progress. Escalate and time-box.

---

## Success Indicators for a Well-Formed PRD

A complete PRD should enable:

- **Clear scope**: Any engineer can read it and understand what's in/out of scope
- **Task breakdown**: You can decompose this into atomic tasks using TASK_BREAKDOWN_TEMPLATE.md
- **Stakeholder alignment**: All decision-makers agree on goals, metrics, and timeline
- **Agent productivity**: AI coding agents can generate scaffolding and tasks without hallucinating
- **Future maintainability**: New team members can onboard by reading this doc
- **Measurable success**: Post-launch, you can objectively determine if goals were met
