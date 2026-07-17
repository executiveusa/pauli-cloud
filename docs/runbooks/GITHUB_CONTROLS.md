# GitHub Enterprise Controls Runbook

The repository code defines CI, security analysis, release gates, CODEOWNERS, and review templates. GitHub repository settings must also be configured because source files cannot enforce these controls alone.

## Main branch protection

Protect `main` with:

- require a pull request before merging;
- require at least one approving review;
- require review from CODEOWNERS;
- dismiss stale approvals when new commits are pushed;
- require conversation resolution;
- require signed commits when organizational policy supports it;
- require linear history or squash-only merges;
- block force pushes and deletion;
- include administrators;
- require branches to be up to date before merging.

Required status checks:

- `Node 20`
- `Node 22`
- `Container build and smoke`
- `Analyze JavaScript`
- `review`

Use the exact check names visible after PR #4 finishes because GitHub may prefix workflow and job names.

## Production environment

Create a GitHub environment named `production`:

- add Bambu/executiveusa as a required reviewer;
- prevent self-review when another qualified reviewer becomes available;
- restrict deployments to protected tags or `main`;
- store `NPM_TOKEN` as an environment secret;
- configure wait time when desired;
- do not expose production secrets to pull-request workflows.

The release workflow additionally requires the exact input:

```text
APPROVE PRODUCTION
```

Both controls must pass.

## Security settings

Enable:

- private vulnerability reporting;
- dependency graph;
- Dependabot alerts;
- Dependabot security updates;
- secret scanning;
- push protection;
- CodeQL default or advanced setup without duplicate workflows;
- branch ruleset bypass limited to emergency administrators.

## Merge strategy

Recommended:

- squash merge enabled;
- merge commits disabled after bootstrap history is stable;
- rebase merge optional;
- automatically delete head branches after merge;
- auto-merge disabled for production/security changes.

## Verification

After configuration:

1. open a test PR;
2. confirm direct push to `main` is rejected;
3. confirm CODEOWNER review is required;
4. confirm all required checks appear;
5. dispatch the release workflow with an incorrect approval and verify it does not run;
6. dispatch with the correct phrase and verify the production environment still requests review;
7. cancel the test before publishing if credentials are not intended for use.

Record screenshots or exported ruleset JSON in the release evidence. Never place secret values in that evidence.
