import { describe, expect, it } from 'vitest';
import { parseQuotedEmailId } from '../src/service/telegram-service';

describe('Telegram quoted email id', () => {
	it('reads the trailing #id marker', () => {
		expect(parseQuotedEmailId('Subject\n\nbody\n\n#1025')).toBe(1025);
	});

	it('takes the last marker so body text cannot spoof it', () => {
		expect(parseQuotedEmailId('ticket #12\n\nactual mail\n\n#1025')).toBe(1025);
	});

	it('returns null when there is no marker', () => {
		expect(parseQuotedEmailId('hello')).toBe(null);
	});
});
