/**
 * In-memory test database for Thailand Law MCP unit tests.
 *
 * Creates a minimal SQLite database with sample Thai legislation data
 * for use in unit tests without needing the full production database.
 */

import Database from '@ansvar/mcp-sqlite';

const SCHEMA = `
CREATE TABLE legal_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  short_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_force',
  be_year INTEGER,
  ce_year INTEGER,
  issued_date TEXT,
  in_force_date TEXT,
  url TEXT,
  description TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE TABLE legal_provisions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_ref TEXT NOT NULL,
  chapter TEXT,
  section TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  metadata TEXT,
  UNIQUE(document_id, provision_ref)
);

CREATE INDEX idx_provisions_doc ON legal_provisions(document_id);

CREATE VIRTUAL TABLE provisions_fts USING fts5(
  content, title,
  content='legal_provisions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER provisions_ai AFTER INSERT ON legal_provisions BEGIN
  INSERT INTO provisions_fts(rowid, content, title)
  VALUES (new.id, new.content, new.title);
END;

CREATE TABLE eu_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  year INTEGER NOT NULL,
  number INTEGER NOT NULL,
  community TEXT,
  celex_number TEXT,
  title TEXT,
  title_en TEXT,
  short_name TEXT,
  adoption_date TEXT,
  entry_into_force_date TEXT,
  in_force BOOLEAN DEFAULT 1,
  amended_by TEXT,
  repeals TEXT,
  url_eur_lex TEXT,
  description TEXT,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE eu_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_id INTEGER REFERENCES legal_provisions(id),
  eu_document_id TEXT NOT NULL REFERENCES eu_documents(id),
  eu_article TEXT,
  reference_type TEXT NOT NULL,
  reference_context TEXT,
  full_citation TEXT,
  is_primary_implementation BOOLEAN DEFAULT 0,
  implementation_status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_verified TEXT,
  UNIQUE(source_id, eu_document_id, eu_article)
);

CREATE TABLE db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const SEED_DATA = `
INSERT INTO db_metadata (key, value) VALUES ('tier', 'free');
INSERT INTO db_metadata (key, value) VALUES ('schema_version', '2');
INSERT INTO db_metadata (key, value) VALUES ('built_at', '2026-02-19T00:00:00Z');
INSERT INTO db_metadata (key, value) VALUES ('jurisdiction', 'TH');

INSERT INTO legal_documents (id, type, title, title_en, short_name, status, be_year, ce_year, issued_date, url)
VALUES (
  'pdpa-be2562', 'statute',
  'พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
  'Personal Data Protection Act B.E. 2562 (2019)',
  'PDPA 2019',
  'in_force', 2562, 2019, '2019-05-27',
  'https://www.krisdika.go.th/librarian/getfile?sysid=793775&fid=1&subfid=0'
);

INSERT INTO legal_documents (id, type, title, title_en, short_name, status, be_year, ce_year, issued_date, url)
VALUES (
  'cca-be2550', 'statute',
  'พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ พ.ศ. 2550',
  'Computer Crime Act B.E. 2550 (2007)',
  'CCA 2007',
  'amended', 2550, 2007, '2007-06-18',
  'https://www.krisdika.go.th/librarian/getfile?sysid=564700&fid=1&subfid=0'
);

INSERT INTO legal_documents (id, type, title, title_en, short_name, status, be_year, ce_year, issued_date, url)
VALUES (
  'csa-be2562', 'statute',
  'พระราชบัญญัติการรักษาความมั่นคงปลอดภัยไซเบอร์ พ.ศ. 2562',
  'Cybersecurity Act B.E. 2562 (2019)',
  'CSA 2019',
  'in_force', 2562, 2019, '2019-05-27',
  'https://www.krisdika.go.th/librarian/getfile?sysid=793776&fid=1&subfid=0'
);

INSERT INTO legal_documents (id, type, title, title_en, short_name, status, be_year, ce_year, issued_date, url)
VALUES (
  'eta-be2544', 'statute',
  'พระราชบัญญัติว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ พ.ศ. 2544',
  'Electronic Transactions Act B.E. 2544 (2001)',
  'ETA 2001',
  'in_force', 2544, 2001, '2001-12-02',
  'https://www.krisdika.go.th/librarian/getfile?sysid=449138&fid=1&subfid=0'
);

