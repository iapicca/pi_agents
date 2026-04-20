# Plan Template

Use this template when creating `.tmp/PLAN.md` from the PLANNER agent.

```markdown
# PLAN: {{PROJECT_NAME}}

**Status:** Draft → Pending Approval  
**Pre-Plan Reference:** [View Pre-Plan](.tmp/pre-plan.md)  
**Generated:** {{DATE}}

## Overview

{{1-2 paragraph summary of what will be built and why}}

### Goals
- {{Specific, measurable goal 1}}
- {{Specific, measurable goal 2}}
- {{Specific, measurable goal 3}}

### Non-Goals (Explicitly Out of Scope)
- {{What this plan does NOT cover}}
- {{Boundaries of the implementation}}

## Architecture Overview

{{High-level architecture diagram or description}}

```
[Component A] → [Component B] → [Component C]
     ↓              ↓              ↓
[Service X]    [Service Y]    [Service Z]
```

## Step-by-Step Implementation Guide

### Phase 1: {{Phase Name}} ({{Estimated Time}})
**Objective:** {{What this phase accomplishes}}

#### Step 1.1: {{Step Name}}
- **Action:** {{Specific, actionable task}}
- **Rationale:** {{Why this step is needed}}
- **Verification:** {{How to verify completion}}
- **Reference:** [Official Doc]({{URL}})
- **Acceptance Criteria:**
  - [ ] {{Criterion 1}}
  - [ ] {{Criterion 2}}

#### Step 1.2: {{Step Name}}
- **Action:** {{Specific, actionable task}}
- **Rationale:** {{Why this step is needed}}
- **Verification:** {{How to verify completion}}
- **Reference:** [Official Doc]({{URL}})

### Phase 2: {{Phase Name}} ({{Estimated Time}})
**Objective:** {{What this phase accomplishes}}

#### Step 2.1: {{Step Name}}
...

## API Integration Details

| API/Service | Endpoint | Method | Purpose | Auth | Official Doc |
|-------------|----------|--------|---------|------|--------------|
| {{API}} | `{{ENDPOINT}}` | {{METHOD}} | {{Purpose}} | {{Auth}} | [Docs]({{URL}}) |

### Request/Response Examples

#### {{API Name}} - {{Operation}}

**Request:**
```http
{{METHOD}} {{ENDPOINT}} HTTP/1.1
Authorization: {{AUTH_HEADER}}
Content-Type: application/json

{
  "{{field}}": "{{value}}"
}
```

**Success Response ({{CODE}}):**
```json
{
  "{{field}}": "{{value}}"
}
```

**Error Responses:**
- `{{CODE}}`: {{Error description}}
- `{{CODE}}`: {{Error description}}

## Anti-Patterns to Avoid

### ❌ DON'T: {{Anti-Pattern Name}}
**What it is:** {{Description}}  
**Why it's bad:** {{Problems it causes}}  
**Instead:** {{Recommended approach}}  
**Reference:** [Why this matters]({{URL}})

### ❌ DON'T: {{Anti-Pattern Name}}
...

## Testing Strategy

### Unit Tests
- **Scope:** {{What to test at unit level}}
- **Coverage Target:** {{Percentage}}%
- **Key Scenarios:**
  - {{Test scenario 1}}
  - {{Test scenario 2}}

### Integration Tests
- **Scope:** {{What to test at integration level}}
- **Test Environments:** {{Environments}}
- **Key Scenarios:**
  - {{Integration scenario 1}}
  - {{Integration scenario 2}}

### End-to-End Tests
- **Scope:** {{Full user workflows to test}}
- **Tools:** {{Testing tools}}
- **Key Scenarios:**
  - {{E2E scenario 1}}
  - {{E2E scenario 2}}

## Rollback Plan

If issues occur after deployment:

### Immediate Rollback (< 5 minutes)
1. {{Step 1}}
2. {{Step 2}}
3. **Verification:** {{How to confirm rollback success}}

### Full Rollback (< 30 minutes)
1. {{Step 1}}
2. {{Step 2}}
3. {{Step 3}}
4. **Verification:** {{How to confirm rollback success}}

## Monitoring & Observability

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| {{Metric}} | {{Threshold}} | {{Action}} |

### Logging Requirements
- {{What to log}}
- {{Log level}}
- {{Retention period}}

## Security Considerations

| Concern | Mitigation | Verification |
|---------|------------|--------------|
| {{Concern}} | {{Mitigation}} | {{How to verify}} |

## Dependencies

### Required (From Pre-Plan)
| Dependency | Version | Installation | Official Doc |
|------------|---------|--------------|--------------|
| {{Dep}} | {{Version}} | `{{Command}}` | [Docs]({{URL}}) |

### Optional
| Dependency | Purpose | When Needed |
|------------|---------|-------------|
| {{Dep}} | {{Purpose}} | {{Condition}} |

## Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|-----------------|--------------|
| {{Phase}} | {{Time}} | {{Dependencies}} |

**Total Estimated Time:** {{Total}}

**Buffer:** {{Buffer percentage}}% (for testing, bug fixes, unknowns)

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation Strategy | Owner |
|------|------------|--------|---------------------|-------|
| {{Risk}} | High/Med/Low | High/Med/Low | {{Strategy}} | {{Role}} |

## Acceptance Criteria

- [ ] {{Criterion 1: Specific and measurable}}
- [ ] {{Criterion 2: Specific and measurable}}
- [ ] {{Criterion 3: Specific and measurable}}

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests passing (>X% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Rollback plan tested (if applicable)

## References

- **Pre-Plan:** [.tmp/pre-plan.md](.tmp/pre-plan.md)
- {{Additional reference 1}}
- {{Additional reference 2}}

---

**Planned By:** {{AGENT_NAME}}  
**User Approval:** ⏳ Pending  
**Next Step:** User reviews and approves this plan
```

## Usage Notes

### For PLANNER Agent

1. Fill in ALL sections - do not leave blanks
2. Replace {{VARIABLES}} with actual content
3. Ensure every API reference links to official documentation
4. Include specific, measurable acceptance criteria
5. Never include implementation code - only planning

### Required Fields

- Project name
- Overview with clear goals and non-goals
- At least 2 implementation phases
- API integration details with official doc links
- At least 1 anti-pattern
- Testing strategy (unit, integration, E2E)
- Rollback plan
- Acceptance criteria (minimum 3)

### Variable Definitions

- `{{PROJECT_NAME}}` - Name of the project or feature
- `{{DATE}}` - Generation date
- `{{Phase Name}}` - Name of implementation phase
- `{{Estimated Time}}` - Time estimate (e.g., "2-3 days")
- `{{Step Name}}` - Specific implementation step
- `{{API}}` - API or service name
- `{{ENDPOINT}}` - API endpoint path
- `{{METHOD}}` - HTTP method (GET, POST, etc.)
- `{{URL}}` - Link to official documentation
- `{{AGENT_NAME}}` - Name of the planning agent
