import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/service/setting-service', () => ({
	default: { query: vi.fn() }
}));

import settingService from '../src/service/setting-service';
import aiService from '../src/service/ai-service';

describe('AI provider', () => {
	beforeEach(() => {
		settingService.query.mockReset();
		settingService.query.mockResolvedValue({});
		global.fetch = vi.fn();
	});

	it('fetches and sorts models from an OpenAI-compatible endpoint', async () => {
		global.fetch.mockResolvedValue(new Response(JSON.stringify({
			data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'a-model' }]
		}), { status: 200 }));

		const data = await aiService.listModels({}, { baseUrl: 'https://api.test/v1/', apiKey: 'sk-test' });

		expect(data.models).toEqual(['a-model', 'z-model']);
		expect(global.fetch).toHaveBeenCalledWith('https://api.test/v1/models', {
			headers: { Authorization: 'Bearer sk-test' }
		});
	});

	it('uses the stored key when the form sends a masked placeholder', async () => {
		settingService.query.mockResolvedValue({ aiBaseUrl: 'https://api.test/v1', aiApiKey: 'sk-real' });
		global.fetch.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200 }));

		await aiService.listModels({}, { apiKey: 'sk-real******' });

		expect(global.fetch).toHaveBeenCalledWith('https://api.test/v1/models', {
			headers: { Authorization: 'Bearer sk-real' }
		});
	});

	it('rejects when the URL or key is missing', async () => {
		await expect(aiService.listModels({}, {})).rejects.toThrow('AI 接口地址');
	});

	it('uses the configured OpenAI-compatible chat endpoint', async () => {
		settingService.query.mockResolvedValue({
			aiBaseUrl: 'https://api.test/v1', aiApiKey: 'sk-test', aiModel: 'test-model'
		});
		global.fetch.mockResolvedValue(new Response(JSON.stringify({
			choices: [{ message: { content: ' hello ' } }]
		}), { status: 200 }));

		const text = await aiService.runAi({ env: {} }, { system: 'sys', user: 'hi' });

		expect(text).toBe('hello');
		expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/v1/chat/completions');
	});

	it('falls back to Workers AI when no provider is configured', async () => {
		const run = vi.fn().mockResolvedValue({ response: 'fallback' });
		const c = { env: { ai: { run } } };

		const text = await aiService.runAi(c, { system: 'sys', user: 'hi' });

		expect(text).toBe('fallback');
		expect(run).toHaveBeenCalled();
	});
});
