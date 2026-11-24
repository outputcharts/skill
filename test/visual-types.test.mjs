// node --test   (set OC_SCHEMA=path/to/schemas.js to read a local schemas.js
// instead of https://api.outputcharts.com/v1/schema, which is built from it)
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSchemaTypes, checkAll, parseProseList, statedCounts } from "../check-visual-types.mjs";

test("every listing's visual types match schemas.js", async () => {
  const types = await loadSchemaTypes();
  assert.ok(types.length > 0, "schemas.js returned no types");
  assert.deepEqual(checkAll(types), []);
});

test("the parser reads prose lists and counts", () => {
  assert.deepEqual(parseProseList("bar, horizontal bar, KPI, gauge and map (world or US states)"), ["bar", "bar-horizontal", "kpi", "gauge", "map"]);
  assert.deepEqual(statedCounts("Eleven visual types; suggest 1-3 visual types").map((c) => c.count), [11]);
});
