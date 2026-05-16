# GitHub repos resolve to a local cache before scanning

Ghostbench supports GitHub repository URLs by cloning or updating them with `git` into the user's cache directory outside the Ghostbench project, then scanning the resolved checkout with the same bounded repo-context scanner used for local paths. This keeps remote acquisition separate from judgment logic, preserves support for existing local `repoPath` cases, and records the requested URL/ref plus resolved commit in reports.
