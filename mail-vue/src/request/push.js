import http from "@/axios/index.js";

export function pushKey() {
	return http.get('/push/key');
}

export function subscribePush(subscription) {
	return http.post('/push/subscribe', subscription);
}

export function unsubscribePush(endpoint) {
	return http.post('/push/unsubscribe', {endpoint});
}
