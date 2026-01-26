/**
 * @file Drug Category Resolver
 * @description Maps drug names to their therapeutic classes
 */

/**
 * Drug classifications mapping
 * @type {Object<string, { class: string, type: string, isBiologic: boolean, aliases: string[] }>}
 */
const DRUG_DATABASE = {
  // TNF Inhibitors
  adalimumab: {
    class: 'TNF_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['humira', 'adalimumab']
  },
  etanercept: {
    class: 'TNF_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['enbrel', 'etanercept']
  },
  infliximab: {
    class: 'TNF_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['remicade', 'infliximab']
  },
  golimumab: {
    class: 'TNF_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['simponi', 'golimumab']
  },
  certolizumab: {
    class: 'TNF_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['cimzia', 'certolizumab pegol']
  },

  // IL-17 Inhibitors
  secukinumab: {
    class: 'IL17_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['cosentyx', 'secukinumab']
  },
  ixekizumab: {
    class: 'IL17_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['taltz', 'ixekizumab']
  },
  brodalumab: {
    class: 'IL17_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['siliq', 'brodalumab']
  },
  bimekizumab: {
    class: 'IL17_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['bimzelx', 'bimekizumab']
  },

  // IL-23 Inhibitors
  guselkumab: {
    class: 'IL23_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['tremfya', 'guselkumab']
  },
  risankizumab: {
    class: 'IL23_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['skyrizi', 'risankizumab']
  },
  tildrakizumab: {
    class: 'IL23_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['ilumya', 'tildrakizumab']
  },

  // IL-12/23 Inhibitors
  ustekinumab: {
    class: 'IL12_23_inhibitors',
    type: 'biologic',
    isBiologic: true,
    aliases: ['stelara', 'ustekinumab']
  },

  // TYK2 Inhibitors
  deucravacitinib: {
    class: 'TYK2_inhibitors',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['sotyktu', 'deucravacitinib']
  },

  // JAK Inhibitors
  tofacitinib: {
    class: 'JAK_inhibitors',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['xeljanz', 'tofacitinib']
  },
  upadacitinib: {
    class: 'JAK_inhibitors',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['rinvoq', 'upadacitinib']
  },
  baricitinib: {
    class: 'JAK_inhibitors',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['olumiant', 'baricitinib']
  },

  // PDE4 Inhibitors
  apremilast: {
    class: 'PDE4_inhibitors',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['otezla', 'apremilast']
  },
  roflumilast: {
    class: 'PDE4_inhibitors',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['zoryve', 'roflumilast']
  },

  // Systemic Immunosuppressants
  methotrexate: {
    class: 'systemic_immunosuppressants',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['mtx', 'methotrexate', 'trexall']
  },
  cyclosporine: {
    class: 'systemic_immunosuppressants',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['neoral', 'cyclosporine', 'cyclosporin']
  },
  azathioprine: {
    class: 'systemic_immunosuppressants',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['imuran', 'azathioprine']
  },

  // A3 Adenosine Receptor Agonists
  piclidenoson: {
    class: 'A3_adenosine_receptor_agonists',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['cf101', 'piclidenoson']
  },

  // Retinoids
  acitretin: {
    class: 'retinoids',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['soriatane', 'acitretin']
  },

  // Systemic Corticosteroids
  prednisone: {
    class: 'systemic_corticosteroids',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['deltasone', 'prednisone']
  },
  prednisolone: {
    class: 'systemic_corticosteroids',
    type: 'small_molecule',
    isBiologic: false,
    aliases: ['prelone', 'prednisolone']
  }
};

/**
 * Resolve drug name to its therapeutic class
 * @param {string} drugName 
 * @returns {{ drugClass: string, drugType: string, isBiologic: boolean, found: boolean }}
 */
export function resolveDrugCategory(drugName) {
  const normalizedName = drugName.toLowerCase().trim();

  // Direct lookup
  if (DRUG_DATABASE[normalizedName]) {
    const drug = DRUG_DATABASE[normalizedName];
    return {
      drugClass: drug.class,
      drugType: drug.type,
      isBiologic: drug.isBiologic,
      found: true
    };
  }

  // Search by alias
  for (const [key, drug] of Object.entries(DRUG_DATABASE)) {
    if (drug.aliases.some(alias => alias.toLowerCase() === normalizedName)) {
      return {
        drugClass: drug.class,
        drugType: drug.type,
        isBiologic: drug.isBiologic,
        found: true
      };
    }
  }

  // Not found
  return {
    drugClass: 'unknown',
    drugType: 'unknown',
    isBiologic: false,
    found: false
  };
}

