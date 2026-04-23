# Pre-Plan Template

Use this template when creating `.tmp/pre-plan.md` from the RESEARCHER agent.

```markdown
# Pre-Plan: {{PROJECT_NAME}}

Generated: {{DATE}}
Request: {{USER_REQUEST}}

## Verified Technology Stack

| Technology | Version | Source | Purpose | Official Doc |
|------------|---------|--------|---------|--------------|
| {{Tech}} | {{Version}} | {{Source}} | {{Purpose}} | [Docs]({{URL}}) |

## API Authentication Requirements

⚠️ All authentication requirements verified against official documentation.

| API/Service | Auth Required | Method | Verified Against |
|-------------|---------------|--------|------------------|
| {{API}} | Yes/No | {{Method}} | [Official Doc]({{URL}}) |

## Potential Risks and Blockers

| Risk | Severity | Mitigation Strategy | Official Reference |
|------|----------|---------------------|-------------------|
| {{Risk}} | High/Med/Low | {{Mitigation}} | [Ref]({{URL}}) |

## Compatibility Matrix

| Component | Required Version | Current Project | Status |
|-----------|------------------|-----------------|--------|
| {{Component}} | {{Required}} | {{Current}} | ✅/⚠️/❌ |

## Official Documentation Consulted

1. [{{Title}}]({{URL}}) - {{Description}}
2. [{{Title}}]({{URL}}) - {{Description}}
3. [{{Title}}]({{URL}}) - {{Description}}

## Research Summary

{{2-3 paragraph summary of key findings, decisions, and recommendations}}

## Assumptions Challenged

| Assumption in Request | Official Doc Finding | Impact |
|----------------------|---------------------|--------|
| {{Assumption}} | {{Finding}} | {{Impact}} |

## Next Steps for Planner

- {{Specific guidance for the PLANNER agent}}
- {{Key technical decisions already verified}}
- {{Areas requiring further clarification}}

---
**Research Agent:** {{AGENT_NAME}}  
**Sources Verified:** {{COUNT}} official sources  
**Unofficial Sources Rejected:** {{COUNT}} (Medium, StackOverflow, etc.)
```

## Variable Definitions

- `{{PROJECT_NAME}}` - Name of the project or feature
- `{{DATE}}` - Date of research completion
- `{{USER_REQUEST}}` - Original user request text
- `{{Tech}}` - Technology name
- `{{Version}}` - Version requirement
- `{{Source}}` - Where it's used in the request
- `{{Purpose}}` - What it's used for
- `{{URL}}` - Link to official documentation
- `{{API}}` - API or service name
- `{{Method}}` - Authentication method (OAuth, API Key, etc.)
- `{{Risk}}` - Description of potential risk
- `{{Mitigation}}` - How to avoid or handle the risk
- `{{Component}}` - Component name
- `{{Required}}` - Version required by dependencies
- `{{Current}}` - Version currently in use (if any)
- `{{AGENT_NAME}}` - Name of the agent that performed research
- `{{COUNT}}` - Number of sources

## Example Output

```markdown
# Pre-Plan: OAuth Authentication Integration

Generated: 2026-01-15
Request: Add OAuth authentication with GitHub and Google

## Verified Technology Stack

| Technology | Version | Source | Purpose | Official Doc |
|------------|---------|--------|---------|--------------|
| GitHub OAuth | v2 | User request | GitHub login | [Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) |
| Google OAuth | 2.0 | User request | Google login | [Docs](https://developers.google.com/identity/protocols/oauth2) |
| Passport.js | ^0.7.0 | Recommended | OAuth middleware | [Docs](http://www.passportjs.org/docs/) |
| Express | ^4.x | Current project | Web framework | [Docs](https://expressjs.com/en/api.html) |

## API Authentication Requirements

⚠️ All authentication requirements verified against official documentation.

| API/Service | Auth Required | Method | Verified Against |
|-------------|---------------|--------|------------------|
| GitHub OAuth | Yes | OAuth 2.0 Authorization Code Flow | [GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) |
| Google OAuth | Yes | OAuth 2.0 with PKCE | [Google Identity](https://developers.google.com/identity/protocols/oauth2) |

## Potential Risks and Blockers

| Risk | Severity | Mitigation Strategy | Official Reference |
|------|----------|---------------------|-------------------|
| Token storage security | High | Use httpOnly cookies, encrypt at rest | [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) |
| OAuth redirect vulnerability | High | Validate redirect URIs strictly | [RFC 6819](https://tools.ietf.org/html/rfc6819) |
| Session management complexity | Med | Use battle-tested library (Passport.js) | [Passport Docs](http://www.passportjs.org/docs/) |

## Compatibility Matrix

| Component | Required Version | Current Project | Status |
|-----------|------------------|-----------------|--------|
| Node.js | >=18.x | 20.x | ✅ Compatible |
| Express | >=4.x | 4.18.x | ✅ Compatible |
| Passport.js | ^0.7.0 | Not present | ⚠️ Needs installation |

## Official Documentation Consulted

1. [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) - Authorization flow and security
2. [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) - OAuth 2.0 implementation guide
3. [Passport.js Documentation](http://www.passportjs.org/docs/) - Middleware integration
4. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) - Security best practices

## Research Summary

The requested OAuth integration is technically feasible with the current Express.js stack. Both GitHub and Google use standard OAuth 2.0 authorization code flow, which can be implemented using Passport.js middleware. 

Key findings:
- Passport.js has official strategies for both GitHub and Google OAuth
- Token security requires careful implementation using httpOnly cookies
- The current Node.js 20.x version is fully compatible with all dependencies
- No breaking changes expected in the integration

## Assumptions Challenged

| Assumption in Request | Official Doc Finding | Impact |
|----------------------|---------------------|--------|
| "Simple OAuth login" | OAuth requires session management, token storage, and security considerations | Medium - adds complexity |
| "Use local storage for tokens" | Official docs recommend httpOnly cookies for security | High - must change approach |

## Next Steps for Planner

- Focus on security-first implementation using httpOnly cookies
- Plan for token refresh mechanism (OAuth tokens expire)
- Include session management architecture
- Document security anti-patterns to avoid

---
**Research Agent:** researcher  
**Sources Verified:** 4 official sources  
**Unofficial Sources Rejected:** 3 (Medium tutorial, StackOverflow answer, dev.to post)
```
