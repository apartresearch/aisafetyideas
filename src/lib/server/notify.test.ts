import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these run BEFORE the vi.mock factory (which is hoisted to top)
const { mockRpc, mockFrom, mockSendEmail } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue(undefined)
}));

// ── mock system-client ──────────────────────────────────────────────────────
vi.mock('$lib/server/system-client', () => ({
  getSystemClient: vi.fn().mockResolvedValue({
    rpc: mockRpc,
    from: mockFrom
  })
}));

// ── mock email module (spy on sendEmail, keep real tpl* functions) ──────────
vi.mock('$lib/server/email', async (importOriginal) => {
  const real = await importOriginal<typeof import('./email')>();
  return { ...real, sendEmail: mockSendEmail };
});

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import {
  notifyAnswerSubmitted,
  notifyDecision,
  notifyQueueItem,
  notifyPayoutReleased
} from './notify';

// Helper: set up mockRpc to return the given email
function setupEmail(email: string | null) {
  mockRpc.mockResolvedValue({ data: email, error: null });
}

// Helper: set up admin list + emails
function setupAdmins(adminEmails: string[]) {
  // from('profiles').select('id').eq('is_admin', true) → [{id: 'a1'}, ...]
  const adminRows = adminEmails.map((_, i) => ({ id: `admin-${i}` }));
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: adminRows, error: null })
    })
  });
  // Each rpc call (lookup_notification_email) returns successive emails
  adminEmails.forEach((email, i) => {
    mockRpc.mockResolvedValueOnce({ data: email, error: null });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: rpc lookup returns null (no email)
  mockRpc.mockResolvedValue({ data: null, error: null });
});

const baseParams = {
  ideaTitle: 'Test Idea',
  answerTitle: 'Test Answer',
  url: '/ideas/test-idea'
};

describe('notifyAnswerSubmitted', () => {
  it('calls sendEmail with the owner email when found', async () => {
    setupEmail('owner@example.com');
    await notifyAnswerSubmitted('owner-id', baseParams);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const [to, subject] = mockSendEmail.mock.calls[0];
    expect(to).toBe('owner@example.com');
    expect(typeof subject).toBe('string');
    expect(subject.length).toBeGreaterThan(0);
  });

  it('does NOT call sendEmail when emailFor returns null', async () => {
    setupEmail(null);
    await notifyAnswerSubmitted('owner-id', baseParams);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('swallows errors (resolves without throwing)', async () => {
    mockRpc.mockRejectedValue(new Error('DB down'));
    await expect(notifyAnswerSubmitted('owner-id', baseParams)).resolves.toBeUndefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyDecision', () => {
  it('calls sendEmail with submitter email for verified', async () => {
    setupEmail('submitter@example.com');
    await notifyDecision('submitter-id', { ...baseParams, decision: 'verified' });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const [to] = mockSendEmail.mock.calls[0];
    expect(to).toBe('submitter@example.com');
  });

  it('calls sendEmail for revision_requested', async () => {
    setupEmail('submitter@example.com');
    await notifyDecision('submitter-id', {
      ideaTitle: 'Idea',
      decision: 'revision_requested',
      url: '/ideas/idea'
    });
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('calls sendEmail for rejected', async () => {
    setupEmail('submitter@example.com');
    await notifyDecision('submitter-id', {
      ideaTitle: 'Idea',
      decision: 'rejected',
      url: '/ideas/idea'
    });
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('does NOT call sendEmail when emailFor returns null', async () => {
    setupEmail(null);
    await notifyDecision('submitter-id', { ...baseParams, decision: 'verified' });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mockRpc.mockRejectedValue(new Error('fail'));
    await expect(
      notifyDecision('submitter-id', { ...baseParams, decision: 'rejected' })
    ).resolves.toBeUndefined();
  });
});

describe('notifyQueueItem', () => {
  it('calls sendEmail to all admin emails', async () => {
    setupAdmins(['admin1@example.com', 'admin2@example.com']);
    await notifyQueueItem(baseParams);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const [to] = mockSendEmail.mock.calls[0];
    expect(to).toEqual(['admin1@example.com', 'admin2@example.com']);
  });

  it('does NOT call sendEmail when no admins found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      })
    });
    await notifyQueueItem(baseParams);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('fail'))
      })
    });
    await expect(notifyQueueItem(baseParams)).resolves.toBeUndefined();
  });
});

describe('notifyPayoutReleased', () => {
  it('calls sendEmail with winner email and payout amount', async () => {
    setupEmail('winner@example.com');
    await notifyPayoutReleased('winner-id', {
      ideaTitle: 'Prize Idea',
      amountCents: 3000,
      url: '/ideas/prize-idea'
    });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const [to, subject, html] = mockSendEmail.mock.calls[0];
    expect(to).toBe('winner@example.com');
    expect(html).toContain('$30.00');
  });

  it('does NOT call sendEmail when emailFor returns null', async () => {
    setupEmail(null);
    await notifyPayoutReleased('winner-id', {
      ideaTitle: 'Idea',
      amountCents: 1000,
      url: '/ideas/idea'
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mockRpc.mockRejectedValue(new Error('fail'));
    await expect(
      notifyPayoutReleased('winner-id', { ideaTitle: 'I', amountCents: 100, url: '/i' })
    ).resolves.toBeUndefined();
  });
});
