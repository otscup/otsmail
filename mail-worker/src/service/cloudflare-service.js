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
			d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { rowsRead rowsWritten }
			}
		}
	}
}`;

const WORKERS_DAY_QUERY = `query($accountTag: String!, $start: Time!, $end: Time!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			workersInvocationsAdaptive(limit: 1000, filter: { datetime_geq: $start, datetime_leq: $end }) {
				sum { requests errors }
			}
		}
	}
}`;

const D1_DAY_QUERY = `query($accountTag: String!, $start: Date!, $end: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { rowsRead rowsWritten }
			}
		}
	}
}`;

const DO_QUERY = `query($accountTag: String!, $start: Date!, $end: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			durableObjectsInvocationsAdaptiveGroups(limit: 1000, filter: { date_geq: $start, date_leq: $end }) {
				sum { requests }
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

const PLAN_LIMITS = {
	free: {
		workersDailyRequests: 100000,
		d1DailyRowsRead: 5000000,
		d1DailyRowsWritten: 100000,
		r2StorageBytes: 10 * 1024 ** 3,
		durableObjectDailyRequests: 100000,
		durableObjectStorageBytes: 5 * 1000 ** 3,
		durableObjects: true
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

		const data = {
			configured: true,
			period: startDate.slice(0, 7),
			plan,
			limits: PLAN_LIMITS[plan],
			totalRequests: 0,
			totalErrors: 0,
			workersToday: 0,
			apps: [],
			otsmail: null,
			othersRequests: 0,
			d1: null,
			d1Today: null,
			do: null,
			doToday: null,
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
			data.workersToday = sum(today.workersInvocationsAdaptive || [], row => row.sum?.requests);
		} catch {
			data.workersToday = null;
		}

		try {
			const d1 = await graphql(token, D1_QUERY, {
				accountTag: accountId, start: startDate, end: endDate
			});
			const rows = d1.d1AnalyticsAdaptiveGroups || [];
			data.d1 = {
				rowsRead: sum(rows, row => row.sum?.rowsRead),
				rowsWritten: sum(rows, row => row.sum?.rowsWritten)
			};
		} catch (error) {
			data.d1Error = error.message;
		}

		try {
			const today = await graphql(token, D1_DAY_QUERY, {
				accountTag: accountId, start: dayStartDate, end: endDate
			});
			const rows = today.d1AnalyticsAdaptiveGroups || [];
			data.d1Today = {
				rowsRead: sum(rows, row => row.sum?.rowsRead),
				rowsWritten: sum(rows, row => row.sum?.rowsWritten)
			};
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
			data.do = {
				requests: sum(invocationRows, row => row.sum?.requests),
				cpuTime: sum(periodicRows, row => row.sum?.cpuTime),
				storageBytes: storageRows.length ? Math.max(...storageRows.map(row => Number(row.max?.storedBytes || 0))) : null
			};
		} catch (error) {
			data.doError = error.message;
		}

		try {
			const durableToday = await graphql(token, DO_DAY_QUERY, {
				accountTag: accountId, start: dayStartDate, end: endDate
			});
			data.doToday = {
				requests: sum(durableToday.durableObjectsInvocationsAdaptiveGroups || [], row => row.sum?.requests)
			};
		} catch {
			data.doToday = null;
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
