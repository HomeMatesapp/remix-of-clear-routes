import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildPublicPackMetadata,
  buildPublicQuestionnaire,
  PUBLIC_PACK_METADATA_KEYS,
} from "@shared/career-evaluator/v1/public-projectors";
import type { CareerDecisionPackV1 } from "@shared/career-evaluator/v1/types";

const __dir = dirname(fileURLToPath(import.meta.url));
const load = (slug: string) =>
  JSON.parse(readFileSync(resolve(__dir, `../../../content/career-packs/${slug}/1.1.0.json`), "utf-8")) as CareerDecisionPackV1;

const binding = (slug: string, pack: CareerDecisionPackV1) => ({
  slug,
  packVersion: pack.packVersion,
  status: "published",
  reviewDueAt: null,
  geographicScope: pack.careerIdentity.geographicScope,
});

// Keys/paths that must NEVER appear anywhere in projected output.
const FORBIDDEN_KEYS = new Set([
  "contentHash", "content_hash",
  "packId", "pack_id",
  "roleId", "role_id",
  "ownerId", "owner_id", "ownerUserId", "owner_user_id",
  "reviewerId", "reviewer_id", "reviewerUserId",
  "adminNotes", "admin_notes", "internalNotes", "internal_notes",
  "importedBy", "imported_by",
  "environment", "is_test", "isTest",
  "rules", "testProfiles", "test_profiles",
  "routes", "requirements", "evidenceRecords", "evidence_records",
  "actionTemplates", "action_templates",
  "content", "raw", "archetypeId", "archetype_id",
  "schemaVersion", // pack schemaVersion should never leak (contract version differs)
  "publications", "publicationEvents", "publication_events",
  "supersededAt", "superseded_at",
  "importedAt", "imported_at",
]);

const walk = (node: unknown, path: string, hits: string[]) => {
  if (Array.isArray(node)) { node.forEach((c, i) => walk(c, `${path}[${i}]`, hits)); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) hits.push(`${path}.${k}`);
      walk(v, `${path}.${k}`, hits);
    }
  }
};

describe("buildPublicPackMetadata — exact-key contract", () => {
  const pack = load("midwife");
  const meta = buildPublicPackMetadata(binding("midwife", pack));

  it("exposes exactly the approved metadata keys", () => {
    expect(Object.keys(meta).sort()).toEqual([...PUBLIC_PACK_METADATA_KEYS].sort());
  });
  it("never exposes forbidden internal fields", () => {
    const hits: string[] = [];
    walk(meta, "packMetadata", hits);
    expect(hits).toEqual([]);
  });
  it("pins evaluatorSchemaVersion to the canonical value", () => {
    expect(meta.evaluatorSchemaVersion).toBe("reality-check-result/v1");
  });
  it("carries slug + packVersion + status + reviewDueAt + geographicScope", () => {
    expect(meta.slug).toBe("midwife");
    expect(meta.packVersion).toBe("1.1.0");
    expect(meta.status).toBe("published");
    expect(meta.reviewDueAt).toBeNull();
    expect(meta.geographicScope).toEqual(["England"]);
  });
});

describe("buildPublicQuestionnaire — recursive forbidden-key sweep", () => {
  for (const slug of ["midwife", "carpenter-joiner", "photographer"]) {
    it(`${slug} projected questionnaire contains no forbidden keys`, () => {
      const pack = load(slug);
      const q = buildPublicQuestionnaire(pack, binding(slug, pack));
      const hits: string[] = [];
      walk(q, "public", hits);
      if (hits.length) throw new Error("forbidden key leak: " + hits.join(", "));
    });

    it(`${slug} projected questions expose only the approved shape`, () => {
      const pack = load(slug);
      const q = buildPublicQuestionnaire(pack, binding(slug, pack));
      const allowedQuestionKeys = new Set([
        "id", "moduleId", "displayLabel", "helpText", "helpTextLong",
        "inputKind", "required", "options", "visibleWhen", "displayOrder",
      ]);
      for (const pq of q.questions) {
        for (const key of Object.keys(pq)) {
          expect(allowedQuestionKeys.has(key), `unexpected question key "${key}"`).toBe(true);
        }
      }
      const allowedTopKeys = new Set([
        "contractVersion", "slug", "packVersion", "canonicalTitle", "participantTitle",
        "participantIntroduction", "whatItCovers", "whatItCannotConfirm",
        "geographicScope", "status", "reviewDueAt", "modules", "questions",
      ]);
      for (const key of Object.keys(q)) {
        expect(allowedTopKeys.has(key), `unexpected top-level key "${key}"`).toBe(true);
      }
    });

    it(`${slug} preserves question order`, () => {
      const pack = load(slug);
      const q = buildPublicQuestionnaire(pack, binding(slug, pack));
      expect(q.questions.map((x) => x.id)).toEqual(pack.questionRefs.map((x) => x.id));
    });
  }
});

describe("buildPublicQuestionnaire — refuses to project incomplete packs", () => {
  it("throws when introduction is missing", () => {
    const pack = load("midwife");
    const broken = { ...pack, careerIdentity: { ...pack.careerIdentity, introduction: undefined } } as CareerDecisionPackV1;
    expect(() => buildPublicQuestionnaire(broken, binding("midwife", pack))).toThrow();
  });
});
