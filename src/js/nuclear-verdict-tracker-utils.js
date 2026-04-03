(function attachNuclearVerdictTrackerUtils() {
  const VERDICT_BUCKETS = ['$100M+', '$50M-$99M', '$25M-$49M', '$10M-$24M', 'Under $10M'];

  function deriveVerdictBucket(totalVerdict) {
    const amount = Number(totalVerdict) || 0;

    if (amount >= 100000000) return '$100M+';
    if (amount >= 50000000) return '$50M-$99M';
    if (amount >= 25000000) return '$25M-$49M';
    if (amount >= 10000000) return '$10M-$24M';
    return 'Under $10M';
  }

  function normalizeSearchText(value) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeVerdict(rawVerdict, index) {
    const totalVerdict = Number(rawVerdict.totalVerdict) || 0;
    const compensatoryDamages = Number(rawVerdict.compensatoryDamages) || 0;
    const punitiveDamages = Number(rawVerdict.punitiveDamages) || 0;
    const hasPunitive = typeof rawVerdict.hasPunitive === 'boolean'
      ? rawVerdict.hasPunitive
      : punitiveDamages > 0;

    return {
      id: rawVerdict.id || `verdict-${index + 1}`,
      year: Number(rawVerdict.year) || 0,
      state: rawVerdict.state || 'Unknown',
      jurisdiction: rawVerdict.jurisdiction || 'Unknown',
      caseName: rawVerdict.caseName || 'Unnamed matter',
      captionType: rawVerdict.captionType || rawVerdict.caseType || 'Reported verdict',
      caseType: rawVerdict.caseType || 'Uncategorized',
      industry: rawVerdict.industry || 'Unspecified',
      totalVerdict,
      compensatoryDamages,
      punitiveDamages,
      hasPunitive,
      verdictBucket: rawVerdict.verdictBucket || deriveVerdictBucket(totalVerdict),
      sourceLabel: rawVerdict.sourceLabel || 'Local verdict file',
      sourceUrl: rawVerdict.sourceUrl || '',
      notes: rawVerdict.notes || '',
      searchText: normalizeSearchText([
        rawVerdict.id || `verdict-${index + 1}`,
        rawVerdict.caseName,
        rawVerdict.captionType,
        rawVerdict.state,
        rawVerdict.jurisdiction,
        rawVerdict.caseType,
        rawVerdict.industry,
        rawVerdict.sourceLabel,
        rawVerdict.sourceUrl,
        rawVerdict.notes
      ].join(' '))
    };
  }

  function sortFilterValues(values, key) {
    const items = [...values];

    if (key === 'year') {
      return items.sort((left, right) => Number(right) - Number(left));
    }

    if (key === 'verdictBucket') {
      return items.sort((left, right) => VERDICT_BUCKETS.indexOf(left) - VERDICT_BUCKETS.indexOf(right));
    }

    return items.sort((left, right) => String(left).localeCompare(String(right)));
  }

  function normalizeVerdicts(rawVerdicts) {
    const items = Array.isArray(rawVerdicts) ? rawVerdicts : [];

    return items
      .map(normalizeVerdict)
      .sort((left, right) => {
        if (right.year !== left.year) {
          return right.year - left.year;
        }

        return right.totalVerdict - left.totalVerdict;
      });
  }

  window.NuclearVerdictTrackerUtils = {
    deriveVerdictBucket,
    normalizeSearchText,
    normalizeVerdict,
    normalizeVerdicts,
    sortFilterValues,
    VERDICT_BUCKETS
  };
})();
