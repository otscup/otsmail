const FIELDS = new Set(['from', 'subject', 'to', 'any']);
const OPS = new Set(['contains', 'equals']);
const CATEGORIES = new Set(['primary', 'social', 'promotion', 'updates', 'ads', 'spam']);

export function normalizeFilterRules(raw) {
	let list = raw;
	if (typeof list === 'string') {
		try { list = JSON.parse(list); } catch (e) { list = []; }
	}
	if (!Array.isArray(list)) return [];

	return list
		.filter(rule => rule && typeof rule === 'object')
		.slice(0, 100)
		.map(rule => ({
			field: FIELDS.has(rule.field) ? rule.field : 'any',
			op: OPS.has(rule.op) ? rule.op : 'contains',
			value: String(rule.value || '').trim().slice(0, 200),
			category: CATEGORIES.has(rule.category) ? rule.category : 'primary'
		}))
		.filter(rule => rule.value);
}

export function matchFilterRules(email, raw) {
	const rules = normalizeFilterRules(raw);
	if (rules.length === 0) return null;

	const from = `${email?.from?.name || ''} ${email?.from?.address || ''}`.toLowerCase();
	const subject = String(email?.subject || '').toLowerCase();
	const to = (Array.isArray(email?.to) ? email.to : [])
		.map(item => `${item?.name || ''} ${item?.address || ''}`)
		.join(' ')
		.toLowerCase();
	const any = `${from} ${subject} ${to} ${String(email?.text || '').toLowerCase()}`;

	for (const rule of rules) {
		const haystack = rule.field === 'from' ? from
			: rule.field === 'subject' ? subject
				: rule.field === 'to' ? to
					: any;
		const needle = rule.value.toLowerCase();
		const matched = rule.op === 'equals' ? haystack.trim() === needle : haystack.includes(needle);
		if (matched) return rule.category;
	}

	return null;
}
