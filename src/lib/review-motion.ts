import type { SubmitFunction, ActionResult } from '@sveltejs/kit';

export type OutcomeKind = 'verifying' | 'approving' | 'rejecting' | 'revising';

/** Sequence durations (ms): full verify ~700; lighter admin approve ~400; dismissals quicker. */
export const HOLD_MS: Record<OutcomeKind, number> = {
  verifying: 700, approving: 400, rejecting: 260, revising: 260
};

/** The after-submit callback type - always returned (never void) for non-pending submits. */
type AfterSubmit = (opts: {
  result: ActionResult;
  update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
}) => Promise<void>;

/**
 * Build a `use:enhance` SubmitFunction that plays the review-outcome moment, then refetches.
 * SUCCESS-GATED: the before-submit phase only marks the row in-flight (markPending - NO green seal,
 * so a rejected/failed request never flashes a fake "Verified"). The success visual (showSucceeded)
 * mounts ONLY when result.type === 'success', then holds the full sequence (skipped under reduced
 * motion), then update() refetches, then finish(). On fail(): no visual, no hold - update + finish.
 */
export function makeOutcomeEnhancer(opts: {
  kind: OutcomeKind;
  reduced: boolean;
  isPending: () => boolean;
  markPending: () => void;
  showSucceeded: () => void;
  finish: () => void;
  prepare?: (input: Parameters<SubmitFunction>[0]) => void;
  hold?: (ms: number) => Promise<void>;
}): (input: Parameters<SubmitFunction>[0]) => AfterSubmit | undefined {
  const hold = opts.hold ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  return (input) => {
    if (opts.isPending()) {
      input.cancel();
      return;
    }
    opts.prepare?.(input);
    opts.markPending();
    return async ({ result, update }) => {
      if (result.type === 'success') {
        opts.showSucceeded();
        if (!opts.reduced) await hold(HOLD_MS[opts.kind]);
      }
      await update();
      opts.finish();
    };
  };
}
