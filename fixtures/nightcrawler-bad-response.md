This should be implemented as a RAG system. Put all GCS extracts into a vector database, embed the nursing model repo, and use semantic search to decide what files to update.

The agent can ask the vector DB for relevant templates and then automatically rewrite the repo. I would generate a PR after the rewrite, but the main thing is retrieval quality and chunking strategy.

The cache probably does not need much special handling because vectors can be refreshed whenever the source data changes. Stable identifiers and deterministic diffs are less important than getting good embeddings.
