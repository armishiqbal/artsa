/**
 * Replay timeline type exports.
 *
 * Synthetic session timelines live under __tests__/fixtures/replayFixtures.ts
 * so production lib/ modules never bundle fabricated session telemetry.
 */
export type { TimelineEntry, FallbackForensics } from "@/lib/types/replay";
