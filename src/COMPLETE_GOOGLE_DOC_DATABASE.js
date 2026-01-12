/**
 * MEDICATION CLASSIFICATION DATABASE - COMPLETE
 * Last Updated: 2026-01-09
 * 
 * INSTRUCTIONS:
 * 1. Copy this ENTIRE file
 * 2. Paste into your Google Doc (replace all existing content)
 * 3. This will be the single source of truth for all medication data
 */

// ============================================
// INDIVIDUAL DRUG CLASSIFICATIONS
// ============================================

const DRUG_CLASSIFICATION = {
  
  // ============================================
  // TNF-ALPHA INHIBITORS
  // ============================================
  
  "humira": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["adalimumab", "Humira", "Adalimumab"]
  },
  
  "adalimumab": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["humira", "Humira", "Adalimumab"]
  },
  
  "enbrel": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["etanercept", "Enbrel", "Etanercept"]
  },
  
  "etanercept": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["enbrel", "Enbrel", "Etanercept"]
  },
  
  "remicade": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["infliximab", "Remicade", "Infliximab"]
  },
  
  "infliximab": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["remicade", "Remicade", "Infliximab"]
  },
  
  "cimzia": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["certolizumab", "certolizumab pegol", "Cimzia"]
  },
  
  "certolizumab": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["cimzia", "certolizumab pegol", "Cimzia", "Certolizumab"]
  },
  
  "simponi": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["golimumab", "Simponi", "Golimumab"]
  },
  
  "golimumab": {
    drug_class: "TNF_inhibitors",
    drug_type: "biologic",
    mechanism: "TNF-alpha inhibitor",
    is_biologic: true,
    is_tnf: true,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["simponi", "Simponi", "Golimumab"]
  },
  
  // ============================================
  // IL-17 INHIBITORS
  // ============================================
  
  "cosentyx": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17A inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["secukinumab", "Cosentyx", "Secukinumab"]
  },
  
  "secukinumab": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17A inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["cosentyx", "Cosentyx", "Secukinumab"]
  },
  
  "taltz": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17A inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["ixekizumab", "Taltz", "Ixekizumab"]
  },
  
  "ixekizumab": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17A inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["taltz", "Taltz", "Ixekizumab"]
  },
  
  "siliq": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17 receptor inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["brodalumab", "Siliq", "Brodalumab"]
  },
  
  "brodalumab": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17 receptor inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["siliq", "Siliq", "Brodalumab"]
  },
  
  "bimzelx": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17A and IL-17F inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["bimekizumab", "Bimzelx", "Bimekizumab"]
  },
  
  "bimekizumab": {
    drug_class: "IL17_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-17A and IL-17F inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: true,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["bimzelx", "Bimzelx", "Bimekizumab"]
  },
  
  // ============================================
  // IL-23 INHIBITORS
  // ============================================
  
  "skyrizi": {
    drug_class: "IL23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-23 p19 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: true,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["risankizumab", "Skyrizi", "Risankizumab"]
  },
  
  "risankizumab": {
    drug_class: "IL23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-23 p19 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: true,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["skyrizi", "Skyrizi", "Risankizumab"]
  },
  
  "tremfya": {
    drug_class: "IL23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-23 p19 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: true,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["guselkumab", "Tremfya", "Guselkumab"]
  },
  
  "guselkumab": {
    drug_class: "IL23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-23 p19 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: true,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["tremfya", "Tremfya", "Guselkumab"]
  },
  
  "ilumya": {
    drug_class: "IL23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-23 p19 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: true,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["tildrakizumab", "Ilumya", "Tildrakizumab"]
  },
  
  "tildrakizumab": {
    drug_class: "IL23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-23 p19 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: true,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["ilumya", "Ilumya", "Tildrakizumab"]
  },
  
  // ============================================
  // IL-12/23 INHIBITORS
  // ============================================
  
  "stelara": {
    drug_class: "IL12_23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-12/23 p40 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: true,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["ustekinumab", "Stelara", "Ustekinumab"]
  },
  
  "ustekinumab": {
    drug_class: "IL12_23_inhibitors",
    drug_type: "biologic",
    mechanism: "IL-12/23 p40 inhibitor",
    is_biologic: true,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: true,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["stelara", "Stelara", "Ustekinumab"]
  },
  
  // ============================================
  // TYK2 INHIBITORS
  // ============================================
  
  "sotyktu": {
    drug_class: "TYK2_inhibitors",
    drug_type: "small_molecule",
    mechanism: "Allosteric TYK2 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: true,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["deucravacitinib", "Sotyktu", "BMS-986165"]
  },
  
  "deucravacitinib": {
    drug_class: "TYK2_inhibitors",
    drug_type: "small_molecule",
    mechanism: "Allosteric TYK2 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: true,
    is_jak: false,
    lifetime_exclusion: true,
    aliases: ["sotyktu", "Sotyktu", "BMS-986165", "Deucravacitinib"]
  },
  
  "esk-001": {
    drug_class: "TYK2_inhibitors",
    drug_type: "small_molecule",
    mechanism: "Allosteric TYK2 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: true,
    is_jak: false,
    lifetime_exclusion: false,
    company: "Alumis Inc",
    development_stage: "Phase 3",
    aliases: ["esk 001", "esk001", "ESK-001", "ESK 001"]
  },
  
  "esk 001": {
    drug_class: "TYK2_inhibitors",
    drug_type: "small_molecule",
    mechanism: "Allosteric TYK2 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: true,
    is_jak: false,
    lifetime_exclusion: false,
    company: "Alumis Inc",
    development_stage: "Phase 3",
    aliases: ["esk-001", "esk001", "ESK-001", "ESK 001"]
  },
  
  "esk001": {
    drug_class: "TYK2_inhibitors",
    drug_type: "small_molecule",
    mechanism: "Allosteric TYK2 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: true,
    is_jak: false,
    lifetime_exclusion: false,
    company: "Alumis Inc",
    development_stage: "Phase 3",
    aliases: ["esk-001", "esk 001", "ESK-001", "ESK 001"]
  },
  
  // ============================================
  // JAK INHIBITORS
  // ============================================
  
  "xeljanz": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1/3 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["tofacitinib", "Xeljanz", "Tofacitinib"]
  },
  
  "tofacitinib": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1/3 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["xeljanz", "Xeljanz", "Tofacitinib"]
  },
  
  "rinvoq": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["upadacitinib", "Rinvoq", "Upadacitinib"]
  },
  
  "upadacitinib": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["rinvoq", "Rinvoq", "Upadacitinib"]
  },
  
  "olumiant": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1/2 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["baricitinib", "Olumiant", "Baricitinib"]
  },
  
  "baricitinib": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1/2 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["olumiant", "Olumiant", "Baricitinib"]
  },
  
  "cibinqo": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["abrocitinib", "Cibinqo", "Abrocitinib"]
  },
  
  "abrocitinib": {
    drug_class: "JAK_inhibitors",
    drug_type: "small_molecule",
    mechanism: "JAK1 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: true,
    lifetime_exclusion: false,
    aliases: ["cibinqo", "Cibinqo", "Abrocitinib"]
  },
  
  // ============================================
  // PDE4 INHIBITORS
  // ============================================
  
  "otezla": {
    drug_class: "PDE4_inhibitors",
    drug_type: "small_molecule",
    mechanism: "PDE4 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["apremilast", "Otezla", "Apremilast"]
  },
  
  "apremilast": {
    drug_class: "PDE4_inhibitors",
    drug_type: "small_molecule",
    mechanism: "PDE4 inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["otezla", "Otezla", "Apremilast"]
  },
  
  // ============================================
  // SYSTEMIC IMMUNOSUPPRESSANTS
  // ============================================
  
  "methotrexate": {
    drug_class: "systemic_immunosuppressants",
    drug_type: "immunosuppressant",
    mechanism: "DMARD/immunosuppressant",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["MTX", "mtx", "Methotrexate"]
  },
  
  "mtx": {
    drug_class: "systemic_immunosuppressants",
    drug_type: "immunosuppressant",
    mechanism: "DMARD/immunosuppressant",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["methotrexate", "MTX", "Methotrexate"]
  },
  
  "cyclosporine": {
    drug_class: "systemic_immunosuppressants",
    drug_type: "immunosuppressant",
    mechanism: "Calcineurin inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["ciclosporin", "Neoral", "Sandimmune", "Cyclosporine"]
  },
  
  "azathioprine": {
    drug_class: "systemic_immunosuppressants",
    drug_type: "immunosuppressant",
    mechanism: "Purine synthesis inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["Imuran", "imuran", "Azathioprine"]
  },
  
  "imuran": {
    drug_class: "systemic_immunosuppressants",
    drug_type: "immunosuppressant",
    mechanism: "Purine synthesis inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["azathioprine", "Imuran", "Azathioprine"]
  },
  
  "mycophenolate": {
    drug_class: "systemic_immunosuppressants",
    drug_type: "immunosuppressant",
    mechanism: "Purine synthesis inhibitor",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["mycophenolic acid", "CellCept", "Mycophenolate"]
  },
  
  // ============================================
  // CORTICOSTEROIDS
  // ============================================
  
  "prednisone": {
    drug_class: "systemic_corticosteroids",
    drug_type: "corticosteroid",
    mechanism: "Corticosteroid",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["Prednisone"]
  },
  
  "prednisolone": {
    drug_class: "systemic_corticosteroids",
    drug_type: "corticosteroid",
    mechanism: "Corticosteroid",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["Prednisolone"]
  },
  
  "methylprednisolone": {
    drug_class: "systemic_corticosteroids",
    drug_type: "corticosteroid",
    mechanism: "Corticosteroid",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["Medrol", "medrol", "Methylprednisolone"]
  },
  
  "medrol": {
    drug_class: "systemic_corticosteroids",
    drug_type: "corticosteroid",
    mechanism: "Corticosteroid",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["methylprednisolone", "Methylprednisolone", "Medrol"]
  },
  
  "dexamethasone": {
    drug_class: "systemic_corticosteroids",
    drug_type: "corticosteroid",
    mechanism: "Corticosteroid",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["Dexamethasone"]
  },
  
  "hydrocortisone": {
    drug_class: "systemic_corticosteroids",
    drug_type: "corticosteroid",
    mechanism: "Corticosteroid",
    is_biologic: false,
    is_tnf: false,
    is_il17: false,
    is_il23: false,
    is_il12_23: false,
    is_tyk2: false,
    is_jak: false,
    lifetime_exclusion: false,
    aliases: ["Hydrocortisone"]
  }
  
};

// Export if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DRUG_CLASSIFICATION };
}
