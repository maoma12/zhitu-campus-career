import { analyzeJD, type JobCategory } from "./jd-analysis.ts";
import type { JDEvaluationFixture } from "../../tests/fixtures/jd-evaluation-fixtures.ts";

type Counts = { tp: number; fp: number; fn: number };
const score = ({ tp, fp, fn }: Counts) => {
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
};

export function evaluateJDFixtures(fixtures: JDEvaluationFixture[], resume: Parameters<typeof analyzeJD>[1]) {
  const total: Counts = { tp: 0, fp: 0, fn: 0 };
  const families = new Map<string, Counts>();
  let categoryCorrect = 0;
  let intensityCorrect = 0;
  let intensityTotal = 0;
  let evidenceCorrect = 0;
  let evidenceTotal = 0;
  let excludedFalsePositives = 0;
  const constraintCounts: Counts = { tp: 0, fp: 0, fn: 0 };

  for (const fixture of fixtures) {
    const result = analyzeJD(fixture.jd, resume);
    const actual = new Map((result.requirements ?? []).map((item) => [item.id, item]));
    const expected = new Map(fixture.gold.requirements.map((item) => [item.id, item]));
    const counts = families.get(fixture.family) ?? { tp: 0, fp: 0, fn: 0 };
    for (const id of actual.keys()) {
      if (expected.has(id)) { total.tp++; counts.tp++; }
      else { total.fp++; counts.fp++; }
    }
    for (const [id, gold] of expected) {
      const item = actual.get(id);
      if (!item) { total.fn++; counts.fn++; continue; }
      intensityTotal++;
      if (item.intensity === gold.intensity) intensityCorrect++;
      evidenceTotal++;
      if (item.level === fixture.gold.evidence[id]) evidenceCorrect++;
    }
    excludedFalsePositives += fixture.gold.excluded.filter((id) => actual.has(id)).length;
    const actualConstraints = result.constraints ?? [];
    const matchedConstraintIndexes = new Set<number>();
    for (const gold of fixture.gold.constraints) {
      const index = actualConstraints.findIndex((item, itemIndex) => !matchedConstraintIndexes.has(itemIndex) && item.jdSnippet.includes(gold));
      if (index >= 0) { constraintCounts.tp++; matchedConstraintIndexes.add(index); } else constraintCounts.fn++;
    }
    constraintCounts.fp += actualConstraints.length - matchedConstraintIndexes.size;
    const actualCategory = result.structure?.category as JobCategory | "unknown" | "ambiguous" | undefined;
    if (actualCategory === fixture.gold.category || (actualCategory === "未分类" && fixture.gold.category === "unknown")) categoryCorrect++;
    families.set(fixture.family, counts);
  }

  const macro = [...families.values()].map(score);
  return {
    fixtureCount: fixtures.length,
    categoryAccuracy: categoryCorrect / fixtures.length,
    requirementMicro: score(total),
    requirementMacro: {
      precision: macro.reduce((sum, item) => sum + item.precision, 0) / macro.length,
      recall: macro.reduce((sum, item) => sum + item.recall, 0) / macro.length,
      f1: macro.reduce((sum, item) => sum + item.f1, 0) / macro.length,
    },
    intensityAccuracy: intensityTotal ? intensityCorrect / intensityTotal : 1,
    evidenceAccuracy: evidenceTotal ? evidenceCorrect / evidenceTotal : 1,
    excludedFalsePositives,
    constraintMicro: score(constraintCounts),
  };
}
