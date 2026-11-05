function normalizeVersion(value) {
	return String(value || '').replace(/^web-v/i, '').trim();
}

export function currentVersion(c) {
	const metadata = c.env.CF_VERSION_METADATA || {};
	const version = normalizeVersion(c.env.WEB_VERSION || metadata.tag || '');
	return {
		version: version || 'unknown',
		deployedAt: c.env.WEB_DEPLOYED_AT || metadata.timestamp || null
	};
}

function parse(value) {
	const match = normalizeVersion(value).match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
	if (!match) return null;
	return {
		parts: [Number(match[1]), Number(match[2]), Number(match[3])],
		pre: match[4] || ''
	};
}

export function compareVersion(a, b) {
	const left = parse(a);
	const right = parse(b);
	if (!left || !right) return 0;
	for (let i = 0; i < 3; i++) {
		if (left.parts[i] !== right.parts[i]) return left.parts[i] > right.parts[i] ? 1 : -1;
	}
	// 正式版高于同版本预发布版。
	if (!left.pre && right.pre) return 1;
	if (left.pre && !right.pre) return -1;
	return left.pre === right.pre ? 0 : (left.pre > right.pre ? 1 : -1);
}

export function isNewer(latest, current) {
	return compareVersion(latest, current) > 0;
}

export default { currentVersion, compareVersion, isNewer };
