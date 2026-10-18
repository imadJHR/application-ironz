import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryHashMatches,
  RECOVERY_CODE_REGEX,
} from "../src/server/recovery-format";

test("Le code de récupération embarque 128 bits d'entropie", () => {
  const { plain } = generateRecoveryCode();
  const hex = normalizeRecoveryCode(plain);
  assert.equal(hex.length, 32); // 32 caractères hexadécimaux = 128 bits
  assert.ok(/^[0-9A-F]{32}$/.test(hex));
});
test("Le format affiché est 4 groupes hexadécimaux de 8", () => {
  const { plain } = generateRecoveryCode();
  assert.ok(RECOVERY_CODE_REGEX.test(plain));
  assert.match(plain, /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
});
test("Deux codes générés ne sont jamais identiques (1000 tirages)", () => {
  const set = new Set<string>();
  for (let i = 0; i < 1000; i++) set.add(generateRecoveryCode().plain);
  assert.equal(set.size, 1000);
});
test("Le hash est stable et ne contient jamais le code", () => {
  const { plain, hash } = generateRecoveryCode();
  assert.equal(hashRecoveryCode(normalizeRecoveryCode(plain)), hash);
  assert.ok(!hash.includes(plain));
  assert.match(hash, /^[0-9a-f]{64}$/); // SHA-256
});
test("La normalisation tolère tirets, espaces et minuscules", () => {
  const { plain } = generateRecoveryCode();
  const lower = plain.toLowerCase();
  assert.equal(normalizeRecoveryCode(lower), normalizeRecoveryCode(plain));
  assert.equal(
    normalizeRecoveryCode(plain.replace(/-/g, " ")),
    normalizeRecoveryCode(plain),
  );
});
test("La comparaison des hashs est sûre et sans égalité fallacieuse", () => {
  const { hash } = generateRecoveryCode();
  assert.ok(recoveryHashMatches(hash, hash));
  assert.ok(!recoveryHashMatches(hash, "z".repeat(0) + hash.slice(0, 63)));
  assert.ok(!recoveryHashMatches("a".repeat(64), "b".repeat(64)));
});
