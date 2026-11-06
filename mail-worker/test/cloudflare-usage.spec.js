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
				CF_PLAN: 'free',
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
			.mockResolvedValueOnce(new Response(JSON.stringify({ result: [] }), { status: 200 }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				workersInvocationsAdaptive: [
					{ sum: { requests: 100, errors: 2 }, dimensions: { scriptName: 'otsmail' } },
					{ sum: { requests: 30, errors: 1 }, dimensions: { scriptName: 'other-app' } }
				]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				workersInvocationsAdaptive: [
					{ sum: { requests: 5, errors: 1 }, dimensions: { scriptName: 'otsmail' } }
				]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				d1QueriesAdaptiveGroups: [
					{ sum: { rowsRead: 10, rowsWritten: 2 }, dimensions: { databaseId: 'db-a' } }
				]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				d1QueriesAdaptiveGroups: [
					{ sum: { rowsRead: 3, rowsWritten: 1 }, dimensions: { databaseId: 'db-a' } }
				]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				durableObjectsInvocationsAdaptiveGroups: [{ sum: { requests: 7 }, dimensions: { scriptName: 'otsmail' } }],
				durableObjectsPeriodicGroups: [{ sum: { cpuTime: 2000000 } }],
				durableObjectsStorageGroups: [{ max: { storedBytes: 1024 } }]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				durableObjectsInvocationsAdaptiveGroups: [{ sum: { requests: 2 }, dimensions: { scriptName: 'otsmail' } }],
				durableObjectsPeriodicGroups: [{ sum: { cpuTime: 100 } }]
			}] } }))
			.mockResolvedValueOnce(response({ viewer: { accounts: [{
				kvOperationsAdaptiveGroups: [
					{ sum: { requests: 4 }, dimensions: { namespaceId: 'kv-a', actionType: 'read' } },
					{ sum: { requests: 2 }, dimensions: { namespaceId: 'kv-a', actionType: 'write' } }
				]
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
		expect(data.todayErrors).toBe(1);
		expect(data.workersToday).toBe(5);
		expect(data.otsmail).toMatchObject({ name: 'otsmail', requests: 100 });
		expect(data.othersRequests).toBe(30);
		expect(data.d1.rowsRead).toBe(10);
		expect(data.d1.rowsWritten).toBe(2);
		expect(data.d1.databases[0]).toMatchObject({ databaseId: 'db-a', share: 1 });
		expect(data.d1Today.rowsRead).toBe(3);
		expect(data.do).toMatchObject({ requests: 7, cpuTime: 2000000, storageBytes: 1024 });
		expect(data.do.scripts[0]).toMatchObject({ name: 'otsmail', share: 1 });
		expect(data.doToday).toMatchObject({ requests: 2, cpuTime: 100 });
		expect(data.kv).toMatchObject({ read: 4, write: 2, delete: 0, list: 0 });
		expect(data.r2).toEqual({ objects: 3, bytes: 110 });
		expect(c.env.kv.put).toHaveBeenCalled();
	});
});
