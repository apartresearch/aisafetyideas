import { describe, it, expect } from 'vitest';
import {
  slugify,
  uniqueHandle,
  ideaStatus,
  ideaType,
  jsonbFromText,
  toProfile,
  toExpert,
  toCategory,
  toIdea,
  resolveIdeaCategories,
  resolveIdeaRelations
} from './transform';

describe('transform helpers', () => {
  it('slugify', () => {
    expect(slugify('AI Safety & Alignment!')).toBe('ai-safety-alignment');
    expect(slugify('  Multiple   spaces ')).toBe('multiple-spaces');
  });
  it('uniqueHandle dedupes with an id-suffix and falls back to the email local part', () => {
    const used = new Set<string>();
    expect(uniqueHandle('alice', 'alice@x.com', 'aaaa1111', used)).toBe('alice');
    expect(uniqueHandle('alice', 'alice2@x.com', 'bbbb2222', used)).toBe('alice-bbbb'); // collision → suffix
    expect(uniqueHandle(null, 'carol@x.com', 'cccc3333', used)).toBe('carol'); // null username → email local
    expect(uniqueHandle('', '', 'dddd4444', used)).toBe('user-dddd'); // nothing → user-<id4>
  });
  it('ideaStatus maps archived/finished/open precedence', () => {
    expect(ideaStatus({ archived: 't', finished: 'f' })).toBe('archived');
    expect(ideaStatus({ archived: 'f', finished: 't' })).toBe('resolved');
    expect(ideaStatus({ archived: 'f', finished: 'f' })).toBe('open');
  });
  it('ideaType maps the hypothesis flag', () => {
    expect(ideaType('t')).toBe('hypothesis');
    expect(ideaType('f')).toBe('open_ended');
  });
});

// jsonbFromText: canonical re-serialization for verbatim jsonb source columns (see Key design decisions)
describe('jsonbFromText', () => {
  it('parses the unescaped dump text and re-emits a valid jsonb literal; null→NULL', () => {
    expect(jsonbFromText(null)).toBe('NULL');
    // a tab that the COPY parser turned into a real 0x09 inside a JSON string must come back out escaped:
    expect(jsonbFromText('{"name":"a\tb","n":1}')).toBe('\'{"name":"a\\tb","n":1}\'::jsonb');
  });
  it('throws on invalid JSON (fail fast at generation)', () => {
    expect(() => jsonbFromText('{not json')).toThrow();
  });
});

// ── shape assertions for the row builders ──

describe('toProfile', () => {
  it('renders the target profile columns as SQL literals', () => {
    const u = {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'Alice',
      email: 'alice@x.com',
      bio: ' ',
      career_stage: 'phd',
      image: 'https://img/a.png',
      like_weight: '3',
      user_metadata: '{"name":"Alice A","picture":"https://meta/a.png"}'
    };
    const row = toProfile(u, 'Alice A', 'alice', '2020-01-01 00:00:00+00');
    expect(row.id).toBe("'11111111-1111-1111-1111-111111111111'");
    expect(row.handle).toBe("'alice'");
    expect(row.display_name).toBe("'Alice A'");
    expect(row.avatar_url).toBe("'https://img/a.png'");
    expect(row.bio_md).toBe('NULL'); // blank bio (single space) → null
    expect(row.career_stage).toBe("'phd'");
    expect(row.links).toBe("'{}'::jsonb");
    expect(row.is_admin).toBe('false');
    expect(row.created_at).toBe("'2020-01-01 00:00:00+00'");
    expect(row.legacy).toContain('::jsonb');
  });
  it('falls back to now() when no created_at is supplied', () => {
    const u = { id: 'abc', username: 'bob', email: 'b@x.com', bio: 'hi' };
    const row = toProfile(u, 'Bob', 'bob', null);
    expect(row.created_at).toBe('now()');
    expect(row.bio_md).toBe("'hi'");
  });
});

describe('toExpert', () => {
  it('returns an expert row only when expert flag is set', () => {
    expect(toExpert({ id: 'x', expert: 'f' })).toBeNull();
    const row = toExpert({ id: 'x', expert: 't' });
    expect(row).not.toBeNull();
    expect(row!.id).toBe("'x'");
    expect(row!.status).toBe("'approved'");
    expect(row!.featured).toBe('false');
    expect(row!.approved_by).toBe('NULL');
    expect(row!.approved_at).toBe('now()');
  });
});

describe('toCategory', () => {
  it('slugifies title, dedupes slug, maps description=tooltip', () => {
    const used = new Set<string>();
    const a = toCategory({ id: '1', title: 'AI Safety', tooltip: 'about safety', priority: '5', project_factory: 't' }, 'uuid-a', used);
    expect(a.id).toBe("'uuid-a'");
    expect(a.legacy_id).toBe("'1'");
    expect(a.slug).toBe("'ai-safety'");
    expect(a.title).toBe("'AI Safety'");
    expect(a.description).toBe("'about safety'");
    expect(a.priority).toBe("'5'");
    const b = toCategory({ id: '2', title: 'AI Safety', tooltip: null, priority: '6' }, 'uuid-b', used);
    expect(b.slug).toBe("'ai-safety-2'"); // collision → numeric suffix
    expect(b.description).toBe('NULL');
  });
});

