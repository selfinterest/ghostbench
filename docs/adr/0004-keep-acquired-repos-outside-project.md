# Keep acquired repos outside the Ghostbench project

Ghostbench may scan existing local repositories when a user supplies a `repoPath`, but any repository material Ghostbench later acquires, clones, caches, or creates must live outside the Ghostbench project directory. This keeps Ghostbench's source tree separate from evaluated repositories, avoids accidental commits of third-party or private code, and prevents target-repo files from bleeding into Ghostbench's own project context.
