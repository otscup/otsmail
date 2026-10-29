import { describe, expect, it } from 'vitest';
import { matchFilterRules, normalizeFilterRules } from '../src/utils/filter-rules.js';

const email = {
	from: { name: 'Alice', address: 'alice@example.com' },
	to: [{ address: 'me@example.com' }],
	subject: 'Weekly invoice',
	text: 'hello from alice'
};

describe('filter rules', () => {
	it('normalizes invalid entries and caps length', () => {
		expect(normalizeFilterRules('not-json')).toEqual([]);
		expect(normalizeFilterRules([{ field: 'bad', op: 'bad', value: ' x ', category: 'bad' }]))
			.toEqual([{ field: 'any', op: 'contains', value: 'x', category: 'primary' }]);
		expect(normalizeFilterRules([{ value: '' }])).toEqual([]);
	});

	it('matches from/subject/to', () => {
		const rules = [
			{ field: 'from', op: 'contains', value: 'alice', category: 'social' },
			{ field: 'subject', op: 'equals', value: 'weekly invoice', category: 'promotion' },
			{ field: 'to', op: 'contains', value: 'me@example.com', category: 'updates' }
		];
		expect(matchFilterRules(email, rules)).toBe('social');
		expect(matchFilterRules(email, [rules[1]])).toBe('promotion');
		expect(matchFilterRules(email, [rules[2]])).toBe('updates');
	});

	it('returns null when nothing matches', () => {
		expect(matchFilterRules(email, [{ field: 'from', op: 'contains', value: 'bob', category: 'spam' }])).toBeNull();
	});
});
