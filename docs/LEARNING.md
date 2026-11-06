# AI engineering learning track (the owner's side goal)

The owner wants to learn RAG, MCP and building with an LLM, with solid examples for AI engineering work. This runs alongside the main build and starts only after simple gold tables exist. Do not let it slow the data pipeline.

Suggested order, each piece small and explained in teaching mode:
1. **LLM with tools.** Let a model answer a question by calling a function that queries a gold table (for example "what are this player's typical minutes this season?"). Learn: tool calling, prompts, structured output.
2. **An MCP server over the gold tables.** Expose a few read-only tools (player summary, game log, peer cohort) so any MCP-capable assistant can query our data. Learn: what MCP is, how servers and clients talk, permissions.
3. **RAG over documents we own.** Use our own writing as the corpus: methodology notes, the v1 retrospective, back-test reports, a stat glossary, release notes. Learn: chunking, embeddings, retrieval, citations. Avoid third-party text we do not have rights to.
4. **Evaluation.** Write a small set of questions with known answers and score the system. Learn: why evals matter more than demos.
5. **Portfolio write-up.** One short page per piece: what it does, what was hard, what the evals showed.

The prediction models in PLAN.md Phase 8 are a separate track (classical ML with MLflow on Databricks). Both belong in the portfolio.
