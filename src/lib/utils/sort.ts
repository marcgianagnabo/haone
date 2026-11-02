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
