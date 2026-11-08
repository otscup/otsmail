import { currentVersion, compareVersion, isNewer } from './version-service';

const REPO = 'otscup/otsmail';
const CACHE_KEY = 'update:web:latest';
const TAG_PATTERN = /^web-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

async function fetchReleases(c) {
	const headers = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'otsmail-update-check'
	};
	if (c.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${c.env.GITHUB_TOKEN}`;

	const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
		headers,
		signal: AbortSignal.timeout(8000)
	});
	if (!response.ok) {
		throw new Error(`GitHub releases ${response.status}`);
	}
	return response.json();
}

// REST 匿名额度只有 60 次/小时，被限流时退回 atom（不限流，但只给最近 10 条）。
async function fetchReleasesAtom() {
	const response = await fetch(`https://github.com/${REPO}/releases.atom`, {
		headers: { 'User-Agent': 'otsmail-update-check' },
		signal: AbortSignal.timeout(8000)
	});
	if (!response.ok) throw new Error(`GitHub atom ${response.status}`);
	const xml = await response.text();
	const entries = [];
	const blocks = xml.split('<entry>').slice(1);
	for (const block of blocks) {
		const id = /<id>[^<]*\/([^<\/]+)<\/id>/.exec(block);
		const updated = /<updated>([^<]+)<\/updated>/.exec(block);
		const link = /<link[^>]+href="([^"]+)"/.exec(block);
		if (!id) continue;
		entries.push({
			tag_name: id[1],
			published_at: updated ? updated[1] : null,
			html_url: link ? link[1] : '',
			body: ''
		});
	}
	return entries;
}

function pickLatest(items) {
	const releases = (Array.isArray(items) ? items : [])
		.map(item => {
			const match = TAG_PATTERN.exec(String(item.tag_name || ''));
			if (!match) return null;
			const url = String(item.html_url || '');
			return {
				version: match[1],
				publishedAt: item.published_at || null,
				notes: String(item.body || '').slice(0, 6000),
				url: url.startsWith(`https://github.com/${REPO}/releases/`)
					? url
					: `https://github.com/${REPO}/releases/tag/${item.tag_name}`
			};
		})
		.filter(Boolean)
		.sort((a, b) => compareVersion(b.version, a.version));
	return releases[0] || null;
}

function resultFor(c, release, cached = false) {
	const current = currentVersion(c);
	if (!release) {
		return {
			status: 'channelMissing',
			current: current.version,
			deployedAt: current.deployedAt,
			latest: null,
			hasUpdate: false,
			checkedAt: new Date().toISOString(),
			cached
		};
	}
	return {
		status: current.version === 'unknown' ? 'unknownCurrent' : 'ok',
		current: current.version,
		deployedAt: current.deployedAt,
		latest: release.version,
		hasUpdate: current.version !== 'unknown' && isNewer(release.version, current.version),
		publishedAt: release.publishedAt,
		notes: release.notes,
		url: release.url,
		checkedAt: new Date().toISOString(),
		cached
	};
}

async function check(c) {
	let cached = null;
	try {
		cached = await c.env.kv?.get(CACHE_KEY, { type: 'json' });
	} catch (e) {
		// KV 不可用时仍然检查，但不能让缓存故障变成“已是最新”。
		console.error('update cache read failed', e);
	}
	if (cached) return resultFor(c, cached, true);

	let release = null;
	try {
		release = pickLatest(await fetchReleases(c));
	} catch (e) {
		console.error('update check failed, falling back to atom', e);
		try {
			release = pickLatest(await fetchReleasesAtom());
		} catch (e2) {
			console.error('update atom failed', e2);
			return {
				status: 'upstreamError',
				current: currentVersion(c).version,
				latest: null,
				hasUpdate: false,
				checkedAt: new Date().toISOString(),
				cached: false
			};
		}
	}

	try {
		await c.env.kv?.put(CACHE_KEY, JSON.stringify(release), {
			expirationTtl: release ? 1800 : 600
		});
	} catch (e) {
		console.error('update cache write failed', e);
	}
	return resultFor(c, release, false);
}

export default { check };
