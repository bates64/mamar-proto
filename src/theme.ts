// This formula produces a 1:2 scale.
// Returns in the `em` CSS unit which scales up linearly by the local font size.
export const em = (n?: number): string => isFinite(n)
	? `${n > 0 ? (0.1 + 2 ** (n - 3)) : 0}em`
	: ''
