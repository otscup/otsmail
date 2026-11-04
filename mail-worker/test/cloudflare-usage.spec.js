import { beforeEach, describe, expect, it, vi } from 'vitest';
import cloudflareService from '../src/service/cloudflare-service';

function response(data) {
	return new Response(JSON.stringify({ data }), { status: 200 });
}

describe('Cloudflare account usage', () => {
	let c;

	beforeEach(() => {
		c = {
			env: {
				CF_ANALYTICS_TOKEN: 'token',
				CF_ACCOUNT_ID: 'account',
				kv: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) }
			}
		};
		global.fetch = vi.fn();
	});

	it('is disabled when the token is missing', async () => {
		delete c.env.CF_ANALYTICS_TOKEN;
		await expect(cloudflareService.usage(c)).resolves.toEqual({ configured: false });
	});

	it('aggregates apps, D1, DO and R2 usage', async () => {
		global.fetch
			.mockResolvedValueOnce(new Response(JSON.stringify({ result: [] }), { status: 200 }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				workersInvocationsAdaptive: [
					{ sum: { requests: 100, errors: 2 }, dimensions: { scriptName: 'otsmail' } },
					{ sum: { requests: 30, errors: 1 }, dimensions: { scriptName: 'other-app' } }
				]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				workersInvocationsAdaptive: [{ sum: { requests: 5 } }]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 10, rowsWritten: 2 } }]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 3, rowsWritten: 1 } }]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				durableObjectsInvocationsAdaptiveGroups: [{ sum: { requests: 7 } }],
				durableObjectsPeriodicGroups: [{ sum: { cpuTime: 2000000 } }],
				durableObjectsStorageGroups: [{ max: { storedBytes: 1024 } }]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				durableObjectsInvocationsAdaptiveGroups: [{ sum: { requests: 2 } }]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				r2StorageAdaptiveGroups: [{
					max: { objectCount: 3, payloadSize: 100, metadataSize: 10 },
					dimensions: { bucketName: 'bucket' }
				}]
			}] } }));

		const data = await cloudflareService.usage(c);

		expect(data.plan).toBe('free');
		expect(data.totalRequests).toBe(130);
		expect(data.totalErrors).toBe(3);
		expect(data.workersToday).toBe(5);
		expect(data.otsmail).toMatchObject({ name: 'otsmail', requests: 100 });
		expect(data.othersRequests).toBe(30);
		expect(data.d1).toEqual({ rowsRead: 10, rowsWritten: 2 });
		expect(data.d1Today).toEqual({ rowsRead: 3, rowsWritten: 1 });
		expect(data.do).toEqual({ requests: 7, cpuTime: 2000000, storageBytes: 1024 });
		expect(data.doToday).toEqual({ requests: 2 });
		expect(data.r2).toEqual({ objects: 3, bytes: 110 });
		expect(c.env.kv.put).toHaveBeenCalled();
	});
});
