import assert from "node:assert/strict";
import test from "node:test";
import { evaluateJDFixtures } from "../app/lib/jd-evaluation.ts";
import { EVALUATION_RESUME, JD_EVALUATION_FIXTURES } from "./fixtures/jd-evaluation-fixtures.ts";

test("JD evaluation corpus has at least 50 independent synthetic fixtures", () => {
  assert.ok(JD_EVALUATION_FIXTURES.length >= 50);
  assert.ok(JD_EVALUATION_FIXTURES.every((fixture) => fixture.jd.includes("TEST FIXTURE")));
  assert.deepEqual(new Set(JD_EVALUATION_FIXTURES.map((fixture) => fixture.format)), new Set(["boss", "bullets", "english", "single-line"]));
});

test("JD evaluation metrics remain finite and reproducible", () => {
  const first = evaluateJDFixtures(JD_EVALUATION_FIXTURES, EVALUATION_RESUME);
  const second = evaluateJDFixtures(JD_EVALUATION_FIXTURES, EVALUATION_RESUME);
  assert.deepEqual(first, second);
  assert.ok(Object.values(first.requirementMicro).every(Number.isFinite));
});
