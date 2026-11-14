import { describe, expect, it } from 'vitest';
import { compareMeasured, createReport, type Measurement } from './measurement';

const probe = new Float32Array([1, 0, 0]);
const profiles = [
  { id: 'not-for-export-a', embedding: new Float32Array([1, 0, 0]) },
  { id: 'not-for-export-b', embedding: new Float32Array([0, 1, 0]) },
];
describe('instrumentación con vectores numéricos de prueba, no evidencia facial', () => {
  it('ejecuta coseno contra todos los perfiles y mide la operación', () => {
    let ticks = 10;
    const result = compareMeasured(probe, profiles, 0.5, () => ticks++);
    expect(result.match?.id).toBe('not-for-export-a');
    expect(result.metrics).toMatchObject({ comparisonStatus: 'executed', comparedCount: 2, candidateCount: 2, comparisonMs: 1, bestCosine: 1, thresholdApplied: 0.5, outcome: 'candidate' });
  });
  it('conserva un tiempo cero real sin confundirlo con comparación omitida', () => {
    expect(compareMeasured(probe, profiles, 0.5, () => 1).metrics).toMatchObject({ comparisonStatus: 'executed', comparisonMs: 0, comparedCount: 2 });
  });
  it('sin perfiles no mide selección vacía como comparación', () => {
    expect(compareMeasured(probe, [], 0.5, () => { throw new Error('No debe usar reloj'); }).metrics).toMatchObject({ outcome: 'no_profiles', comparisonMs: null, comparedCount: 0, bestCosine: null, thresholdApplied: null });
  });
  it('exporta similitud del mejor rechazado y resultado ambiguo', () => {
    expect(compareMeasured(new Float32Array([0, 0, 1]), profiles, 0.5).metrics).toMatchObject({ outcome: 'unknown', bestCosine: 0, comparedCount: 2 });
    expect(compareMeasured(probe, [profiles[0], { ...profiles[0], id: 'duplicate' }], 0.5).metrics.outcome).toBe('ambiguous');
  });
  it('preserva umbral de cada ensayo, escenario y red independientemente del resultado', () => {
    const row: Measurement = { schemaVersion: 2, kind: 'inference', operation: 'recognition', scenario: 'unknown_person', offlineTestDeclared: true, browserOnlineAtStart: false, browserOnlineAtEnd: false, humanReview: 'incorrect_candidate', ...compareMeasured(probe, profiles, 0.7).metrics };
    expect(createReport([row], 'test').measurements[0]).toMatchObject({ scenario: 'unknown_person', outcome: 'candidate', humanReview: 'incorrect_candidate', thresholdApplied: 0.7, offlineTestDeclared: true });
  });
  it('elimina IDs, nombres, vectores, timestamps y propiedades no autorizadas', () => {
    const row: Measurement & Record<string, unknown> = { schemaVersion: 2, kind: 'inference', operation: 'recognition', id: 45, at: 'sensitive-time', name: 'private-name', embedding: [9, 8], matchedId: 'private-id', ...compareMeasured(probe, profiles, 0.5).metrics };
    const json = JSON.stringify(createReport([row], 'test'));
    for (const secret of ['private-name', 'private-id', 'sensitive-time', 'not-for-export-a', 'matchedId', '"embedding"', '"id"', '"at"']) expect(json).not.toContain(secret);
  });
  it('no reinterpreta mediciones históricas ambiguas', () => {
    const old = { kind: 'inference', comparisonMs: 0, detectionMs: 100, embeddingMs: 37.2 } satisfies Measurement;
    expect(createReport([old], 'test').measurements[0]).toMatchObject({ operation: 'legacy_unspecified', comparisonStatus: 'legacy_unknown', comparisonMs: null, candidateCount: null, detectionMs: 100, embeddingMs: 37.2 });
  });
  it('rechaza umbrales inválidos antes de comparar', () => {
    expect(() => compareMeasured(probe, profiles, NaN)).toThrow('Umbral inválido');
  });
});