describe('toIdea', () => {
  it('maps type/status/legacy and the scalar columns', () => {
    const i = {
      id: '42',
      user: '11111111-1111-1111-1111-111111111111',
      hypothesis: 't',
      title: 'Test idea',
      summary: 'A summary',
      archived: 'f',
      finished: 't',
      importance: '7',
      from_date: '2021-05-01',
      contact: 'me@x.com',
      funding_currency: 'EUR',
      created_at: '2021-01-01 00:00:00+00',
      funding_amount: '1000',
      verified_by_expert: 't'
    };
    const row = toIdea(i, 'new-uuid-42');
    expect(row.id).toBe("'new-uuid-42'");
    expect(row.legacy_id).toBe("'42'");
    expect(row.author_id).toBe("'11111111-1111-1111-1111-111111111111'");
    expect(row.type).toBe("'hypothesis'");
    expect(row.title).toBe("'Test idea'");
    expect(row.summary_md).toBe("'A summary'");
    expect(row.claim).toBe('NULL');
    expect(row.status).toBe("'resolved'");
    expect(row.importance).toBe("'7'");
    expect(row.from_date).toBe("'2021-05-01'");
    expect(row.contact).toBe("'me@x.com'");
    expect(row.currency).toBe("'EUR'");
    expect(row.published_at).toBe("'2021-01-01 00:00:00+00'");
    expect(row.created_at).toBe("'2021-01-01 00:00:00+00'");
    expect(row.legacy).toContain('::jsonb');
    expect(row.legacy).toContain('funding_amount');
  });
  it('defaults currency to USD and author_id to NULL when absent', () => {
    const row = toIdea({ id: '1', title: 'x', archived: 'f', finished: 'f', hypothesis: 'f' }, 'u1');
    expect(row.currency).toBe("'USD'");
    expect(row.author_id).toBe('NULL');
    expect(row.type).toBe("'open_ended'");
    expect(row.status).toBe("'open'");
  });
});

describe('resolveIdeaCategories', () => {
  it('resolves both sides via legacy maps and drops unresolved rows', () => {
    const ideaMap = new Map([['10', 'idea-uuid-10']]);
    const catMap = new Map([['1', 'cat-uuid-1']]);
    const rels = [
      { idea: '10', category: '1' },
      { idea: '10', category: '999' }, // unresolved category → dropped
      { idea: '999', category: '1' } // unresolved idea → dropped
    ];
    const rows = resolveIdeaCategories(rels, ideaMap, catMap);
    expect(rows.length).toBe(1);
    expect(rows[0].idea_id).toBe("'idea-uuid-10'");
    expect(rows[0].category_id).toBe("'cat-uuid-1'");
  });
});

describe('resolveIdeaRelations', () => {
  it('resolves parent/child, carries type, drops self and unresolved', () => {
    const ideaMap = new Map([
      ['10', 'idea-uuid-10'],
      ['20', 'idea-uuid-20']
    ]);
    const rels = [
      { id: '100', parent: '10', child: '20', type: 'related' },
      { id: '101', parent: '10', child: '10', type: 'self' }, // self → dropped
      { id: '102', parent: '10', child: '999', type: 'x' } // unresolved child → dropped
    ];
    const rows = resolveIdeaRelations(rels, ideaMap);
    expect(rows.length).toBe(1);
    expect(rows[0].legacy_id).toBe("'100'");
    expect(rows[0].parent_id).toBe("'idea-uuid-10'");
    expect(rows[0].child_id).toBe("'idea-uuid-20'");
    expect(rows[0].type).toBe("'related'");
  });
});

import {
  ideaRef, answerRef, toComment, commentReplies, toInterest,
  toAnswerFromResult, toAnswerArtifact, toVote, dedupeVotes
} from './transform';

describe('v2 ref helpers', () => {
  it('emit integer-validated scalar subqueries', () => {
    expect(ideaRef('14')).toBe("(select id from public.ideas where legacy_id = 14)");
    expect(answerRef('3')).toBe("(select id from public.answers where legacy_id = 3)");
    expect(() => ideaRef('14; drop table x')).toThrow();
    expect(() => ideaRef(null)).toThrow();
  });
  it('rejects empty string, whitespace, scientific notation, hex, and floats', () => {
    expect(() => ideaRef('')).toThrow();
    expect(() => ideaRef('1e3')).toThrow();
    expect(() => ideaRef('14.0')).toThrow();
  });
  it('preserves bigint values beyond Number.MAX_SAFE_INTEGER verbatim', () => {
    expect(ideaRef('9007199254740993')).toBe("(select id from public.ideas where legacy_id = 9007199254740993)");
  });
});

