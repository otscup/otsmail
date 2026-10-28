// 桌面通知：权限申请 + Web Push 订阅 + 去重 + 点击聚焦。
// 调用点：收信轮询拿到新邮件后调 notifyNewEmail(email)（mail-vue/src/views/email/index.vue 的 latest()）。
import {pushKey, subscribePush, unsubscribePush} from '@/request/push.js'

const ENABLE_KEY = 'desktopNotify'
const LAST_KEY = 'desktopNotifyLast'

function urlBase64ToUint8Array(base64) {
	const padding = '='.repeat((4 - base64.length % 4) % 4)
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(raw, char => char.charCodeAt(0))
}

async function subscribeWebPush() {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
	try {
		const {key} = await pushKey()
		if (!key) return
		let registration = await navigator.serviceWorker.getRegistration()
		if (!registration) {
			registration = await navigator.serviceWorker.register('/sw.js')
		}
		await Promise.race([
			navigator.serviceWorker.ready,
			new Promise((_, reject) => setTimeout(() => reject(new Error('sw timeout')), 12000))
		])
		const subscription = await registration.pushManager.getSubscription()
			|| await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(key)
			})
		await subscribePush(subscription.toJSON())
	} catch (e) {
		console.warn('Web Push 订阅失败: ', e)
	}
}

async function unsubscribeWebPush() {
	if (!('serviceWorker' in navigator)) return
	try {
		const registration = await navigator.serviceWorker.ready
		const subscription = await registration.pushManager.getSubscription()
		if (!subscription) return
		await unsubscribePush(subscription.endpoint)
		await subscription.unsubscribe()
	} catch (e) {
		console.warn('Web Push 退订失败: ', e)
	}
}

// 申请权限并记下开关；返回最终是否可用
export function notifyEnabled() {
	return localStorage.getItem(ENABLE_KEY) === '1'
}

export async function enableNotify() {
	if (!('Notification' in window)) {
		return false
	}
	let permission = Notification.permission
	if (permission === 'default') {
		permission = await Notification.requestPermission()
	}
	if (permission !== 'granted') {
		return false
	}
	localStorage.setItem(ENABLE_KEY, '1')
	await subscribeWebPush()
	return true
}

export function disableNotify() {
	localStorage.setItem(ENABLE_KEY, '0')
	unsubscribeWebPush()
}

// 桌面通知附带的提示音；WebAudio 不需要音频文件，浏览器拦截时静默失败
export function playNotifySound() {
	try {
		const ctx = new (window.AudioContext || window.webkitAudioContext)()
		const gain = ctx.createGain()
		gain.gain.value = 0.08
		gain.connect(ctx.destination)
		const osc = ctx.createOscillator()
		osc.type = 'sine'
		osc.frequency.value = 880
		osc.connect(gain)
		osc.start()
		osc.stop(ctx.currentTime + 0.12)
		setTimeout(() => ctx.close(), 400)
	} catch (e) {
		// 没有用户手势或浏览器不支持时，通知仍会显示
	}
}

// 同一封邮件只提醒一次；localStorage 记最近一封，刷新页面不会重复弹
export function notifyNewEmail(email) {
	if (!email || !email.emailId || !notifyEnabled() || !('Notification' in window)) {
		return
	}
	if (Notification.permission !== 'granted' || localStorage.getItem(LAST_KEY) === String(email.emailId)) {
		return
	}
	localStorage.setItem(LAST_KEY, String(email.emailId))
	playNotifySound()
	const body = [email.name, email.text].filter(Boolean).join(' · ')
	const notification = new Notification(email.subject || body || 'otsmail', {
		body: body.slice(0, 120),
		tag: 'otsmail-' + email.emailId,
		icon: '/mail-pwa.png'
	})
	notification.onclick = () => {
		window.focus()
		notification.close()
		// 点通知即视为读过：先落库再刷新，侧栏未读数跟着重算
		import('@/request/email.js').then(({emailRead}) => {
			emailRead([email.emailId]).finally(() => window.location.assign('/'))
		}).catch(() => window.location.assign('/'))
	}
}
