// Best-effort notification helpers - NEVER throw into the caller.
// Each exported function catches all errors internally.
import { getSystemClient } from './system-client';
import {
  sendEmail,
  tplAnswerSubmitted,
  tplDecision,
  tplQueueItem,
  tplPayoutReleased
} from './email';

async function emailFor(profileId: string): Promise<string | null> {
  try {
    const sys = await getSystemClient();
    const { data } = await sys.rpc('lookup_notification_email', { p_profile: profileId });
    return (data as string) ?? null;
  } catch {
    return null;
  }
}

async function adminEmails(): Promise<string[]> {
  try {
    const sys = await getSystemClient();
    const { data: admins } = await sys
      .from('profiles')
      .select('id')
      .eq('is_admin', true);
    const out: string[] = [];
    for (const a of admins ?? []) {
      const e = await emailFor((a as { id: string }).id);
      if (e) out.push(e);
    }
    return out;
  } catch {
    return [];
  }
}

export async function notifyAnswerSubmitted(
  ownerId: string,
  p: { ideaTitle: string; answerTitle: string; url: string }
): Promise<void> {
  try {
    const to = await emailFor(ownerId);
    if (to) {
      const { subject, html } = tplAnswerSubmitted(p);
      await sendEmail(to, subject, html);
    }
  } catch (e) {
    console.error('notifyAnswerSubmitted failed', e);
  }
}

export async function notifyDecision(
  submitterId: string,
  p: {
    ideaTitle: string;
    decision: 'verified' | 'revision_requested' | 'rejected';
    note?: string;
    url: string;
  }
): Promise<void> {
  try {
    const to = await emailFor(submitterId);
    if (to) {
      const { subject, html } = tplDecision(p);
      await sendEmail(to, subject, html);
    }
  } catch (e) {
    console.error('notifyDecision failed', e);
  }
}

export async function notifyQueueItem(p: {
  ideaTitle: string;
  answerTitle: string;
  url: string;
}): Promise<void> {
  try {
    const to = await adminEmails();
    if (to.length) {
      const { subject, html } = tplQueueItem(p);
      await sendEmail(to, subject, html);
    }
  } catch (e) {
    console.error('notifyQueueItem failed', e);
  }
}

export async function notifyPayoutReleased(
  winnerId: string,
  p: { ideaTitle: string; amountCents: number; url: string }
): Promise<void> {
  try {
    const to = await emailFor(winnerId);
    if (to) {
      const { subject, html } = tplPayoutReleased(p);
      await sendEmail(to, subject, html);
    }
  } catch (e) {
    console.error('notifyPayoutReleased failed', e);
  }
}
