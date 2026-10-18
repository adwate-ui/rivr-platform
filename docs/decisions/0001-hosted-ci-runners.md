# 0001 CI runs on GitHub-hosted runners

Date: 18 Oct 2026

The guide and `docs/engineering/stack.md` planned a self-hosted Actions runner in WSL. The repository is public (`adwate-ui/rivr-platform`), and GitHub advises against self-hosted runners on public repositories: a pull request from a fork can try to run code on the runner's machine.

Decision: every workflow runs on GitHub-hosted `ubuntu-latest` runners, which are free and unlimited for public repositories and start clean on every run. Docker is available there for the local Supabase stack, pgTAP and the Playwright container.

Consequences: no runner to register or keep running, and nothing runs on a developer machine. The "forks never run on the self-hosted runner" check no longer applies; workflows that use secrets still skip pull requests from forks, which receive no secrets anyway.
