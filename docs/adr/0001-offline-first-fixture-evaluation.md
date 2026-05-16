# Offline-first fixture evaluation

Ghostbench's MVP evaluates saved local fixture responses instead of calling live model or platform APIs. This keeps runs deterministic, inspectable, and usable without credentials while leaving room for future provider adapters once the core eval case, repo context, judgment, and report flow is proven.
