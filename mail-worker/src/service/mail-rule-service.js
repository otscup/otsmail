const CATEGORIES = new Set(['primary', 'social', 'promotion', 'updates', 'ads', 'spam', 'important']);

const mailRuleService = {
	normalize(category) {
		return CATEGORIES.has(category) ? category : 'primary';
	},

	async categoryFor(env, userId, sender, subject = '') {
		if (!env?.db || !userId || !sender) return '';
		const from = String(sender).toLowerCase();
		try {
			// 带关键词的规则优先；同发件人下关键词越长越具体
			const keywordRow = await env.db.prepare(`
				SELECT category FROM user_mail_rule_kw
				WHERE user_id = ? AND sender = ? AND instr(lower(?), keyword) > 0
				ORDER BY length(keyword) DESC LIMIT 1
			`).bind(Number(userId), from, String(subject).toLowerCase()).first();
			if (CATEGORIES.has(keywordRow?.category)) return keywordRow.category;

			const row = await env.db.prepare(
				'SELECT category FROM user_mail_rule WHERE user_id = ? AND sender = ? LIMIT 1'
			).bind(Number(userId), from).first();
			return CATEGORIES.has(row?.category) ? row.category : '';
		} catch {
			return '';
		}
	},

	async learn(c, userId, sender, category, keyword = '') {
		const value = this.normalize(category);
		const from = String(sender).toLowerCase();
		const key = String(keyword || '').trim().toLowerCase();
		if (key) {
			await c.env.db.prepare(`
				INSERT INTO user_mail_rule_kw (user_id, sender, keyword, category, updated_at)
				VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id, sender, keyword) DO UPDATE SET category = excluded.category, updated_at = CURRENT_TIMESTAMP
			`).bind(userId, from, key, value).run();
		} else {
			await c.env.db.prepare(`
				INSERT INTO user_mail_rule (user_id, sender, category, updated_at)
				VALUES (?, ?, ?, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id, sender) DO UPDATE SET category = excluded.category, updated_at = CURRENT_TIMESTAMP
			`).bind(userId, from, value).run();
		}
		return value;
	}
};

export default mailRuleService;
