function anonymise(caseData) {
  const nameMap = {
    '[COMPLAINANT]':           caseData.complainant_name      || '',
    '[RESPONDENT]':            caseData.respondent_name       || '',
    '[INVESTIGATING OFFICER]': caseData.investigating_officer || '',
    '[DECIDING MANAGER]':      caseData.deciding_manager      || '',
    '[HRBP]':                  caseData.hrbp_name             || '',
    '[ORGANISATION]':          caseData.organisation_name     || '',
    // referring_party may contain a person's name or a role descriptor.
    // Always anonymise it: the real value is stored in the nameMap and
    // the encrypted NameMap — it is never sent to the Claude API.
    '[REFERRING PARTY]':       caseData.referring_party       || '',
  };

  if (caseData.witnesses && Array.isArray(caseData.witnesses)) {
    caseData.witnesses.forEach((witness, index) => {
      const label = `[WITNESS ${String.fromCharCode(65 + index)}]`;
      nameMap[label] = witness.name || '';
    });
  }

  const anonymised = {
    case_reference:      caseData.case_reference,
    case_type:           caseData.case_type,
    allegation_count:    caseData.allegations ? caseData.allegations.length : 0,
    allegations:         caseData.allegations || [],
    complainant_role:    caseData.complainant_role    || '',
    respondent_role:     caseData.respondent_role     || '',
    witness_count:       caseData.witnesses ? caseData.witnesses.length : 0,
    witness_roles:       caseData.witnesses ? caseData.witnesses.map(w => w.role || '') : [],
    incident_period:     caseData.incident_period     || '',
    case_open_date:      caseData.case_open_date      || '',
    policies_applicable: caseData.policies_applicable || [],
    evidence_types:      caseData.evidence_types      || [],
    complexity:          caseData.complexity           || 'Medium',
    escalation_required: caseData.escalation_required || false,
    legal_involved:      caseData.legal_involved       || false,
    referring_party:     '[REFERRING PARTY]',           // placeholder — real value in nameMap only
  };

  const nameValues    = Object.values(nameMap).filter(v => v.length > 0);
  const anonymisedStr = JSON.stringify(anonymised);

  for (const name of nameValues) {
    if (name.length > 2 && anonymisedStr.includes(name)) {
      throw new Error(`PII_DETECTED: Real name found in anonymised data. Review inputs before proceeding.`);
    }
  }

  return { anonymised, nameMap };
}

function anonymiseAllegations(allegations, nameMap) {
  return allegations.map(allegation => {
    let clean = allegation;
    for (const [placeholder, realValue] of Object.entries(nameMap)) {
      if (realValue && realValue.length > 2) {
        const regex = new RegExp(realValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        clean = clean.replace(regex, placeholder);
      }
    }
    return clean;
  });
}

module.exports = { anonymise, anonymiseAllegations };
