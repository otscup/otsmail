import resendProvider from './resend-provider';
import brevoProvider from './brevo-provider';
import mailjetProvider from './mailjet-provider';
import elasticProvider from './elastic-provider';
import smtp2goProvider from './smtp2go-provider';
import { PROVIDER_IDS } from '../../const/send-provider-const';

const adapters = {
	resend: resendProvider,
	brevo: brevoProvider,
	mailjet: mailjetProvider,
	elastic: elasticProvider,
	smtp2go: smtp2goProvider
};

export function getProvider(id) {
	return adapters[id] || null;
}

export function allProviders() {
	return PROVIDER_IDS.map(id => adapters[id]).filter(Boolean);
}

export default adapters;
