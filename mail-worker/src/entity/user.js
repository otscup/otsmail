import { sqliteTable, text, integer} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
const user = sqliteTable('user', {
	userId: integer('user_id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull(),
	type: integer('type').default(1).notNull(),
	password: text('password').notNull(),
	salt: text('salt').notNull(),
	status: integer('status').default(0).notNull(),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`),
	activeTime: text('active_time'),
	createIp: text('create_ip'),
	activeIp: text('active_ip'),
	os: text('os'),
	browser: text('browser'),
	device: text('device'),
	sort: text('sort').default(0),
	sendCount: text('send_count').default(0),
	regKeyId: integer('reg_key_id').default(0).notNull(),
	avatar: text('avatar').default(''),
	twoFactorSwitch: integer('two_factor_switch').default(0),
	twoFactorSecret: text('two_factor_secret').default(''),
	twoFactorRequired: integer('two_factor_required').default(0).notNull(),
	// 手机端可跨设备同步的两项偏好（见 dev/migrate-mobile-settings.sql）
	signature: text('signature').default(''),
	sendOnEnter: integer('send_on_enter').default(0).notNull(),
	isDel: integer('is_del').default(0).notNull()
});
export default user
