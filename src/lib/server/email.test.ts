import { describe, it, expect, vi, beforeEach } from 'vitest';

// mockSend must be defined before vi.mock factories run (hoisted)
const mockSend = vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null });
vi.mock('resend', () => {
  // Use a real function (not arrow) so `new Resend()` works
  function MockResend(_key: string) {
    return { emails: { send: mockSend } };
  }
  return { Resend: MockResend };
});
vi.mock('$env/dynamic/private', () => ({
  env: { RESEND_API_KEY: 'test-key', RESEND_FROM: undefined }
}));

import {
  sendEmail,
  tplAnswerSubmitted,
  tplDecision,
  tplQueueItem,
  tplPayoutReleased
} from './email';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendEmail', () => {
  it('calls emails.send with the right shape', async () => {
    await sendEmail('a@b.com', 'Subject', '<p>Hello</p>');
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('a@b.com');
    expect(call.subject).toBe('Subject');
    expect(call.html).toBe('<p>Hello</p>');
    expect(call.from).toMatch(/AI Safety Ideas/);
  });

  it('accepts an array of addresses', async () => {
    await sendEmail(['a@b.com', 'c@d.com'], 'S', '<p>H</p>');
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toEqual(['a@b.com', 'c@d.com']);
  });
});

describe('tplAnswerSubmitted', () => {
  it('returns non-empty subject and html with key fields', () => {
    const { subject, html } = tplAnswerSubmitted({
      ideaTitle: 'My Idea',
      answerTitle: 'My Answer',
      url: '/ideas/my-idea'
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('My Idea');
    expect(html).toContain('My Answer');
    expect(html).toContain('/ideas/my-idea');
  });
});

describe('tplDecision', () => {
  it('verified decision contains idea title and url', () => {
    const { subject, html } = tplDecision({
      ideaTitle: 'Test Idea',
      decision: 'verified',
      url: '/ideas/test-idea'
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html).toContain('Test Idea');
    expect(html).toContain('/ideas/test-idea');
    expect(html.toLowerCase()).toContain('verif');
  });

  it('revision_requested decision mentions revision', () => {
    const { subject, html } = tplDecision({
      ideaTitle: 'Test Idea',
      decision: 'revision_requested',
      url: '/ideas/test-idea',
      note: 'Please clarify'
    });
    expect(html).toContain('Please clarify');
    expect(html.toLowerCase()).toMatch(/revision/);
  });

  it('rejected decision mentions rejection', () => {
    const { subject, html } = tplDecision({
      ideaTitle: 'Test Idea',
      decision: 'rejected',
      url: '/ideas/test-idea'
    });
    expect(html.toLowerCase()).toMatch(/reject/);
  });
});

describe('tplQueueItem', () => {
  it('returns non-empty subject and html with key fields', () => {
    const { subject, html } = tplQueueItem({
      ideaTitle: 'Queue Idea',
      answerTitle: 'Queue Answer',
      url: '/ideas/queue-idea'
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html).toContain('Queue Idea');
    expect(html).toContain('Queue Answer');
    expect(html).toContain('/ideas/queue-idea');
  });
});

describe('tplPayoutReleased', () => {
  it('formats amount as dollars', () => {
    const { subject, html } = tplPayoutReleased({
      ideaTitle: 'Paid Idea',
      amountCents: 3000,
      url: '/ideas/paid-idea'
    });
    expect(subject.length).toBeGreaterThan(0);
    expect(html).toContain('$30.00');
    expect(html).toContain('Paid Idea');
    expect(html).toContain('/ideas/paid-idea');
  });

  it('formats large amounts correctly', () => {
    const { html } = tplPayoutReleased({
      ideaTitle: 'Big Idea',
      amountCents: 100000,
      url: '/ideas/big-idea'
    });
    expect(html).toContain('$1,000.00');
  });
});
