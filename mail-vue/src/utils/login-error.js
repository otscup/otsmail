import i18n from '@/i18n/index.js'

/**
 * 登录链路的统一失败文案。
 *
 * 服务端 message 会随语言和措辞变化，而且"邮箱不存在 / 密码错误"分开提示会暴露账号是否注册。
 * 因此登录相关接口都带 noMsg 交给这里处理：优先看稳定的 errorCode，其次看网络层错误。
 *
 * @param {any} err       axios reject 出来的业务对象或 AxiosError
 * @param {string} fallbackKey 无法归类时使用的 i18n key（OAuth / Passkey 传各自的兜底文案）
 */
export function loginErrorMessage(err, fallbackKey = 'loginFailServer') {
	const t = i18n.global.t

	switch (err?.errorCode) {
		case 'LOGIN_CREDENTIALS':
			return t('loginFailCredentials')
		case 'LOGIN_ACCOUNT_UNAVAILABLE':
			return t('loginFailAccountUnavailable')
		case 'LOGIN_RATE_LIMITED':
			return t('loginFailRateLimited')
		case 'LOGIN_2FA_REQUIRED':
			return t('twoFactorLoginHint')
		case 'LOGIN_2FA_INVALID':
			return t('loginFailTwoFactorInvalid')
		case 'LOGIN_PASSWORD_DISABLED':
			return t('loginFailPasswordDisabled')
		case 'LOGIN_TURNSTILE':
			return t('botVerifyMsg')
	}

	if (String(err?.message || '').includes('Network Error')) return t('networkErrorMsg')
	if (err?.code === 'ECONNABORTED') return t('timeoutErrorMsg')
	if (err?.response) return t('serverBusyErrorMsg')

	return t(fallbackKey)
}

export default loginErrorMessage
