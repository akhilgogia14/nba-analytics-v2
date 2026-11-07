# AI engineering learning track (the owner's side goal)

The owner wants to learn RAG, MCP and building with an LLM, with solid examples for AI engineering work. This runs alongside the main build and starts only after simple gold tables exist. Do not let it slow the data pipeline.

Suggested order, each piece small and explained in teaching mode:
1. **LLM with tools.** Let a model answer a question by calling a function that queries a gold table (for example "what are this player's typical minutes this season?"). Learn: tool calling, prompts, structured output.
2. **An MCP server over the gold tables.** Expose a few read-only tools (player summary, game log, peer cohort) so any MCP-capable assistant can query our data. Learn: what MCP is, how servers and clients talk, permissions.
3. **RAG over documents we own.** Use our own writing as the corpus: methodology notes, the v1 retrospective, back-test reports, a stat glossary, release notes. Learn: chunking, embeddings, retrieval, citations. Avoid third-party text we do not have rights to.
4. **Evaluation.** Write a small set of questions with known answers and score the system. Learn: why evals matter more than demos.
5. **Portfolio write-up.** One short page per piece: what it does, what was hard, what the evals showed.

The prediction models in PLAN.md Phase 8 are a separate track (classical ML with MLflow on Databricks). Both belong in the portfolio.

## Vector database (later, in the AI track)
- **RAG over our own writing.** Corpus: methodology notes, the v1 retrospective, back-test reports, the stat glossary, release notes. A corpus this small does not need a dedicated vector database; the goal is learning chunking, embeddings, retrieval and citations, so any simple store works.
- **Learned player embeddings for peer cohorts.** If a neural model (rung 7 in `docs/MODELING.md`) learns a vector per player, "players like Maxey" becomes a nearest-neighbor lookup. For plain stat tables, k-nearest-neighbors on standardized features is enough and needs no vector database. Use a vector store only when the vectors are learned.
- **Where to run it.** Compare local options (pgvector, DuckDB with a vector extension, LanceDB, Chroma) and Databricks vector search before choosing. Verify current details first. Databricks Free Edition caps concurrent serving and vector search endpoints at two, shared with model serving.
- **When:** after simple gold tables exist. Does not change the core pipeline.

## Graph database (parked)
- The data has network structure (teammates in lineups, assist networks, matchups, player movement), but most of those questions are SQL joins or a few lines of NetworkX on tables we already have. A dedicated graph database adds cost and upkeep for little gain, which is v1's lesson about breadth.
- **Experiment, after lineups are in silver:** start with NetworkX (teammate and assist networks, centrality).
- **Optional time-boxed GraphRAG project:** an LLM answers questions over a small knowledge graph of players, teams, coaches and seasons. Only then consider a real graph database.
- Neither item changes the core pipeline.
