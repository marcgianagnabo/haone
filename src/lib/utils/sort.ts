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
 * Carryover always lands at the start of the immediately following academic
 * year — the 1st semester (1S). Midyear terms are never carryover targets.
 */
export function isFollowingYearFirstSemester(sourcePeriod: string, targetPeriod: string) {
  const src = parseTermCode(sourcePeriod);
  const tgt = parseTermCode(targetPeriod);
  if (!src || !tgt) {
    return false;
  }
  return tgt.startYear === src.startYear + 1 && tgt.term === "1S";
}
