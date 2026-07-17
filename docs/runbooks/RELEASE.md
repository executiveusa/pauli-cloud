# Release Runbook

## Version policy

Pauli Cloud uses semantic versioning.

- patch: backward-compatible fixes;
- minor: backward-compatible commands, adapters, or schemas;
- major: incompatible CLI, state, policy, or API changes.

Schema versions are independent and must not change silently with the package version.

## Release candidate gate

- branch is not protected;
- draft PR contains an implementation-truth ledger;
- Node 20 and 22 matrix passes;
- every source module has at least 80% line coverage;
- secret scan passes;
- CodeQL passes;
- dependency review passes;
- package dry-run contains expected files only;
- container build and authenticated API smoke pass;
- prompt registry verifies;
- doctor and readiness pass;
- rollback and backup drills are documented;
- Guardian review has no unresolved high-severity finding.

## Production release

Production release is manual and requires:

1. the exact `APPROVE PRODUCTION` workflow input;
2. approval from the protected GitHub `production` environment;
3. an `NPM_TOKEN` stored as an environment secret;
4. the reviewed branch SHA.

The release workflow publishes:

- npm package with provenance;
- GHCR container tagged with commit SHA and `latest`;
- container provenance and SBOM.

## Verification

After publishing:

```bash
npm view pauli-cloud version
npm install --global pauli-cloud@<version>
pauli-cloud --help
docker pull ghcr.io/executiveusa/pauli-cloud:<sha>
```

Initialize a temporary repository, compile generic policy, run doctor, verify prompts, then uninstall. Verify the container health and unauthorized/authorized API behavior.

## Rollback

- npm versions cannot be overwritten; deprecate the affected version and publish a corrected patch;
- restore the previous container tag in deployment configuration;
- revoke the release token if compromise is suspected;
- preserve the failed package, workflow logs, and image digest for analysis;
- require a new production approval for the corrective release.