INSERT INTO legal_provisions (document_id, provision_ref, section, title, content, language)
VALUES ('pdpa-be2562', 's3', '3', 'Definitions',
  'Section 3. In this Act: "personal data" means any information relating to a person which enables the identification of such person, whether directly or indirectly, but not including the information of deceased persons in particular; "data controller" means a person or legal entity having the power and duty to make decisions regarding the collection, use, or disclosure of personal data; "data processor" means a person or legal entity which operates in relation to the collection, use, or disclosure of personal data pursuant to the orders given by or on behalf of a data controller; "data subject" means a person who is identified by the personal data.',
  'en'
);

INSERT INTO legal_provisions (document_id, provision_ref, section, title, content, language)
VALUES ('pdpa-be2562', 's19', '19', 'Consent',
  'Section 19. A data controller shall not collect, use, or disclose personal data unless the data subject gives consent prior to or at the time of collection, use, or disclosure, except where this Act or other laws provide otherwise.',
  'en'
);

INSERT INTO legal_provisions (document_id, provision_ref, section, title, content, language)
VALUES ('cca-be2550', 's5', '5', 'Unauthorised Access',
  'Section 5. Any person who illegally accesses a computer system that has a specific security measure which is not intended for his or her use shall be liable to imprisonment for not more than six months or a fine of not more than ten thousand Baht, or both.',
  'en'
);

INSERT INTO legal_provisions (document_id, provision_ref, section, title, content, language)
VALUES ('csa-be2562', 's3', '3', 'Definitions',
  'Section 3. In this Act: "cybersecurity" means measures and actions for protecting the computer system, computer data, the computer data that relates to computer traffic, or other related data from threats; "critical information infrastructure" means a computer or a computer system of an organization relating to national security, public security, national economic security, or the infrastructure essential for the public interest.',
  'en'
);

INSERT INTO legal_provisions (document_id, provision_ref, section, title, content, language)
VALUES ('eta-be2544', 's2', '2', 'Commencement',
  'Section 2. This Act shall come into force after the period of one hundred and twenty days from the date of its publication in the Government Gazette.',
  'en'
);

INSERT INTO eu_documents (id, type, year, number, community, title, short_name, url_eur_lex, description)
VALUES (
  'regulation:2016/679', 'regulation', 2016, 679, 'EU',
  'General Data Protection Regulation (GDPR)',
  'GDPR',
  'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
  'EU regulation on the protection of natural persons with regard to the processing of personal data'
);

INSERT INTO eu_documents (id, type, year, number, community, title, short_name, url_eur_lex, description)
VALUES (
  'directive:2016/1148', 'directive', 2016, 1148, 'EU',
  'Directive on security of network and information systems (NIS Directive)',
  'NIS Directive',
  'https://eur-lex.europa.eu/eli/dir/2016/1148/oj',
  'EU directive concerning measures for a high common level of security of network and information systems'
);

INSERT INTO eu_references (source_type, source_id, document_id, provision_id, eu_document_id, eu_article, reference_type, reference_context, full_citation, is_primary_implementation, implementation_status, last_verified)
VALUES (
  'document', 'pdpa-be2562', 'pdpa-be2562', NULL, 'regulation:2016/679', NULL,
  'modeled_on',
  'Thailand PDPA was modeled on the EU GDPR. Core concepts including lawful bases, data subject rights, and DPO requirements are derived from GDPR.',
  'GDPR (regulation:2016/679)',
  1, 'complete', '2026-02-19T00:00:00Z'
);

INSERT INTO eu_references (source_type, source_id, document_id, provision_id, eu_document_id, eu_article, reference_type, reference_context, full_citation, is_primary_implementation, implementation_status, last_verified)
VALUES (
  'document', 'csa-be2562', 'csa-be2562', NULL, 'directive:2016/1148', NULL,
  'references',
  'Thailand Cybersecurity Act draws from international cybersecurity frameworks including the EU NIS Directive and ASEAN cybersecurity cooperation.',
  'NIS Directive (directive:2016/1148)',
  0, 'unknown', '2026-02-19T00:00:00Z'
);
`;

export function createTestDb(): InstanceType<typeof Database> {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  db.exec(SEED_DATA);
  return db;
}
