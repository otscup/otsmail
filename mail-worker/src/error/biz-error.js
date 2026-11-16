class BizError extends Error {
	constructor(message, code, errorCode) {
		super(message);
		this.code = code ? code : 501;
		// 稳定的机器可读错误码：前端据此映射固定文案，不再依赖会随语言/措辞变化的 message
		this.errorCode = errorCode;
		this.name = 'BizError';
	}
}

export default BizError;
