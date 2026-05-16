# Explicit execution policy

Ghostbench will not automatically perform full command execution for evaluated repositories. Execution is governed by an explicit policy so app owners can choose between static inspection, low-risk checks, sandboxed execution, and trusted in-repo execution; this matters because vibe-coded repositories may contain arbitrary install scripts, package scripts, or development servers.
