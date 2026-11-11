import app from '../hono/hono';
import { dbInit } from '../init/init';

app.get('/init', (c) => {
	return dbInit.init(c);
})

// 增量迁移：不受 init_done 门禁限制，已初始化的库也能补列 / 建表
app.get('/init/migrate', (c) => {
	return dbInit.migrate(c);
})
