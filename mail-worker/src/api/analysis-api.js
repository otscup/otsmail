import app from '../hono/hono';
import analysisService from '../service/analysis-service';
import cloudflareService from '../service/cloudflare-service';
import result from '../model/result';

app.get('/analysis/echarts', async (c) => {
	const data = await analysisService.echarts(c, c.req.query());
	return c.json(result.ok(data));
})

app.get('/analysis/insight', async (c) => {
	const data = await analysisService.insight(c, c.req.query());
	return c.json(result.ok(data));
})

app.get('/analysis/usage', async (c) => {
	const data = await analysisService.usage(c);
	return c.json(result.ok(data));
})

app.get('/analysis/cloudflare', async (c) => {
	const data = await cloudflareService.usage(c);
	return c.json(result.ok(data));
})
