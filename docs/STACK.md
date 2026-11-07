# Stack decision (lean on purpose)

v1 failed from too much stuff. Use only what is listed under "Use". Do not add any tool from "Parked" or any tool not listed without asking the owner first. Revisit this file when a real need appears.

## Use now
- **Languages:** Python, SQL, a little Bash.
- **Processing:** Databricks, PySpark, Pandas (small local analysis and ML).
- **Storage:** Cloudflare R2 (raw landing, Parquet as published), Delta Lake in Databricks.
- **Governance:** Unity Catalog (built into Databricks).
- **Modeling:** Kimball style (fact tables and dimensions) for gold: a player-game fact plus player, team and date dimensions.
- **Orchestration:** Databricks Jobs, plus GitHub Actions for the daily file copy.
- **Version control and CI:** Git, GitHub Actions.
- **Data quality:** hand-written checks first (row counts, key uniqueness, NULLs, minutes-based "played" rule from `docs/spike-findings.md`).
- **Monitoring:** a health table and a failure alert; MLflow for models.

## Soon (add when the step needs it)
- **dbt** for tested, documented gold SQL (check Free Edition compatibility first).
- **dbt tests** for data quality, before any separate quality tool.
- **Docker**, when the app moves off Databricks Apps.
- **Databricks Asset Bundles**, to deploy jobs as code.

## Later, in `docs/LEARNING.md`
- A vector store (RAG, embeddings) and NetworkX. A graph database only for a time-boxed GraphRAG experiment.

## Parked (do not add without asking)
- **Streaming:** Kafka, Flink, Spark Streaming, Kinesis, Pulsar. Our data arrives in daily batches. Revisit only for live in-game or odds feeds.
- **Orchestrators:** Airflow, Prefect, Dagster, Mage, Step Functions. Dagster is the one to try later as a time-boxed learning side experiment.
- **Warehouses and table formats:** Snowflake, BigQuery, Redshift, Hive, Iceberg.
- **Ingestion platforms:** Airbyte, Fivetran, Stitch, Debezium, Glue. A small Python script copies files from GitHub releases to R2.
- **Catalogs:** Atlas, Collibra, DataHub, Amundsen, Alation, OpenMetadata.
- **Heavy observability:** Grafana, Prometheus, Datadog, ELK, OpenTelemetry. Quality tools: Great Expectations, Monte Carlo, Soda, Deequ, Griffin.
- **Infrastructure:** Kubernetes, Terraform, Jenkins. Other clouds: AWS, GCP, Azure (until we pick a host for the app).
- **Modeling tools:** Data Vault, SQLMesh, Erwin. Languages: Scala, Java.

## Attribution (required by data licenses)
Credit `sportsdataverse/sportsdataverse-data` (MIT) and `sportsdataverse/hoopR-nba-stats-data` (CC BY 4.0) in the README and the app footer.
