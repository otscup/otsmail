const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const CACHE_TTL = 300;

const WORKERS_QUERY = `query($accountTag: String!, $start: Time!, $end: Time!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			workersInvocationsAdaptive(limit: 1000, filter: { datetime_geq: $start, datetime_leq: $end }) {
				sum { requests errors }
				dimensions { scriptName }
			}
		}
	}
}`;

const D1_QUERY = `query($accountTag: String!, $start: Date!, $end: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			d1QueriesAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { rowsRead rowsWritten }
				dimensions { databaseId }
			}
		}
	}
}`;

const WORKERS_DAY_QUERY = `query($accountTag: String!, $start: Time!, $end: Time!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			workersInvocationsAdaptive(limit: 1000, filter: { datetime_geq: $start, datetime_leq: $end }) {
				sum { requests errors }
				dimensions { scriptName }
			}
		}
	}
}`;

const D1_DAY_QUERY = `query($accountTag: String!, $start: Date!, $end: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			d1QueriesAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { rowsRead rowsWritten }
				dimensions { databaseId }
			}
		}
	}
}`;

const DO_QUERY = `query($accountTag: String!, $start: Date!, $end: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			durableObjectsInvocationsAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { requests }
				dimensions { scriptName }
			}
			durableObjectsPeriodicGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { cpuTime }
			}
			durableObjectsStorageGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				max { storedBytes }
			}
		}
	}
}`;

const DO_DAY_QUERY = `query($accountTag: String!, $start: Date!, $end: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			durableObjectsInvocationsAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { requests }
				dimensions { scriptName }
			}
			durableObjectsPeriodicGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { cpuTime }
			}
		}
	}
}`;

const KV_QUERY = `query($accountTag: String!, $start: Date!, $end: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			kvOperationsAdaptiveGroups(limit: 5000, filter: { date_geq: $start, date_leq: $end }) {
				sum { requests }
				dimensions { namespaceId actionType }
			}
		}
	}
}`;

const R2_QUERY = `query($accountTag: String!, $start: Time!, $end: Time!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			r2StorageAdaptiveGroups(limit: 5000, filter: { datetime_geq: $start, datetime_leq: $end }, orderBy: [datetime_DESC]) {
				max { objectCount payloadSize metadataSize }
				dimensions { bucketName datetime }
			}
		}
	}
}`;

async function graphql(token, query, variables) {
	const response = await fetch(GRAPHQL_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ query, variables })
	});
	const payload = await response.json().catch(() => null);
	if (!response.ok || payload?.errors?.length) {
		const message = payload?.errors?.[0]?.message || `HTTP ${response.status}`;
		throw new Error(message);
	}
	return payload?.data?.viewer?.accounts?.[0] || {};
}

function sum(list, pick) {
	return list.reduce((total, item) => total + Number(pick(item) || 0), 0);
}

function shortId(id) {
	return String(id || 'unknown').slice(0, 8);
}

function aggregateD1(rows, names) {
	const byDb = new Map();
	for (const row of rows || []) {
		const id = row.dimensions?.databaseId || 'unknown';
		const current = byDb.get(id) || { databaseId: id, rowsRead: 0, rowsWritten: 0, count: 0 };
		current.rowsRead += Number(row.sum?.rowsRead || 0);
		current.rowsWritten += Number(row.sum?.rowsWritten || 0);
		current.count += Number(row.sum?.count || 0);
		byDb.set(id, current);
	}
	const databases = [...byDb.values()]
		.map(item => ({ ...item, name: names.get(item.databaseId) || shortId(item.databaseId) }))
		.sort((a, b) => (b.rowsRead + b.rowsWritten) - (a.rowsRead + a.rowsWritten));
	const total = databases.reduce((acc, item) => {
		acc.rowsRead += item.rowsRead;
		acc.rowsWritten += item.rowsWritten;
		acc.count += item.count;
		return acc;
	}, { rowsRead: 0, rowsWritten: 0, count: 0 });
	const weighted = total.rowsRead + total.rowsWritten;
	for (const item of databases) {
		item.share = weighted ? Math.max(0, (item.rowsRead + item.rowsWritten) / weighted) : 0;
	}
	return { ...total, databases };
}

