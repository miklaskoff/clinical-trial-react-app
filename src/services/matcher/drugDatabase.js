/**
 * Drug classification database
 * @module services/matcher/drugDatabase
 */

/**
 * Drug aliases and classifications
 */
export const DRUG_DATABASE = {
  // TNF Inhibitors
  humira: {
    generic: 'adalimumab',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
    aliases: ['adalimumab'],
  },
  adalimumab: {
    brand: 'humira',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
  },
  enbrel: {
    generic: 'etanercept',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
    aliases: ['etanercept'],
  },
  etanercept: {
    brand: 'enbrel',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
  },
  remicade: {
    generic: 'infliximab',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
    aliases: ['infliximab'],
  },
  infliximab: {
    brand: 'remicade',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
  },
  simponi: {
    generic: 'golimumab',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
  },
  cimzia: {
    generic: 'certolizumab',
    class: 'TNF inhibitor',
    isTnf: true,
    isBiologic: true,
  },

  // IL-17 Inhibitors
  cosentyx: {
    generic: 'secukinumab',
    class: 'IL-17 inhibitor',
    isIl17: true,
    isBiologic: true,
    aliases: ['secukinumab'],
  },
  secukinumab: {
    brand: 'cosentyx',
    class: 'IL-17 inhibitor',
    isIl17: true,
    isBiologic: true,
  },
  taltz: {
    generic: 'ixekizumab',
    class: 'IL-17 inhibitor',
    isIl17: true,
    isBiologic: true,
    aliases: ['ixekizumab'],
  },
  ixekizumab: {
    brand: 'taltz',
    class: 'IL-17 inhibitor',
    isIl17: true,
    isBiologic: true,
  },
  siliq: {
    generic: 'brodalumab',
    class: 'IL-17 inhibitor',
    isIl17: true,
    isBiologic: true,
  },

  // IL-23 Inhibitors
  skyrizi: {
    generic: 'risankizumab',
    class: 'IL-23 inhibitor',
    isIl23: true,
    isBiologic: true,
    aliases: ['risankizumab'],
  },
  risankizumab: {
    brand: 'skyrizi',
    class: 'IL-23 inhibitor',
    isIl23: true,
    isBiologic: true,
  },
  tremfya: {
    generic: 'guselkumab',
    class: 'IL-23 inhibitor',
    isIl23: true,
    isBiologic: true,
    aliases: ['guselkumab'],
  },
  guselkumab: {
    brand: 'tremfya',
    class: 'IL-23 inhibitor',
    isIl23: true,
    isBiologic: true,
  },
  ilumya: {
    generic: 'tildrakizumab',
    class: 'IL-23 inhibitor',
    isIl23: true,
    isBiologic: true,
  },

  // IL-12/23 Inhibitors
  stelara: {
    generic: 'ustekinumab',
    class: 'IL-12/23 inhibitor',
    isIl12: true,
    isIl23: true,
    isBiologic: true,
    aliases: ['ustekinumab'],
  },
  ustekinumab: {
    brand: 'stelara',
    class: 'IL-12/23 inhibitor',
    isIl12: true,
    isIl23: true,
    isBiologic: true,
  },

  // Non-biologics
  methotrexate: {
    class: 'DMARD',
    isBiologic: false,
    aliases: ['mtx', 'trexall', 'rheumatrex'],
  },
  cyclosporine: {
    class: 'Immunosuppressant',
    isBiologic: false,
    aliases: ['neoral', 'sandimmune'],
  },
  apremilast: {
    brand: 'otezla',
    class: 'PDE4 inhibitor',
    isBiologic: false,
  },
  otezla: {
    generic: 'apremilast',
    class: 'PDE4 inhibitor',
    isBiologic: false,
  },
};

/**
 * Medical synonym dictionary
 */
