export function sortPeriods(periods: string[]) {
  const getWeight = (term: string) => {
    if (term === "MY") {
      return 3;
    }
    if (term === "2S") {
      return 2;
    }
    if (term === "1S") {
      return 1;
    }
    return 0;
  };

  return [...periods].sort((a, b) => {
    const matchA = a.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);
    const matchB = b.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);

    if (!matchA || !matchB) {
      return a.localeCompare(b);
    }

    const yearA = parseInt(matchA[1]);
    const yearB = parseInt(matchB[1]);
    const termA = matchA[3];
    const termB = matchB[3];

    if (yearA !== yearB) {
      return yearB - yearA;
    }
    return getWeight(termB) - getWeight(termA);
  });
}

export function parseTermCode(period: string) {
  const match = /^(\d{2})(\d{2})_(MY|[1-3]S)$/.exec((period || "").trim());
  if (!match) {
    return null;
  }
  return { startYear: parseInt(match[1], 10), endYear: parseInt(match[2], 10), term: match[3] };
}

/**
 * Carryover lands at the start of the immediately following semester —
 * 1S -> 2S -> Midyear -> next academic year's 1S.
 */
export function isNextSemester(sourcePeriod: string, targetPeriod: string) {
  const src = parseTermCode(sourcePeriod);
  const tgt = parseTermCode(targetPeriod);
  if (!src || !tgt) {
    return false;
  }
  if (src.term === "1S") {
    return tgt.startYear === src.startYear && tgt.term === "2S";
  }
  if (src.term === "2S") {
    return tgt.startYear === src.startYear && tgt.term === "MY";
  }
  if (src.term === "MY") {
    return tgt.startYear === src.startYear + 1 && tgt.term === "1S";
  }
  return false;
}
