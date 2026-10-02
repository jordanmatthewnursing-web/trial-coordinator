import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStudy, normalizeSearchPayload } from "../lib/study.ts";

test("keeps facility recruitment status separate from study status", () => {
  const study = normalizeStudy({
    protocolSection: {
      identificationModule: { nctId: "NCT12345678", briefTitle: "Example" },
      statusModule: {
        overallStatus: "RECRUITING",
        lastUpdatePostDateStruct: { date: "2026-09-24" },
      },
      designModule: { phases: ["NA"] },
      contactsLocationsModule: {
        locations: [
          {
            facility: "Site A",
            status: "NOT_YET_RECRUITING",
            city: "Boston",
            country: "United States",
          },
        ],
      },
    },
  });
  assert.equal(study.status, "RECRUITING");
  assert.equal(study.locations[0].status, "NOT_YET_RECRUITING");
  assert.equal(study.updated, "2026-09-24");
  assert.equal(study.phase, "Not applicable");
});

test("missing registry fields stay visibly unknown", () => {
  assert.equal(normalizeStudy({ protocolSection: {} }), null);
  const study = normalizeStudy({
    protocolSection: { identificationModule: { nctId: "NCT12345678" } },
  });
  assert.equal(study.status, "UNKNOWN");
  assert.equal(study.sex, "UNKNOWN");
  assert.equal(study.locations.length, 0);
  assert.equal(study.centralContact, null);
});

test("rejects malformed nested fields instead of passing them into review state", () => {
  const identity = { identificationModule: { nctId: "NCT12345678" } };
  assert.equal(normalizeStudy(null), null);
  assert.equal(normalizeStudy({ protocolSection: { ...identity, conditionsModule: { conditions: "diabetes" } } }), null);
  assert.equal(normalizeStudy({ protocolSection: { ...identity, contactsLocationsModule: { locations: "Boston" } } }), null);
  assert.equal(normalizeStudy({ protocolSection: { ...identity, statusModule: { overallStatus: 42 } } }), null);
});

test("search response reports omitted malformed records without hiding valid ones", () => {
  const valid = { protocolSection: { identificationModule: { nctId: "NCT12345678", briefTitle: "Example" } } };
  assert.equal(normalizeSearchPayload({ studies: "invalid" }), null);
  assert.deepEqual(normalizeSearchPayload({ studies: [valid, { protocolSection: {} }], totalCount: 2, nextPageToken: "next" }), {
    studies: [normalizeStudy(valid)],
    total: 2,
    nextPageToken: "next",
    omitted: 1,
  });
});