/**
 * Get all drugs in a specific class
 * @param {string} drugClass 
 * @returns {string[]}
 */
export function getDrugsByClass(drugClass) {
  return Object.entries(DRUG_DATABASE)
    .filter(([_, drug]) => drug.class === drugClass)
    .map(([name, _]) => name);
}

/**
 * Get all drug class names
 * @returns {string[]}
 */
export function getAllDrugClasses() {
  const classes = new Set();
  for (const drug of Object.values(DRUG_DATABASE)) {
    classes.add(drug.class);
  }
  return Array.from(classes);
}

/**
 * Search terms that match a drug class
 * Used to find criteria that might apply to a drug based on its class
 * @param {string} drugClass 
 * @returns {string[]}
 */
export function getClassSearchTerms(drugClass) {
  const termMap = {
    TNF_inhibitors: ['TNF', 'tumor necrosis factor', 'anti-TNF', 'TNFα', 'TNF-alpha', 'adalimumab', 'etanercept', 'infliximab', 'golimumab', 'certolizumab'],
    IL17_inhibitors: ['IL-17', 'IL17', 'interleukin-17', 'secukinumab', 'ixekizumab', 'brodalumab', 'bimekizumab'],
    IL23_inhibitors: ['IL-23', 'IL23', 'interleukin-23', 'guselkumab', 'risankizumab', 'tildrakizumab'],
    IL12_23_inhibitors: ['IL-12', 'IL12', 'IL-23', 'IL-12/23', 'ustekinumab'],
    TYK2_inhibitors: ['TYK2', 'tyrosine kinase 2', 'deucravacitinib'],
    JAK_inhibitors: ['JAK', 'janus kinase', 'tofacitinib', 'upadacitinib', 'baricitinib'],
    PDE4_inhibitors: ['PDE4', 'phosphodiesterase-4', 'apremilast', 'roflumilast'],
    systemic_immunosuppressants: ['immunosuppressive', 'immunosuppressant', 'methotrexate', 'cyclosporine', 'azathioprine'],
    A3_adenosine_receptor_agonists: ['A3 adenosine', 'piclidenoson', 'CF101'],
    retinoids: ['retinoid', 'acitretin', 'isotretinoin'],
    systemic_corticosteroids: ['corticosteroid', 'prednisone', 'prednisolone', 'glucocorticoid']
  };

  return termMap[drugClass] || [drugClass];
}

/**
 * Generic search terms based on drug properties
 * Returns higher-level classification terms like "biologic", "DMARD", "monoclonal antibody"
 * These match criteria that use general terminology rather than specific drug names
 * 
 * @param {{ drugClass: string, drugType: string, isBiologic: boolean, found: boolean }} drugInfo 
 * @returns {string[]}
 */
export function getGenericSearchTerms(drugInfo) {
  if (!drugInfo || !drugInfo.found) {
    return [];
  }

  const terms = [];

  // Biologic drugs - monoclonal antibodies
  if (drugInfo.isBiologic) {
    terms.push(
      'biologic',
      'biologic agent',
      'biological therapy',
      'biological agent',
      'biologic treatment',
      'biologic drug',
      'monoclonal antibody',
      'antibody',
      'mAb'
    );
  }

  // Small molecule drugs
  if (drugInfo.drugType === 'small_molecule') {
    terms.push('small molecule');
  }

  // DMARD classification based on drug class
  const biologicDMARDClasses = [
    'TNF_inhibitors',
    'IL17_inhibitors', 
    'IL23_inhibitors',
    'IL12_23_inhibitors'
  ];

  const conventionalDMARDClasses = [
    'systemic_immunosuppressants'
  ];

  if (biologicDMARDClasses.includes(drugInfo.drugClass)) {
    terms.push('bDMARD', 'DMARD', 'biologic DMARD', 'disease-modifying');
  }

  if (conventionalDMARDClasses.includes(drugInfo.drugClass)) {
    terms.push('csDMARD', 'DMARD', 'conventional DMARD', 'immunosuppressive', 'immunosuppressant');
  }

  // JAK inhibitors are targeted synthetic DMARDs
  if (drugInfo.drugClass === 'JAK_inhibitors') {
    terms.push('tsDMARD', 'DMARD', 'targeted synthetic DMARD');
  }

  return terms;
}

export { DRUG_DATABASE };
