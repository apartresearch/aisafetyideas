import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = { idea: { id: 'i1', slug: 'idea', title: 'Idea' } };

describe('answer form input binding', () => {
  it('retains typed input across a re-render (the form prop changing must not clobber it)', async () => {
    const { container, rerender } = render(Page, { props: { data, form: null } });
    const title = () => container.querySelector('input[name=title]') as HTMLInputElement;
    await fireEvent.input(title(), { target: { value: 'My answer' } });
    expect(title().value).toBe('My answer');
    // simulate an auth invalidate / validation-error reload handing in a new `form` prop:
    await rerender({ data, form: { message: 'Some error' } });
    // bind:value preserves the user's in-progress text (one-way value= would risk resetting it)
    expect(title().value).toBe('My answer');
  });
});
