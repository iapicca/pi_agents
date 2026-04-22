---
name: gh-cli
description: Create and manage GitHub issues via gh CLI. Pre-approved for planning workflow - no confirmation required for gh issue commands. Issues follow Semantic Versioning (semver.org) with version numbers in titles.
license: MIT
compatibility: pi, claude-code, codex-cli
metadata:
  category: github
  pre-approved: true
  workflow: planning
---

# GitHub CLI Skill

Pre-approved GitHub CLI operations for the planning workflow. These commands execute without user confirmation.

## Semantic Versioning with Version Numbers

All issue titles MUST include semantic version numbers (https://semver.org/):

| Issue Type | Version Level | Title Format | Example |
|------------|---------------|--------------|---------|
| **Feature** | MAJOR (X.0.0) | `[{N}] Feat - {title}` | `[1] Feat - Add user authentication` |
| **Story** | MINOR (x.Y.0) | `[{N.M}] Story - {title}` | `[1.5] Story - Implement OAuth login` |
| **Task** | PATCH (x.y.Z) | `[{N.M.P}] Task - {title}` | `[1.5.3] Task - Create OAuth callback` |

### Version Number Rules

- **Features**: Use sequential whole numbers: `[1]`, `[2]`, `[3]`, etc.
- **Stories**: Use `{feature}.{story}` format: `[1.1]`, `[1.2]`, `[2.1]`, etc.
- **Tasks**: Use `{feature}.{story}.{task}` format: `[1.1.1]`, `[1.1.2]`, `[1.2.1]`, etc.

### Issue Hierarchy with Version Numbers

```
[1] Feat - Add User Authentication
  ├── [1.1] Story - Implement OAuth with GitHub
  │     ├── [1.1.1] Task - Create OAuth callback handler
  │     ├── [1.1.2] Task - Store user tokens securely
  │     └── [1.1.3] Task - Handle OAuth errors
  ├── [1.2] Story - Implement session management
  │     ├── [1.2.1] Task - Create session middleware
  │     └── [1.2.2] Task - Configure session store
  └── [1.3] Story - Add logout functionality
```

## Pre-Granted Commands

The following commands are pre-approved and execute without confirmation:

- `gh issue create`
- `gh issue list`
- `gh issue view`
- `gh api`
- `gh repo view`
- `git remote get-url origin`

## Setup

Ensure `gh` CLI is installed and authenticated:

```bash
# Check if authenticated
gh auth status

# Login if needed
gh auth login
```

## Usage

### Create Feature Issue (MAJOR)

```bash
MAJOR=1
gh issue create \
  --title "[$MAJOR] Feat - Add user authentication" \
  --body "Feature description..." \
  --label "feature"
```

### Create Story (MINOR - Child Issue)

```bash
# First get the parent feature issue number
FEATURE_NUM=$(gh issue list --label feature --json number --jq '.[0].number')

# Create child story with version number
FEATURE_MAJOR=1
MINOR=1
gh issue create \
  --title "[$FEATURE_MAJOR.$MINOR] Story - Implement OAuth login" \
  --body "Story description..." \
  --label "story" \
  --parent "$FEATURE_NUM"
```

### Create Task (PATCH - Child Issue)

```bash
# Get the parent story issue number
STORY_NUM=$(gh issue list --label story --json number --jq '.[0].number')

# Create child task with version number
FEATURE_MAJOR=1
STORY_MINOR=1
PATCH=1
gh issue create \
  --title "[$FEATURE_MAJOR.$STORY_MINOR.$PATCH] Task - Create OAuth callback" \
  --body "Task description..." \
  --label "task" \
  --parent "$STORY_NUM"
```

### List Issues

```bash
# List all issues
gh issue list

# List by label
gh issue list --label feature
gh issue list --label story
gh issue list --label task

# List with JSON output for scripting
gh issue list --json number,title,labels,state
```

### Get Repository Info

```bash
# Get repo name
gh repo view --json nameWithOwner

# Get remote URL
git remote get-url origin
```

## Template Variables

Use environment variables or inline substitution for dynamic content:

```bash
MAJOR=1
TITLE="Add Redis caching"
BODY=$(cat <<'EOF'
## Description
Implement Redis caching for session store.

## Acceptance Criteria
- [ ] Redis client configured
- [ ] Session caching implemented
- [ ] Fallback to database on cache miss
EOF
)

gh issue create --title "[$MAJOR] Feat - $TITLE" --body "$BODY" --label "feature"
```

## Creating Hierarchical Issues with Version Numbers

For the planning workflow, create issues in this order with sequential version numbers:

```bash
# Initialize version counters
MAJOR=1

# Step 1: Create feature (MAJOR)
FEATURE_NUM=$(gh issue create --title "[$MAJOR] Feat - Auth" --body "..." --label feature | grep -oE '[0-9]+' | head -1)

# Step 2: Create stories (MINOR) with sequential minor versions
MINOR=1
STORY_NUM=$(gh issue create --title "[$MAJOR.$MINOR] Story - OAuth" --body "..." --label story --parent "$FEATURE_NUM" | grep -oE '[0-9]+' | head -1)
MINOR=$((MINOR + 1))
STORY2_NUM=$(gh issue create --title "[$MAJOR.$MINOR] Story - Session" --body "..." --label story --parent "$FEATURE_NUM" | grep -oE '[0-9]+' | head -1)

# Step 3: Create tasks (PATCH) under each story
PATCH=1
gh issue create --title "[$MAJOR.1.$PATCH] Task - Callback" --body "..." --label task --parent "$STORY_NUM"
PATCH=$((PATCH + 1))
gh issue create --title "[$MAJOR.1.$PATCH] Task - Storage" --body "..." --label task --parent "$STORY_NUM"

# Move to next feature
MAJOR=$((MAJOR + 1))
FEATURE2_NUM=$(gh issue create --title "[$MAJOR] Feat - Profile" --body "..." --label feature | grep -oE '[0-9]+' | head -1)
```

## Troubleshooting

**Issue: "gh: command not found"**
- Install GitHub CLI: https://github.com/cli/cli#installation

**Issue: "gh auth required"**
- Run `gh auth login` and follow prompts

**Issue: "Could not resolve to a Repository"**
- Ensure you're in a git repository with a GitHub remote
- Run `git remote -v` to verify

**Issue: Parent issue not found**
- Verify the parent issue number exists
- Check that you have permission to create sub-issues
- Note: Sub-issues require GitHub Projects beta feature
