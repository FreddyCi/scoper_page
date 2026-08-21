/** DuckDB DDL — PRD §5.3, plan §DuckDB schema */

const RFP_REQUIREMENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS rfp_requirements (
    requirement_id VARCHAR PRIMARY KEY,
    doc_id VARCHAR NOT NULL,
    label VARCHAR NOT NULL,
    category VARCHAR,
    block_id VARCHAR,
    page_num INTEGER,
    excerpt VARCHAR,
    created_at VARCHAR NOT NULL
  )`

const RFP_REQUIREMENT_SCORES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS rfp_requirement_scores (
    requirement_id VARCHAR NOT NULL,
    profile_id VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    note VARCHAR,
    source VARCHAR,
    PRIMARY KEY (requirement_id, profile_id)
  )`

const RFP_SOLICITATION_META_TABLE_SQL = `CREATE TABLE IF NOT EXISTS rfp_solicitation_meta (
    doc_id VARCHAR PRIMARY KEY,
    due_json VARCHAR,
    questions_due_json VARCHAR,
    page_limit_json VARCHAR,
    volumes_json VARCHAR NOT NULL,
    block_ids_json VARCHAR NOT NULL,
    summary VARCHAR NOT NULL,
    updated_at VARCHAR NOT NULL
  )`

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
    author_initials VARCHAR NOT NULL DEFAULT '?',
    created_at VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pdf_drawing_annotations (
    annotation_id VARCHAR PRIMARY KEY,
    doc_id VARCHAR NOT NULL,
    page_num INTEGER NOT NULL,
    tool VARCHAR NOT NULL,
    color VARCHAR NOT NULL,
    stroke_width DOUBLE,
    opacity DOUBLE,
    geometry_json VARCHAR NOT NULL,
    text_body VARCHAR,
    voice_note VARCHAR,
    author_initials VARCHAR NOT NULL DEFAULT '?',
    created_at VARCHAR NOT NULL,
    updated_at VARCHAR
  )`,
  `CREATE TABLE IF NOT EXISTS proposal_profiles (
    profile_id VARCHAR PRIMARY KEY,
    rfp_doc_id VARCHAR NOT NULL,
    summary VARCHAR NOT NULL,
    built_at VARCHAR NOT NULL,
    package_kind VARCHAR NOT NULL,
    package_warnings_json VARCHAR NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS proposal_volumes (
    profile_id VARCHAR NOT NULL,
    volume_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    requirement_summary VARCHAR NOT NULL,
    solicitation_refs_json VARCHAR,
    body_markdown VARCHAR,
    status VARCHAR NOT NULL,
    error_message VARCHAR,
    edited INTEGER NOT NULL DEFAULT 0,
    edited_at VARCHAR,
    generation_progress_json VARCHAR,
    analysis_refs_json VARCHAR,
    PRIMARY KEY (profile_id, volume_id)
  )`,
  `CREATE TABLE IF NOT EXISTS proposal_volume_sections (
    profile_id VARCHAR NOT NULL,
    volume_id VARCHAR NOT NULL,
    section_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    find_clause_query VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    body_markdown VARCHAR,
    error_message VARCHAR,
    edited INTEGER NOT NULL DEFAULT 0,
    edited_at VARCHAR,
    citations_json VARCHAR,
    PRIMARY KEY (profile_id, volume_id, section_id)
  )`,
  RFP_REQUIREMENTS_TABLE_SQL,
  RFP_REQUIREMENT_SCORES_TABLE_SQL,
  RFP_SOLICITATION_META_TABLE_SQL,
] as const

export const RFP_REQUIREMENT_COLUMNS = [
  'requirement_id',
  'doc_id',
  'label',
  'category',
  'block_id',
  'page_num',
  'excerpt',
  'created_at',
] as const

export const RFP_REQUIREMENT_SCORE_COLUMNS = [
  'requirement_id',
  'profile_id',
  'status',
  'note',
  'source',
] as const

export const RFP_SOLICITATION_META_COLUMNS = [
  'doc_id',
  'due_json',
  'questions_due_json',
  'page_limit_json',
  'volumes_json',
  'block_ids_json',
  'summary',
  'updated_at',
] as const

/** Applied after CREATE TABLE — DuckDB ADD COLUMN cannot use NOT NULL/DEFAULT */
export const DUCKDB_MIGRATION_STATEMENTS = [
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_initials VARCHAR`,
  `UPDATE comments SET author_initials = '?' WHERE author_initials IS NULL`,
  `ALTER TABLE pdf_drawing_annotations ADD COLUMN IF NOT EXISTS voice_note VARCHAR`,
  RFP_REQUIREMENTS_TABLE_SQL,
  RFP_REQUIREMENT_SCORES_TABLE_SQL,
  RFP_SOLICITATION_META_TABLE_SQL,
] as const
