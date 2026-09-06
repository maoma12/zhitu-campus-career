import { evaluateAiPhase0 } from "../app/lib/ai-evaluation.ts";
import { JD_EVALUATION_FIXTURES } from "../tests/fixtures/jd-evaluation-fixtures.ts";
import { AI_PHASE0_EVAL_FIXTURES } from "../tests/fixtures/ai-phase0-fixtures.ts";

console.log(JSON.stringify(evaluateAiPhase0([...JD_EVALUATION_FIXTURES, ...AI_PHASE0_EVAL_FIXTURES]), null, 2));
