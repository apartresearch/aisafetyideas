import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import IdeaTemplateSections from './IdeaTemplateSections.svelte';

describe('IdeaTemplateSections', () => {
	it('renders exactly two sections when two of four props are non-empty', () => {
		const { container } = render(IdeaTemplateSections, {
			props: {
				resolution_criteria_html: '<p>criteria here</p>',
				methodology_html: '<p>method here</p>',
				theory_of_change_html: '',
				extensions_html: '',
			},
		});
		const sections = container.querySelectorAll('section.tpl-section');
		expect(sections.length).toBe(2);
	});

	it('renders all four sections when all are non-empty', () => {
		const { container } = render(IdeaTemplateSections, {
			props: {
				resolution_criteria_html: '<p>a</p>',
				methodology_html: '<p>b</p>',
				theory_of_change_html: '<p>c</p>',
				extensions_html: '<p>d</p>',
			},
		});
		const sections = container.querySelectorAll('section.tpl-section');
		expect(sections.length).toBe(4);
	});

	it('renders nothing when all props are empty', () => {
		const { container } = render(IdeaTemplateSections, {
			props: {},
		});
		const sections = container.querySelectorAll('section.tpl-section');
		expect(sections.length).toBe(0);
	});

	it('renders nothing when props are all whitespace', () => {
		const { container } = render(IdeaTemplateSections, {
			props: {
				resolution_criteria_html: '   ',
				methodology_html: '\t',
				theory_of_change_html: '\n',
				extensions_html: '  ',
			},
		});
		const sections = container.querySelectorAll('section.tpl-section');
		expect(sections.length).toBe(0);
	});

	it('shows the correct uppercase labels for present sections', () => {
		const { container } = render(IdeaTemplateSections, {
			props: {
				theory_of_change_html: '<p>toc content</p>',
			},
		});
		const heading = container.querySelector('.u-label.tpl-section__heading');
		expect(heading?.textContent).toBe('Theory of Change');
	});
});
