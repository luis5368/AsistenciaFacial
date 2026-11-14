import { choose } from './math';

export type Scenario = 'unspecified' | 'known_person' | 'unknown_person';
export type HumanReview = 'not_reviewed' | 'correct_candidate' | 'incorrect_candidate' | 'correct_rejection' | 'incorrect_rejection' | 'inconclusive';
export type Measurement = {
  id?: number;
  schemaVersion?: 2;
  kind: 'load' | 'inference' | 'control';
  operation?: 'load' | 'enrollment' | 'recognition' | 'control';
  scenario?: Scenario;
  offlineTestDeclared?: boolean;
  browserOnlineAtStart?: boolean;
  browserOnlineAtEnd?: boolean;
  serviceWorkerControlled?: boolean;
  outcome?: 'loaded' | 'enrolled' | 'candidate' | 'unknown' | 'ambiguous' | 'no_face' | 'multiple_faces' | 'no_profiles' | 'profile_limit' | 'control' | 'error';
  comparisonStatus?: 'executed' | 'not_applicable' | 'no_face' | 'multiple_faces' | 'no_profiles' | 'error';
  candidateCount?: number;
  comparedCount?: number;
  bestCosine?: number | null;
  thresholdApplied?: number | null;
  ambiguityMargin?: number | null;
  humanReview?: HumanReview;
  detectionMs?: number;
  embeddingMs?: number;
  comparisonMs?: number | null;
  yunetLoadMs?: number;
  sfaceLoadMs?: number;
  faces?: number;
  heapBytes?: number;
  storageBytes?: number;
  controlDimensions?: number;
  controlSfaceMs?: number;
};

// This is the exact comparison path invoked by the UI; no mock engine or scores.
export function compareMeasured(
  probe: Float32Array,
  profiles: { id: string; embedding: Float32Array }[],
  threshold: number,
  clock = () => performance.now(),
) {
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new Error('Umbral inválido');
  if (!profiles.length) return {
    match: null,
    metrics: { outcome: 'no_profiles', comparisonStatus: 'no_profiles', candidateCount: 0, comparedCount: 0, comparisonMs: null, bestCosine: null, thresholdApplied: null, ambiguityMargin: null } satisfies Partial<Measurement>,
  };
  const start = clock();
  const match = choose(probe, profiles, threshold, 0.05);
  const comparisonMs = Math.max(0, clock() - start);
  return {
    match,
    metrics: { outcome: match.state, comparisonStatus: 'executed', candidateCount: profiles.length, comparedCount: profiles.length, comparisonMs, bestCosine: match.score, thresholdApplied: threshold, ambiguityMargin: 0.05 } satisfies Partial<Measurement>,
  };
}

// Explicit allowlist: never serialize runtime IDs, vectors, names, wall-clock
// timestamps, device fingerprints, free text or arbitrary properties from IDB.
export function publicMeasurement(row: Measurement) {
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const legacy = row.schemaVersion !== 2;
  return {
    schemaVersion: legacy ? 1 : 2,
    operation: legacy ? 'legacy_unspecified' : row.operation,
    scenario: legacy ? 'unspecified' : row.scenario,
    offlineTestDeclared: legacy ? null : row.offlineTestDeclared,
    browserOnlineAtStart: legacy ? null : row.browserOnlineAtStart,
    browserOnlineAtEnd: legacy ? null : row.browserOnlineAtEnd,
    serviceWorkerControlled: legacy ? null : row.serviceWorkerControlled,
    outcome: legacy ? 'legacy_unknown' : row.outcome,
    comparisonStatus: legacy ? 'legacy_unknown' : row.comparisonStatus,
    candidateCount: legacy ? null : finite(row.candidateCount),
    comparedCount: legacy ? null : finite(row.comparedCount),
    comparisonMs: legacy ? null : finite(row.comparisonMs),
    bestCosine: legacy ? null : finite(row.bestCosine),
    thresholdApplied: legacy ? null : finite(row.thresholdApplied),
    ambiguityMargin: legacy ? null : finite(row.ambiguityMargin),
    humanReview: legacy ? 'not_reviewed' : row.humanReview ?? 'not_reviewed',
    detectionMs: finite(row.detectionMs), embeddingMs: finite(row.embeddingMs),
    yunetLoadMs: finite(row.yunetLoadMs), sfaceLoadMs: finite(row.sfaceLoadMs),
    faces: finite(row.faces), heapBytes: finite(row.heapBytes), storageBytes: finite(row.storageBytes),
    controlDimensions: finite(row.controlDimensions), controlSfaceMs: finite(row.controlSfaceMs),
  };
}

export function createReport(rows: Measurement[], modelVersion: string) {
  return {
    schemaVersion: 2, modelVersion,
    warning: 'Candidato no equivale a identidad validada. Escenario y revisión son declaraciones humanas. Sin fotografías, embeddings, nombres, IDs de perfiles ni marcas de tiempo personales. onLine es solo un indicio de red.',
    measurements: rows.map(publicMeasurement),
  };
}
