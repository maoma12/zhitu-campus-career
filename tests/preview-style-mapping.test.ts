import assert from "node:assert/strict";
import test from "node:test";

import { pairAlignedCloneNodes } from "../app/lib/preview-style-mapping.ts";

test("多页分页 marker 删除前建立稳定样式映射，删除后不会错位", () => {
  const source = ["paper", "name", "marker", "section-heading", "entry-title", "body"];
  const clone = [...source];
  const pairs = pairAlignedCloneNodes(source, clone);
  clone.splice(clone.indexOf("marker"), 1);
  assert.deepEqual(pairs.map(([from, to]) => [from, to]), source.map((node) => [node, node]));
  assert.throws(
    () => pairAlignedCloneNodes(source, clone),
    /structure changed before style mapping/,
  );
});
