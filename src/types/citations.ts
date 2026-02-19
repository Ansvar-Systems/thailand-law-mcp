export type CitationFormat = 'full_th' | 'full_en' | 'short' | 'pinpoint';

export interface ParsedCitation {
  valid: boolean;
  type: 'statute' | 'royal_decree' | 'unknown';
  title?: string;
  title_en?: string;
  abbreviation?: string;
  be_year?: number;
  ce_year?: number;
  section?: string;
  subsection?: string;
  paragraph?: string;
  error?: string;
}

export interface ValidationResult {
  citation: ParsedCitation;
  document_exists: boolean;
  provision_exists: boolean;
  document_title?: string;
  status?: string;
  warnings: string[];
}