const PLAN_LIMITS = {
	free: {
		workersDailyRequests: 100000,
		d1DailyRowsRead: 5000000,
		d1DailyRowsWritten: 100000,
		r2StorageBytes: 10 * 1024 ** 3,
		durableObjectDailyRequests: 100000,
		durableObjectStorageBytes: 5 * 1000 ** 3,
		durableObjects: true,
		kvDailyRead: 100000,
		kvDailyWrite: 1000,
		kvDailyDelete: 1000,
		kvDailyList: 1000
	},
	paid: {
		workersMonthlyRequests: 10000000,
		d1MonthlyRowsRead: 25000000000,
		d1MonthlyRowsWritten: 50000000,
		r2StorageBytes: 10 * 1024 ** 3,
		durableObjectMonthlyRequests: 1000000,
		durableObjectStorageBytes: 5 * 1000 ** 3,
		durableObjects: true
	}
};

// Cloudflare 订阅接口需要 Account Settings:Read；分析 token 没有该权限时按免费档展示。
async function detectPlan(c, token, accountId) {
	const forced = String(c.env.CF_PLAN || '').toLowerCase();
	if (forced === 'free' || forced === 'paid') return forced;
	try {
		const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/subscriptions`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!response.ok) return 'free';
		const payload = await response.json();
		const paid = (payload.result || []).some(item => {
			const plan = String(item.rate_plan?.id || '').toLowerCase();
			return plan.includes('workers') && !plan.includes('free');
		});
		return paid ? 'paid' : 'free';
	} catch {
		return 'free';
	}
}

async function apiNames(token, url, idField, nameField) {
	try {
		const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
		if (!response.ok) {
			console.warn(`cf names api failed: ${response.status} ${url}`);
			return new Map();
		}
		const payload = await response.json();
		return new Map((payload.result || []).map(item => [item[idField], item[nameField]]));
	} catch (error) {
		console.warn(`cf names api error: ${error.message} ${url}`);
		return new Map();
	}
}

async function loadNames(c, token, accountId) {
	const key = `cf:usage:${accountId}:names`;
	try {
		const cached = await c.env.kv?.get(key, { type: 'json' });
		if (cached) {
			return {
				d1: new Map(Object.entries(cached.d1 || {})),
				kv: new Map(Object.entries(cached.kv || {}))
			};
		}
	} catch {
		// KV 不可用时回源，不影响用量页。
	}

	const [d1, kv] = await Promise.all([
		apiNames(token, `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, 'uuid', 'name'),
		apiNames(token, `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`, 'id', 'title')
	]);
	try {
		await c.env.kv?.put(key, JSON.stringify({
			d1: Object.fromEntries(d1),
			kv: Object.fromEntries(kv)
		}), { expirationTtl: 3600 });
	} catch {
		// 名单缓存失败时仍返回本次名称。
	}
	return { d1, kv };
}