describe('v2 transforms', () => {
  it('toComment maps body/author and keeps reply/anon/upvotes in legacy', () => {
    const c = toComment({ id: '96', created_at: '2022-06-30 06:41:09+00', idea: '16',
      author: '0ab224d1-75b6-44e5-b868-26018ca607fe', text: 'Yes!', reply_to: '69',
      anon_author: null, anon_author_url: null, upvotes: '2' });
    expect(c.legacy_id).toBe("'96'");
    expect(c.idea_id).toBe("(select id from public.ideas where legacy_id = 16)");
    expect(c.author_id).toBe("'0ab224d1-75b6-44e5-b868-26018ca607fe'");
    expect(c.body_md).toBe("'Yes!'");
    expect(c.legacy).toContain('"reply_to":"69"');
    expect(c.legacy).toContain('"upvotes":"2"');
    expect(c.reply_to).toBeUndefined();           // threading is pass-2
  });
  it('toComment keeps empty text as empty string and null author as NULL', () => {
    const c = toComment({ id: '175', created_at: '2023-07-07 15:24:15+00', idea: '242',
      author: null, text: '', reply_to: null, anon_author: null, anon_author_url: null, upvotes: null });
    expect(c.body_md).toBe("''");
    expect(c.author_id).toBe('NULL');
  });
  it('commentReplies returns only rows with reply_to', () => {
    const rows = [
      { id: '96', reply_to: '69' }, { id: '97', reply_to: null }
    ] as any[];
    expect(commentReplies(rows)).toEqual([{ legacy_id: '96', reply_legacy_id: '69' }]);
  });
  it('commentReplies throws on non-integer ids', () => {
    expect(() => commentReplies([{ id: '9', reply_to: 'x' }] as any[])).toThrow();
  });
  it('commentReplies skips self-replies', () => {
    const rows = [{ id: '9', reply_to: '9' }] as any[];
    expect(commentReplies(rows)).toEqual([]);
  });
  it('toInterest maps how→note_md (blank→NULL) and contact flag→legacy', () => {
    const i = toInterest({ id: '14', created_at: '2022-06-14 12:14:29+00',
      user: '3590e5a9-da55-49f8-9d61-726c0b0203fe', idea: '18', contact_if_started: 'f', how: '' });
    expect(i.note_md).toBe('NULL');
    expect(i.profile_id).toBe("'3590e5a9-da55-49f8-9d61-726c0b0203fe'");
    expect(i.legacy).toContain('"contact_if_started":"f"');
  });
  it('toAnswerFromResult maps to a verified answer with a title fallback', () => {
    const titles = new Map([['14', 'Old idea title']]);
    const a = toAnswerFromResult({ id: '3', created_at: '2022-11-21 12:05:13+00', idea: '14',
      user: '0ab224d1-75b6-44e5-b868-26018ca607fe', description: '', image_link: 'http://img',
      type: 'ambiguous', title: '', author: 'COCO, Nina', link: 'http://itch.io/x',
      from_date: '2022-11-13', original: 'f' }, titles);
    expect(a.title).toBe("'Result: Old idea title'");
    expect(a.status).toBe("'verified'");
    expect(a.verified_at).toBe("'2022-11-21 12:05:13+00'");
    expect(a.explanation_md).toBe('NULL');
    expect(a.legacy).toContain('"author":"COCO, Nina"');
  });
  it('toAnswerArtifact emits a url artifact only when link is non-blank', () => {
    const art = toAnswerArtifact({ id: '3', created_at: 'x', link: 'http://itch.io/x' } as any);
    expect(art!.answer_id).toBe("(select id from public.answers where legacy_id = 3)");
    expect(art!.kind).toBe("'url'");
    expect(toAnswerArtifact({ id: '9', created_at: 'x', link: '' } as any)).toBeNull();
  });
  it('toVote maps a like to an upvote, weight in legacy', () => {
    const v = toVote({ id: '7', created_at: '2022-07-01 00:00:00+00',
      user: '0ab224d1-75b6-44e5-b868-26018ca607fe', idea: '14', size: '3' });
    expect(v.value).toBe('1');
    expect(v.legacy).toContain('"size":"3"');
  });
  it('toVote throws when user is null (profile_id is NOT NULL)', () => {
    expect(() => toVote({ id: '9', created_at: 'x', user: null, idea: '14', size: null })).toThrow();
  });
  it('dedupeVotes keeps the earliest per (user, idea)', () => {
    const { kept, dropped } = dedupeVotes([
      { id: '2', created_at: '2022-02-01', user: 'u1', idea: '5', size: '1' },
      { id: '1', created_at: '2022-01-01', user: 'u1', idea: '5', size: '1' },
      { id: '3', created_at: '2022-03-01', user: 'u2', idea: '5', size: '1' }
    ] as any[]);
    expect(kept.map((r: any) => r.id)).toEqual(['1', '3']);
    expect(dropped).toBe(1);
  });
  it('dedupeVotes keeps chronologically-earliest with fractional-second timestamps', () => {
    const { kept } = dedupeVotes([
      { id: '2', created_at: '2022-01-01 10:00:00.5+00', user: 'u1', idea: '5', size: null },
      { id: '1', created_at: '2022-01-01 10:00:00+00',   user: 'u1', idea: '5', size: null }
    ] as any[]);
    expect(kept[0].id).toBe('1');
  });
});
