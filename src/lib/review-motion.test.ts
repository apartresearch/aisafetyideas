import { describe, it, expect, vi } from 'vitest';
import { makeOutcomeEnhancer, HOLD_MS } from './review-motion';

function harness(opts: Partial<Parameters<typeof makeOutcomeEnhancer>[0]> = {}) {
  const calls: string[] = [];
  const hold = vi.fn(() => { calls.push('hold'); return Promise.resolve(); });
  const enhancer = makeOutcomeEnhancer({
    kind: 'verifying', reduced: false,
    isPending: () => false,
    markPending: () => calls.push('markPending'),
    showSucceeded: () => calls.push('showSucceeded'),
    finish: () => calls.push('finish'),
    hold,
    ...opts
  });
  return { enhancer, calls, hold };
}

describe('makeOutcomeEnhancer', () => {
  it('cancels (no markPending) when already pending', () => {
    const cancel = vi.fn();
    const { enhancer, calls } = harness({ isPending: () => true });
    expect(enhancer({ cancel } as any)).toBeUndefined();
    expect(cancel).toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
  it('SUCCESS: markPending (before) → showSucceeded → hold → update → finish', async () => {
    const { enhancer, calls, hold } = harness();
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'success' }, update } as any);
    expect(hold).toHaveBeenCalledWith(HOLD_MS.verifying);
    expect(calls).toEqual(['markPending', 'showSucceeded', 'hold', 'update', 'finish']);
  });
  it('FAILURE: never shows the success visual, no hold - just update + finish', async () => {
    const { enhancer, calls, hold } = harness();
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'failure' }, update } as any);
    expect(hold).not.toHaveBeenCalled();
    expect(calls).toEqual(['markPending', 'update', 'finish']);
  });
  it('reduced motion: success shows the visual but skips the hold', async () => {
    const { enhancer, calls, hold } = harness({ reduced: true });
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'success' }, update } as any);
    expect(hold).not.toHaveBeenCalled();
    expect(calls).toEqual(['markPending', 'showSucceeded', 'update', 'finish']);
  });
  it('runs prepare(input) before markPending', () => {
    const calls: string[] = [];
    const enhancer = makeOutcomeEnhancer({
      kind: 'verifying', reduced: false, isPending: () => false,
      prepare: (i: any) => calls.push('prepare:' + i.formData.get('payout')),
      markPending: () => calls.push('markPending'),
      showSucceeded: () => {}, finish: () => {}, hold: () => Promise.resolve()
    });
    enhancer({ cancel: vi.fn(), formData: new Map([['payout', '5']]) } as any);
    expect(calls).toEqual(['prepare:5', 'markPending']);
  });
});
