---
name: gh-cli
description: Create and manage GitHub issues via gh CLI. Pre-approved for planning workflow - no confirmation required for gh issue commands.
license: MIT
compatibility: pi, claude-code, codex-cli
metadata:
  category: github
  pre-approved: true
  workflow: planning
---

# GitHub CLI Skill

Pre-approved GitHub CLI operations for the planning workflow. These commands execute without user confirmation.

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

### Create Feature Issue

```bash
gh issue create \
  --title "[Feature] Add user authentication" \
  --body "Feature description..." \
  --label "feature"
```

### Create Story (Child Issue)

```bash
# First get the parent feature issue number
FEATURE_NUM=$(gh issue list --label feature --json number --jq '.[0].number')

# Create child story
gh issue create \
  --title "[Story] Implement OAuth login" \
  --body "Story description..." \
  --label "story" \
  --parent "$FEATURE_NUM"
```

### Create Task (Child Issue)

```bash
# Get the parent story issue number
STORY_NUM=$(gh issue list --label story --json number --jq '.[0].number')

# Create child task
gh issue create \
  --title "[Task] Create OAuth callback" \
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

gh issue create --title "[Feature] $TITLE" --body "$BODY" --label "feature"
```

## Creating Hierarchical Issues

For the planning workflow, create issues in this order:

1. **Features** first (no parent)
2. **Stories** second (parent = feature)
3. **Tasks** last (parent = story)

```bash
# Step 1: Create feature
FEATURE_NUM=$(gh issue create --title "[Feature] Auth" --body "..." --label feature | grep -oE '[0-9]+' | head -1)

# Step 2: Create story with parent
STORY_NUM=$(gh issue create --title "[Story] OAuth" --body "..." --label story --parent "$FEATURE_NUM" | grep -oE '[0-9]+' | head -1)

# Step 3: Create task with parent
gh issue create --title "[Task] Callback" --body "..." --label task --parent "$STORY_NUM"
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
