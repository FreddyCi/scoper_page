/** DuckDB DDL — PRD §5.3, plan §DuckDB schema */
export const DUCKDB_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS documents (
    doc_id VARCHAR PRIMARY KEY,
    filename VARCHAR NOT NULL,
    mime VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'unknown',
    uploaded_at VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS blocks (
    block_id VARCHAR PRIMARY KEY,
    doc_id VARCHAR NOT NULL,
    page_num INTEGER,
    section_path VARCHAR,
    text VARCHAR NOT NULL,
    x DOUBLE,
    y DOUBLE,
    width DOUBLE,
    height DOUBLE
  )`,
  `CREATE TABLE IF NOT EXISTS results_profiles (
    profile_id VARCHAR PRIMARY KEY,
    mode VARCHAR NOT NULL,
    doc_id VARCHAR NOT NULL,
    verdict VARCHAR NOT NULL,
    subject_json VARCHAR NOT NULL,
    summary VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS profile_criteria (
    profile_id VARCHAR NOT NULL,
    criterion_id VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    label VARCHAR NOT NULL,
    detail VARCHAR,
    block_id VARCHAR,
    PRIMARY KEY (profile_id, criterion_id)
  )`,
  `CREATE TABLE IF NOT EXISTS scope_flags (
    flag_id VARCHAR PRIMARY KEY,
    baseline_doc_id VARCHAR NOT NULL,
    candidate_doc_id VARCHAR NOT NULL,
    flag_type VARCHAR NOT NULL,
    severity VARCHAR NOT NULL,
    summary VARCHAR NOT NULL,
    block_ids VARCHAR
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    comment_id VARCHAR PRIMARY KEY,
    block_id VARCHAR NOT NULL,
    text VARCHAR NOT NULL,
    created_at VARCHAR NOT NULL
  )`,
] as const
