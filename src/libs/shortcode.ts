export const deriveShortcode = (signature: Uint8Array): number => {
	const array = new Uint32Array(signature.buffer)
	return array[array.length - 1] % 100000
}