export const MEDICAL_SYNONYMS = {
  depression: ['major depressive disorder', 'clinical depression', 'depressive episode', 'mdd'],
  'heart failure': ['cardiac insufficiency', 'congestive heart failure', 'chf', 'cardiac failure'],
  'myocardial infarction': ['heart attack', 'mi', 'cardiac infarction', 'ami', 'acute mi'],
  stroke: ['cerebrovascular accident', 'cva', 'brain attack', 'cerebral infarction'],
  diabetes: ['diabetes mellitus', 'type 1 diabetes', 'type 2 diabetes', 'dm', 't1dm', 't2dm'],
  tuberculosis: ['tb', 'mycobacterium tuberculosis infection', 'pulmonary tb'],
  'hepatitis b': ['hep b', 'hbv', 'hepatitis b infection', 'hepatitis b virus'],
  'hepatitis c': ['hep c', 'hcv', 'hepatitis c infection', 'hepatitis c virus'],
  hypertension: ['high blood pressure', 'htn', 'elevated blood pressure'],
  hyperlipidemia: ['high cholesterol', 'dyslipidemia', 'elevated lipids'],
  cancer: ['malignancy', 'malignant tumor', 'malignant neoplasm', 'carcinoma'],
  psoriasis: ['plaque psoriasis', 'psoriatic disease'],
  'rheumatoid arthritis': ['ra', 'rheumatoid disease'],
  "crohn's disease": ['crohns', 'inflammatory bowel disease', 'ibd'],
  'ulcerative colitis': ['uc', 'inflammatory bowel disease', 'ibd'],
};

/**
 * Drug class keywords for matching
 */
export const DRUG_CLASS_KEYWORDS = {
  biologics: ['biologic', 'monoclonal antibody', 'fusion protein', 'mab'],
  tnf: ['tnf', 'tumor necrosis factor', 'anti-tnf', 'tnf inhibitor', 'tnf-alpha'],
  il17: ['il-17', 'il17', 'interleukin-17', 'interleukin 17'],
  il23: ['il-23', 'il23', 'interleukin-23', 'interleukin 23'],
  il12: ['il-12', 'il12', 'interleukin-12', 'interleukin 12'],
};

/**
 * Get drug info by name
 * @param {string} drugName - Drug name (brand or generic)
 * @returns {Object|null} Drug information or null if not found
 */
export function getDrugInfo(drugName) {
  if (!drugName) {
    return null;
  }
  const normalized = drugName.toLowerCase().trim();
  return DRUG_DATABASE[normalized] || null;
}

/**
 * Check if two drugs are the same or equivalent
 * @param {string} drug1 - First drug name
 * @param {string} drug2 - Second drug name
 * @returns {boolean} True if drugs match
 */
export function drugsMatch(drug1, drug2) {
  const info1 = getDrugInfo(drug1);
  const info2 = getDrugInfo(drug2);

  if (!info1 || !info2) {
    return drug1?.toLowerCase() === drug2?.toLowerCase();
  }

  // Same drug
  if (drug1.toLowerCase() === drug2.toLowerCase()) {
    return true;
  }

  // Brand/generic match
  if (info1.generic?.toLowerCase() === drug2.toLowerCase()) {
    return true;
  }
  if (info1.brand?.toLowerCase() === drug2.toLowerCase()) {
    return true;
  }
  if (info2.generic?.toLowerCase() === drug1.toLowerCase()) {
    return true;
  }
  if (info2.brand?.toLowerCase() === drug1.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Check if drug belongs to a specific class
 * @param {string} drugName - Drug name
 * @param {string} drugClass - Drug class to check
 * @returns {boolean} True if drug belongs to class
 */
export function drugBelongsToClass(drugName, drugClass) {
  const info = getDrugInfo(drugName);
  if (!info) {
    return false;
  }

  const normalizedClass = drugClass.toLowerCase();

  // Check direct class
  if (info.class?.toLowerCase().includes(normalizedClass)) {
    return true;
  }

  // Check biologic status
  if (normalizedClass.includes('biologic') && info.isBiologic) {
    return true;
  }

  // Check specific inhibitor types
  if (normalizedClass.includes('tnf') && info.isTnf) {
    return true;
  }
  if (normalizedClass.includes('il-17') && info.isIl17) {
    return true;
  }
  if (normalizedClass.includes('il-23') && info.isIl23) {
    return true;
  }
  if (normalizedClass.includes('il-12') && info.isIl12) {
    return true;
  }

  return false;
}

/**
 * Find synonym matches
 * @param {string} term - Term to find synonyms for
 * @returns {string[]} Array of synonyms (including original term)
 */
export function findSynonyms(term) {
  if (!term) {
    return [];
  }

  const normalizedTerm = term.toLowerCase().trim();
  const synonyms = [normalizedTerm];

  // Check if term is a key
  if (MEDICAL_SYNONYMS[normalizedTerm]) {
    synonyms.push(...MEDICAL_SYNONYMS[normalizedTerm]);
  }

  // Check if term is a synonym value
  for (const [key, values] of Object.entries(MEDICAL_SYNONYMS)) {
    if (values.includes(normalizedTerm)) {
      synonyms.push(key);
      synonyms.push(...values);
    }
  }

  return [...new Set(synonyms)];
}
