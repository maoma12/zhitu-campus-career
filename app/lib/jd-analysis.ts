export type KeywordRule = {
  label: string;
  aliases: string[];
};

export type EvidenceLevel = "experience" | "listed";

export type EvidenceSection = {
  label: string;
  level: EvidenceLevel;
  text: string;
};

export type KeywordEvidence = {
  keyword: string;
  level: EvidenceLevel;
  sources: string[];
};

export type KeywordCoverageResult = {
  keywords: string[];
  matched: string[];
  missing: string[];
  evidence: KeywordEvidence[];
  coverageRatio: number;
  coverageLabel: "未识别" | "覆盖较低" | "部分覆盖" | "覆盖较高";
};

export function analyzeKeywordCoverage(
  jd: string,
  rules: KeywordRule[],
  sections: EvidenceSection[],
): KeywordCoverageResult {
  const jdLower = jd.toLowerCase();
  const selected = rules.filter((rule) =>
    rule.aliases.some((alias) => jdLower.includes(alias.toLowerCase())),
  );
  const evidence = selected.flatMap<KeywordEvidence>((rule) => {
    const matchingSections = sections.filter((section) => {
      const sectionText = section.text.toLowerCase();
      return rule.aliases.some((alias) =>
        sectionText.includes(alias.toLowerCase()),
      );
    });
    if (!matchingSections.length) return [];
    const experienceSources = matchingSections.filter(
      (section) => section.level === "experience",
    );
    const strongest = experienceSources.length
      ? experienceSources
      : matchingSections;
    return [{
      keyword: rule.label,
      level: experienceSources.length ? "experience" : "listed",
      sources: [...new Set(strongest.map((section) => section.label))],
    }];
  });
  const matched = evidence.map((item) => item.keyword);
  const missing = selected
    .map((rule) => rule.label)
    .filter((keyword) => !matched.includes(keyword));
  const coverageRatio = selected.length ? matched.length / selected.length : 0;
  const coverageLabel = !selected.length
    ? "未识别"
    : coverageRatio >= 0.7
      ? "覆盖较高"
      : coverageRatio >= 0.4
        ? "部分覆盖"
        : "覆盖较低";

  return {
    keywords: selected.map((rule) => rule.label),
    matched,
    missing,
    evidence,
    coverageRatio,
    coverageLabel,
  };
}