const cloudflareService = {

	async usage(c) {
		const token = c.env.CF_ANALYTICS_TOKEN;
		if (!token) {
			return { configured: false };
		}

		const accountId = c.env.CF_ACCOUNT_ID;
		if (!accountId) {
			return { configured: true, error: 'CF_ACCOUNT_ID 未配置' };
		}

		const now = new Date();
		const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
		const startTime = start.toISOString();
		const endTime = now.toISOString();
		// Storage is a point-in-time metric; 2 days is enough to contain the latest sample for each bucket.
		const r2Start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
		const startDate = startTime.slice(0, 10);
		const endDate = endTime.slice(0, 10);
		const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
		const dayStartTime = dayStart.toISOString();
		const dayStartDate = dayStartTime.slice(0, 10);
		const plan = await detectPlan(c, token, accountId);
		const cacheKey = `cf:usage:${accountId}:${startDate.slice(0, 7)}:${plan}`;

		const cached = await c.env.kv?.get(cacheKey, { type: 'json' });
		if (cached) return cached;

		const names = await loadNames(c, token, accountId);
		const d1Names = names.d1;
		const kvNames = names.kv;

		const data = {
			configured: true,
			period: startDate.slice(0, 7),
			plan,
			limits: PLAN_LIMITS[plan],
			totalRequests: 0,
			totalErrors: 0,
			workersToday: 0,
			todayErrors: 0,
			todayApps: [],
			apps: [],
			otsmail: null,
			othersRequests: 0,
			d1: null,
			d1Today: null,
			do: null,
			doToday: null,
			kv: null,
			r2: null,
			fetchedAt: endTime
		};

		try {
			const workers = await graphql(token, WORKERS_QUERY, {
				accountTag: accountId, start: startTime, end: endTime
			});
			const rows = workers.workersInvocationsAdaptive || [];
			const byName = new Map();
			for (const row of rows) {
				const name = row.dimensions?.scriptName || 'unknown';
				const current = byName.get(name) || { name, requests: 0, errors: 0 };
				current.requests += Number(row.sum?.requests || 0);
				current.errors += Number(row.sum?.errors || 0);
				byName.set(name, current);
			}
			data.apps = [...byName.values()]
				.map(app => ({ ...app, otsmail: app.name.toLowerCase() === 'otsmail' }))
				.sort((a, b) => b.requests - a.requests);
			data.totalRequests = sum(data.apps, app => app.requests);
			data.totalErrors = sum(data.apps, app => app.errors);
			data.otsmail = data.apps.find(app => app.otsmail) || null;
			data.othersRequests = data.totalRequests - (data.otsmail?.requests || 0);
		} catch (error) {
			return { configured: true, error: `Workers Analytics: ${error.message}` };
		}

		try {
			const today = await graphql(token, WORKERS_DAY_QUERY, {
				accountTag: accountId, start: dayStartTime, end: endTime
			});
			const rows = today.workersInvocationsAdaptive || [];
			data.workersToday = sum(rows, row => row.sum?.requests);
			data.todayErrors = sum(rows, row => row.sum?.errors);
			const byName = new Map();
			for (const row of rows) {
				const name = row.dimensions?.scriptName || 'unknown';
				const current = byName.get(name) || { name, requests: 0, errors: 0 };
				current.requests += Number(row.sum?.requests || 0);
				current.errors += Number(row.sum?.errors || 0);
				byName.set(name, current);
			}
			data.todayApps = [...byName.values()].sort((a, b) => b.requests - a.requests);
		} catch {
			data.workersToday = null;
			data.todayErrors = null;
		}

		try {
			const d1 = await graphql(token, D1_QUERY, {
				accountTag: accountId, start: startDate, end: endDate
			});
			data.d1 = aggregateD1(d1.d1QueriesAdaptiveGroups, d1Names);
		} catch (error) {
			data.d1Error = error.message;
		}

		try {
			const today = await graphql(token, D1_DAY_QUERY, {
				accountTag: accountId, start: dayStartDate, end: endDate
			});
			data.d1Today = aggregateD1(today.d1QueriesAdaptiveGroups, d1Names);
		} catch {
			data.d1Today = null;
		}

		try {
			const durable = await graphql(token, DO_QUERY, {
				accountTag: accountId, start: startDate, end: endDate
			});
			const invocationRows = durable.durableObjectsInvocationsAdaptiveGroups || [];
			const periodicRows = durable.durableObjectsPeriodicGroups || [];
			const storageRows = durable.durableObjectsStorageGroups || [];
			const byScript = new Map();
			for (const row of invocationRows) {
				const name = row.dimensions?.scriptName || 'unknown';
				const current = byScript.get(name) || { name, requests: 0 };
				current.requests += Number(row.sum?.requests || 0);
				byScript.set(name, current);
			}
			const scripts = [...byScript.values()].sort((a, b) => b.requests - a.requests);
			const requests = sum(scripts, row => row.requests);
			for (const script of scripts) script.share = requests ? script.requests / requests : 0;
			data.do = {
				requests,
				cpuTime: sum(periodicRows, row => row.sum?.cpuTime),
				storageBytes: storageRows.length ? Math.max(...storageRows.map(row => Number(row.max?.storedBytes || 0))) : null,
				scripts
			};
		} catch (error) {
			data.doError = error.message;
		}

		try {
			const durableToday = await graphql(token, DO_DAY_QUERY, {
				accountTag: accountId, start: dayStartDate, end: endDate
			});
			const rows = durableToday.durableObjectsInvocationsAdaptiveGroups || [];
			const byScript = new Map();
			for (const row of rows) {
				const name = row.dimensions?.scriptName || 'unknown';
				const current = byScript.get(name) || { name, requests: 0 };
				current.requests += Number(row.sum?.requests || 0);
				byScript.set(name, current);
			}
			const scripts = [...byScript.values()].sort((a, b) => b.requests - a.requests);
			const requests = sum(scripts, row => row.requests);
			for (const script of scripts) script.share = requests ? script.requests / requests : 0;
			data.doToday = {
				requests,
				cpuTime: sum(durableToday.durableObjectsPeriodicGroups || [], row => row.sum?.cpuTime),
				scripts
			};
		} catch {
			data.doToday = null;
		}

		try {
			const kv = await graphql(token, KV_QUERY, {
				accountTag: accountId, start: dayStartDate, end: endDate
			});
			const byNamespace = new Map();
			const usage = { read: 0, write: 0, delete: 0, list: 0 };
			for (const row of kv.kvOperationsAdaptiveGroups || []) {
				const id = row.dimensions?.namespaceId || 'unknown';
				const action = String(row.dimensions?.actionType || '').toLowerCase();
				const bucket = action.startsWith('read') ? 'read'
					: action.startsWith('write') ? 'write'
						: action.startsWith('delete') ? 'delete'
							: action.startsWith('list') ? 'list' : null;
				if (!bucket) continue;
				const current = byNamespace.get(id) || {
					namespaceId: id,
					name: kvNames.get(id) || shortId(id),
					read: 0, write: 0, delete: 0, list: 0
				};
				const requests = Number(row.sum?.requests || 0);
				current[bucket] += requests;
				usage[bucket] += requests;
				byNamespace.set(id, current);
			}
			const namespaces = [...byNamespace.values()].sort((a, b) =>
				(b.read + b.write + b.delete + b.list) - (a.read + a.write + a.delete + a.list));
			data.kv = { ...usage, namespaces };
		} catch (error) {
			data.kvError = error.message;
		}

		try {
			const r2 = await graphql(token, R2_QUERY, {
				accountTag: accountId, start: r2Start, end: endTime
			});
			const rows = r2.r2StorageAdaptiveGroups || [];
			const buckets = new Set();
			let objects = 0;
			let bytes = 0;
			for (const row of rows) {
				const name = row.dimensions?.bucketName;
				if (!name || buckets.has(name)) continue;
				buckets.add(name);
				objects += Number(row.max?.objectCount || 0);
				bytes += Number(row.max?.payloadSize || 0) + Number(row.max?.metadataSize || 0);
			}
			data.r2 = { objects, bytes };
		} catch (error) {
			data.r2Error = error.message;
		}

		await c.env.kv?.put(cacheKey, JSON.stringify(data), { expirationTtl: CACHE_TTL });
		return data;
	}
};

export default cloudflareService;
