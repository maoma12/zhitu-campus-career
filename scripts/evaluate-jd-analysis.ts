import { evaluateJDFixtures } from "../app/lib/jd-evaluation.ts";
import { EVALUATION_RESUME, JD_EVALUATION_FIXTURES } from "../tests/fixtures/jd-evaluation-fixtures.ts";

console.log(JSON.stringify({
  comparable52: evaluateJDFixtures(JD_EVALUATION_FIXTURES.filter((fixture) => !fixture.id.startsWith("edge-")), EVALUATION_RESUME),
  expanded60: evaluateJDFixtures(JD_EVALUATION_FIXTURES, EVALUATION_RESUME),
}, null, 2));
