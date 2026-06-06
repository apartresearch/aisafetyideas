/**
 * Restore-v2 CLI — comments / interest / results→answers(+artifacts) / likes→votes.
 * Prints COUNTS only (never row contents) — backup + generated SQL contain PII (gitignored).
 *
 * Usage: `npm run etl:restore-v2 [path/to/backup]`
 * (Controller-only against the real backup; subagents use synthetic fixtures.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCopyBlock } from './parse-dump';
import * as t from './transform';
import { buildDocumentV2 } from './emit';

const BACKUP = process.argv[2] ?? `${process.env.HOME}/Downloads/db_cluster-16-10-2025@02-48-41.backup`;
const OUT = new URL('./restore-v2.generated.sql', import.meta.url).pathname;

function main() {
  const dump = readFileSync(BACKUP, 'utf8');

  const commentsRaw = parseCopyBlock(dump, 'public.comments').rows;
  const interestRaw = parseCopyBlock(dump, 'public.idea_user_interest_relation').rows;
  const resultsRaw = parseCopyBlock(dump, 'public.results').rows;
  const likesRaw = parseCopyBlock(dump, 'public.idea_user_likes').rows;
  const ideasRaw = parseCopyBlock(dump, 'public.ideas').rows;   // only for the answer-title fallback

  const titles = new Map<string, string>();
  for (const i of ideasRaw) if (i.id && i.title) titles.set(i.id, i.title);

  const comments = commentsRaw.map((c) => t.toComment(c));
  const replies = t.commentReplies(commentsRaw);
  const interest = interestRaw.map((r) => t.toInterest(r));
  const answers = resultsRaw.map((r) => t.toAnswerFromResult(r, titles));
  const artifacts = resultsRaw.map((r) => t.toAnswerArtifact(r)).filter((a): a is NonNullable<typeof a> => a !== null);
  const { kept, dropped } = t.dedupeVotes(likesRaw);
  const votes = kept.map((l) => t.toVote(l));

  writeFileSync(OUT, buildDocumentV2({ comments, replies, interest, answers, artifacts, votes }), 'utf8');

  // COUNTS ONLY — never row contents (PII discipline).
  console.log(
    `wrote ${OUT}: comments=${comments.length} replies=${replies.length} interest=${interest.length} ` +
      `answers=${answers.length} artifacts=${artifacts.length} votes=${votes.length} (deduped ${dropped})`
  );
}

main();
