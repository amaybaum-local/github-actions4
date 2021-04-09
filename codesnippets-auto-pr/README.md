# Auto-PR When Code Snippets Updated in ADP

This action is designed to automatically raise a PR to the vonage API dashboard onboarding app when an update to the code snippets in ADP is made

## How to use

```yaml
name: auto-pr-snippets
on: 
  push:
    branch: [main]
jobs:
  build:
    name: Update Snippets in dashboard
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
        with: 
          repository: developer-onboarding
      - name: Update Dashboard Snippets
        uses: nexmo/github-actions/codesnippets-auto-pr@auto-pr-dashboard-snippets
        env:
          GH_ADMIN_TOKEN: ${{ secrets.GH_SECRET }}
          PR_ACTIVE_BRANCH: main
          PR_BRANCH_NAME: automated-snippets-update
          PR_TARGET_BRANCH: develop
          PR_TARGET_ORG: nexmo
          PR_TARGET_REPO: developer-onboarding
          PR_TITLE: Code snippets update
```

## Configuration

- `GH_ADMIN_TOKEN` - a custom GitHub token to use to make API requests. The default `GITHUB_TOKEN` provided is scoped to the current repo, and we want to change other repos
- `PR_TARGET_ORG` - the name of the organization that owns the repo that a PR will be created on
- `PR_TARGET_REPO` - the name of the repo that a PR will be created on
- `PR_BRANCH_NAME` - the name of the branch to create when updating code snippets
- `PR_TITLE` - the title to use for the PR. This will also be your commit message
- `PR_TARGET_BRANCH` - the branch that we want to merge our PR in to
- `PR_ACTIVE_BRANCH` - check if the push was to this branch before continuing (usually `master`)

## How it works

### In the repo that uses this action

- Someone commits to the default branch in a repo that uses this action

### In `PR_TARGET_REPO`

- Create `PR_BRANCH_NAME` if it does not already exist
- Create a commit with the new code snippets, and updated snap-sot  
- Create a PR named `PR_TITLE` if there is not currently a PR open for `PR_BRANCH_NAME`