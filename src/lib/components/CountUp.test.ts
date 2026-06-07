import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import CountUp from './CountUp.svelte';

describe('CountUp', () => {
  it('reduced=true renders the final amount immediately (no count)', () => {
    const { container } = render(CountUp, { props: { cents: 3712, reduced: true } });
    expect(container.textContent).toContain('$37.12');
  });
  it('reduced=false starts below the target and animates up to it', async () => {
    const { container } = render(CountUp, { props: { cents: 3712, reduced: false } });
    const value = () => container.querySelector('[data-countup-value]')?.textContent ?? '';
    expect(value()).toBe('$0.00');
    await waitFor(() => expect(value()).toBe('$37.12'), { timeout: 1500 });
  });
  it('reserves the final width with an aria-hidden sizer to avoid reflow', () => {
    const { container } = render(CountUp, { props: { cents: 100000, reduced: true } });
    const sizer = container.querySelector('[aria-hidden="true"]');
    expect(sizer?.textContent).toBe('$1,000.00');
  });
});
