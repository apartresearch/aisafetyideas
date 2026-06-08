import type { SupabaseClient } from '@supabase/supabase-js';

export type Balances = {
	availableCents: number;
	escrowedCents: number;
	payableCents: number;
};

export type LedgerEntry = {
	id: string;
	createdAt: string;
	kind: string;
	account: string;
	amountCents: number;
	currency: string;
	note: string | null;
};

/**
 * Read the account_balances view for a single profile.
 * Returns all-zero if the profile has no ledger entries yet.
 */
export async function getBalances(
	supabase: SupabaseClient,
	profileId: string
): Promise<Balances> {
	const { data } = await supabase
		.from('account_balances')
		.select('available_cents, escrowed_cents, payable_cents')
		.eq('profile_id', profileId)
		.maybeSingle();

	if (!data) {
		return { availableCents: 0, escrowedCents: 0, payableCents: 0 };
	}

	return {
		availableCents: data.available_cents,
		escrowedCents: data.escrowed_cents,
		payableCents: data.payable_cents
	};
}

/**
 * Read ledger_entries for a single profile, newest first.
 * RLS on the view ensures the caller only sees their own rows.
 */
export async function getLedger(
	supabase: SupabaseClient,
	profileId: string
): Promise<LedgerEntry[]> {
	const { data } = await supabase
		.from('ledger_entries')
		.select('id, created_at, kind, account, amount_cents, currency, note')
		.eq('profile_id', profileId)
		.order('created_at', { ascending: false });

	if (!data) return [];

	return data.map((row) => ({
		id: row.id,
		createdAt: row.created_at,
		kind: row.kind,
		account: row.account,
		amountCents: row.amount_cents,
		currency: row.currency,
		note: row.note
	}));
}
