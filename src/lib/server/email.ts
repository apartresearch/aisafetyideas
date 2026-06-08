import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

const FROM = env.RESEND_FROM || 'AI Safety Ideas <notifications@aisafetyideas.com>';
let _resend: Resend | null = null;

function client(): Resend {
  if (!env.RESEND_API_KEY) throw new Error('Email not configured (missing RESEND_API_KEY)');
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  await client().emails.send({ from: FROM, to, subject, html });
}

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;color:#3a3f3d;max-width:560px;margin:0 auto;padding:32px 16px">
<h2 style="color:#1a1d1b;margin:0 0 12px">${title}</h2>
${body}
<p style="margin-top:32px;font-size:12px;color:#a0a0a0">AI Safety Ideas · <a href="https://aisafetyideas.com" style="color:#a0a0a0">aisafetyideas.com</a></p>
</body></html>`;
}

function actionLink(url: string, label: string): string {
  const href = url.startsWith('http') ? url : `https://aisafetyideas.com${url}`;
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1a1d1b;color:#fff;text-decoration:none;border-radius:12px;font-size:14px">${label}</a>`;
}

export function tplAnswerSubmitted(p: {
  ideaTitle: string;
  answerTitle: string;
  url: string;
}): { subject: string; html: string } {
  const subject = `New answer submitted: "${p.ideaTitle}"`;
  const html = baseLayout(
    'New answer submitted',
    `<p>An answer titled <strong>${escapeHtml(p.answerTitle)}</strong> was submitted to your idea <strong>${escapeHtml(p.ideaTitle)}</strong>.</p>
${actionLink(p.url, 'Review the answer')}`
  );
  return { subject, html };
}

export function tplDecision(p: {
  ideaTitle: string;
  decision: 'verified' | 'revision_requested' | 'rejected';
  note?: string;
  url: string;
}): { subject: string; html: string } {
  const labels: Record<string, string> = {
    verified: 'Answer verified',
    revision_requested: 'Revision requested on your answer',
    rejected: 'Answer rejected'
  };
  const descriptions: Record<string, string> = {
    verified: `Your answer to <strong>${escapeHtml(p.ideaTitle)}</strong> has been <strong>verified</strong>.`,
    revision_requested: `A revision has been requested on your answer to <strong>${escapeHtml(p.ideaTitle)}</strong>.`,
    rejected: `Your answer to <strong>${escapeHtml(p.ideaTitle)}</strong> has been rejected.`
  };
  const subject = labels[p.decision];
  const noteHtml = p.note
    ? `<p style="margin-top:12px;padding:12px;background:#f5f6f5;border-radius:8px;font-size:14px">${escapeHtml(p.note)}</p>`
    : '';
  const html = baseLayout(
    labels[p.decision],
    `<p>${descriptions[p.decision]}</p>${noteHtml}${actionLink(p.url, 'View idea')}`
  );
  return { subject, html };
}

export function tplQueueItem(p: {
  ideaTitle: string;
  answerTitle: string;
  url: string;
}): { subject: string; html: string } {
  const subject = `Answer ready for review: "${p.ideaTitle}"`;
  const html = baseLayout(
    'Answer ready for review',
    `<p>The answer <strong>${escapeHtml(p.answerTitle)}</strong> for idea <strong>${escapeHtml(p.ideaTitle)}</strong> has been verified and is ready for admin review.</p>
${actionLink(p.url, 'Review now')}`
  );
  return { subject, html };
}

export function tplPayoutReleased(p: {
  ideaTitle: string;
  amountCents: number;
  url: string;
}): { subject: string; html: string } {
  const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    p.amountCents / 100
  );
  const subject = `Payout of ${dollars} released for "${p.ideaTitle}"`;
  const html = baseLayout(
    'Payout released',
    `<p>A payout of <strong>${dollars}</strong> has been released for your answer to <strong>${escapeHtml(p.ideaTitle)}</strong>.</p>
${actionLink(p.url, 'View idea')}`
  );
  return { subject, html };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
