import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VerifySeal from './VerifySeal.svelte';

describe('VerifySeal', () => {
  it('renders the check fully drawn in the static (play=false) state', () => {
    const { container } = render(VerifySeal, { props: { play: false, tone: 'verified' } });
    expect(container.querySelector('path')?.getAttribute('style')).toContain('stroke-dashoffset: 0');
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('var(--green)');
  });
  it('reduced=true also renders drawn immediately even with play=true', () => {
    const { container } = render(VerifySeal, { props: { play: true, reduced: true, tone: 'verified' } });
    expect(container.querySelector('path')?.getAttribute('style')).toContain('stroke-dashoffset: 0');
  });
  it('renders a neg ✕ for tone=rejected, never green', () => {
    const { container } = render(VerifySeal, { props: { play: false, tone: 'rejected' } });
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('none');
    expect(container.innerHTML).not.toContain('var(--green)');
    expect(container.innerHTML).toContain('var(--neg)');
  });
});
