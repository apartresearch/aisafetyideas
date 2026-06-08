import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EarningsStat from './EarningsStat.svelte';

describe('EarningsStat', () => {
  it('renders lifetime earnings and payout count when lifetimeCents > 0', () => {
    const { container } = render(EarningsStat, {
      props: { lifetimeCents: 3000, payoutCount: 2 }
    });
    const amountEl = container.querySelector('[data-testid="lifetime-amount"]');
    const countEl = container.querySelector('[data-testid="payout-count"]');
    // Should contain formatted $30.00
    expect(amountEl?.textContent).toContain('$30.00');
    expect(countEl?.textContent).toBe('2');
  });

  it('renders nothing when lifetimeCents = 0', () => {
    const { container } = render(EarningsStat, {
      props: { lifetimeCents: 0, payoutCount: 0 }
    });
    expect(container.querySelector('[data-testid="earnings-stat"]')).toBeNull();
  });

  it('formats large amounts correctly', () => {
    const { container } = render(EarningsStat, {
      props: { lifetimeCents: 100000, payoutCount: 5 }
    });
    const amountEl = container.querySelector('[data-testid="lifetime-amount"]');
    const countEl = container.querySelector('[data-testid="payout-count"]');
    expect(amountEl?.textContent).toContain('$1,000.00');
    expect(countEl?.textContent).toBe('5');
  });
});
