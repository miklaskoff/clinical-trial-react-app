#!/usr/bin/env node
/**
 * Generate Output Schemas Documentation
 * 
 * This script auto-generates docs/output_schemas.md from server/config/output-schemas.json
 * 
 * Usage:
 *   npm run docs:schemas
 *   node scripts/generate-schema-docs.js
 * 
 * @see docs/output_schemas.md (generated output)
 * @see server/config/output-schemas.json (source of truth)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.join(__dirname, '../server/config/output-schemas.json');
const OUTPUT_PATH = path.join(__dirname, '../docs/output_schemas.md');

function generateDocs() {
  console.log('📄 Generating output_schemas.md from output-schemas.json...');
  
  // Read JSON schema
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
  
  const now = new Date().toISOString().split('T')[0];
  
  let md = `# Output Schemas Reference

> **Version**: ${schema.version}  
> **Last Generated**: ${now}  
> **Source**: [output-schemas.json](../server/config/output-schemas.json)  
> **⚠️ AUTO-GENERATED** — Do not edit directly! Run \`npm run docs:schemas\` to regenerate.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Overview](#overview)
- [Common Fields](#common-fields)
- [Cluster Schemas](#cluster-schemas)
- [Field Types](#field-types)
- [Defaults](#defaults)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Overview

This document describes the output schema for each cluster type in the clinical trial criteria parser.

**Total Clusters**: ${Object.keys(schema.clusters).length}

| Cluster | Description |
|---------|-------------|
| AGE | Age-based eligibility criteria |
| BMI | Weight and body mass index |
| SEV | Severity scores and measurements |
| AAO | Affected area and organs |
| DIT | Disease type and variants |
| BIO | Biomarkers |
| CMB | Comorbid conditions and risk factors |
| DD | Disease duration |
| AIC | Active infection history criteria |
| PTH | Psoriasis treatment history |

---

## Common Fields

All clusters share these common fields:

### Required Fields

${schema.commonFields.required.map(f => `- \`${f}\` — ${getFieldDescription(f)}`).join('\n')}

### Optional Fields

${schema.commonFields.optional.map(f => `- \`${f}\` — ${getFieldDescription(f)}`).join('\n')}

---

## Cluster Schemas

`;

  // Generate each cluster section
  for (const [clusterName, clusterSchema] of Object.entries(schema.clusters)) {
    md += `### CLUSTER_${clusterName}

**Required Fields:**
${clusterSchema.required.map(f => `- \`${f}\``).join('\n')}

**Optional Fields:**
${clusterSchema.optional.map(f => `- \`${f}\``).join('\n')}

**Example:**
\`\`\`json
{
  "id": "${clusterName}_001",
  "nct_id": "NCT12345678",
  "raw_text": "Example ${clusterName} criterion",
  "CRITERION_TYPE": "inclusion",
  "EXCLUSION_STRENGTH": "mandatory_include",
  "confidence": 1.0,
  "parsing_status": "complete"${getClusterSpecificFields(clusterName)}
}
\`\`\`

---

`;
  }

  md += `## Field Types

### Basic Types

| Field | Type | Description |
|-------|------|-------------|
${Object.entries(schema.fieldTypes)
  .filter(([_, v]) => typeof v === 'string')
  .map(([k, v]) => `| \`${k}\` | ${v} | ${getFieldDescription(k)} |`)
  .join('\n')}

### Enum Types

| Field | Allowed Values |
|-------|----------------|
${Object.entries(schema.fieldTypes)
  .filter(([_, v]) => typeof v === 'object' && v.enum)
  .map(([k, v]) => `| \`${k}\` | ${v.enum.map(e => `\`${e}\``).join(', ')} |`)
  .join('\n')}

### Complex Types

#### TIMEFRAME

\`\`\`json
{
  "relation": "within",
  "amount": 6,
  "unit": "months",
  "reference": "screening"
}
\`\`\`

#### TREATMENT_HISTORY

\`\`\`json
[
  {
    "treatment": "adalimumab",
    "treatment_class": "TNF_INHIBITOR",
    "response": "inadequate",
    "timing": "prior to screening",
    "confidence": 0.95
  }
]
\`\`\`

#### NEGATION_DETECTED

\`\`\`json
{
  "is_negated": true,
  "negated_term": "no history of",
  "context": "exclusion criterion",
  "negation_type": "absence",
  "interpretation": "patient must NOT have condition",
  "affected_fields": ["CONDITION_TYPE"]
}
\`\`\`

#### NESTED_CONDITION

\`\`\`json
{
  "main_condition": { "type": "cardiac" },
  "nested_operator": ">=",
  "nested_count": 2,
  "nested_items": [
    { "type": "CONDITION_TYPE", "value": "heart failure" },
    { "type": "CONDITION_TYPE", "value": "arrhythmia" }
  ],
  "nested_logical_operator": "OR"
}
\`\`\`

---

## Defaults

When a field is not specified in parsed output, these defaults apply:

| Field | Default Value |
|-------|---------------|
${Object.entries(schema.defaults).map(([k, v]) => `| \`${k}\` | \`${JSON.stringify(v)}\` |`).join('\n')}

---

## Nested Item Types

Valid types for \`NESTED_CONDITION.nested_items\`:

${schema.validNestedItemTypes.map(t => `- \`${t}\``).join('\n')}

---

## Treatment History Subfields

Valid subfields for \`TREATMENT_HISTORY\` entries:

${schema.validTreatmentHistorySubfields.map(f => `- \`${f}\``).join('\n')}

---

## Negation Detected Fields

Valid fields for \`NEGATION_DETECTED\`:

${schema.validNegationDetectedFields.map(f => `- \`${f}\``).join('\n')}

---

> **See Also:**  
> - [Architecture Guide](ARCHITECTURE_AND_MATCHING_GUIDE.md) — System design  
> - [FIELD_CATALOG_v2.1.md](../server/config/FIELD_CATALOG_v2.1.md) — Parsing rules  
> - [output-schemas.json](../server/config/output-schemas.json) — Source JSON
`;

  fs.writeFileSync(OUTPUT_PATH, md);
  console.log(`✅ Generated: ${OUTPUT_PATH}`);
  console.log(`   Version: ${schema.version}`);
  console.log(`   Clusters: ${Object.keys(schema.clusters).length}`);
}

function getFieldDescription(field) {
  const descriptions = {
    'id': 'Unique criterion identifier',
    'nct_id': 'ClinicalTrials.gov identifier',
    'raw_text': 'Original criterion text',
    'CRITERION_TYPE': 'inclusion or exclusion',
    'EXCLUSION_STRENGTH': 'How strictly to apply criterion',
    'confidence': 'Parser confidence score (0-1)',
    'parsing_status': 'complete, pending_admin_review, or error',
    '_thought_process': 'AI reasoning explanation',
    'LOGICAL_OPERATOR': 'AND/OR for compound criteria',
    'NESTED_CONDITION': 'Complex nested conditions',
    'unfamiliar_term_flag': 'Contains unknown medical term',
    'AMBIGUITY_FLAG': 'Criterion is ambiguous',
    'REQUIRES_CLINICAL_JUDGMENT': 'Needs expert review',
    'SUBJECTIVE_ESTIMATE': 'Contains subjective assessment',
    'original': 'Original source data',
    'TREATMENT_HISTORY': 'Prior treatment information'
  };
  return descriptions[field] || '';
}

function getClusterSpecificFields(cluster) {
  const examples = {
    'AGE': `,
  "AGE_MIN": 18,
  "AGE_MAX": 75,
  "AGE_UNIT": "years"`,
    'BMI': `,
  "BMI_MIN": 18.5,
  "BMI_MAX": 35.0`,
    'SEV': `,
  "SEVERITY": ["moderate", "severe"],
  "MEASUREMENTS": [{ "parameter": "PASI", "min": 10 }]`,
    'AAO': `,
  "ANATOMICAL_LOCATION": ["scalp", "nails"]`,
    'DIT': `,
  "DISEASE_VARIANT": ["plaque psoriasis"]`,
    'BIO': `,
  "MEASUREMENTS": [{ "parameter": "CRP", "max": 10, "unit": "mg/L" }]`,
    'CMB': `,
  "CONDITION_TYPE": ["cardiovascular disease"],
  "TIMEFRAME": { "relation": "within", "amount": 5, "unit": "years" }`,
    'DD': `,
  "TIMEFRAME": { "relation": ">=", "amount": 6, "unit": "months" }`,
    'AIC': `,
  "CONDITION_TYPE": ["active infection"],
  "TIMEFRAME": { "relation": "within", "amount": 4, "unit": "weeks" }`,
    'PTH': `,
  "TREATMENT_HISTORY": [{ "treatment": "methotrexate", "response": "inadequate" }]`
  };
  return examples[cluster] || '';
}

// Run
generateDocs();
