import randomBytes from 'randombytes'

// Protos
import { Hashcash, TemporaryHashcash } from '../protos/shortcode'

const isBitZero = (buffer: Uint8Array, bitIndex: number): boolean => {
	const byte = ~~(bitIndex / 8)
	const bit = bitIndex % 8
	const idByte = buffer[byte]
	return !(idByte & Math.pow(2, 7 - bit))
}

export const hasEnoughZeros = (buffer: Uint8Array, bits: number): boolean => {
	for (let bit = 0; bit < bits; bit++) {
		if (!isBitZero(buffer, bit)) {
			return false
		}
	}

	return true
}

export const validHashcash = async (hashcash: Hashcash): Promise<boolean> => {
	const hash = await crypto.subtle.digest('SHA-256', Hashcash.encode(hashcash))
	return hasEnoughZeros(new Uint8Array(hash), hashcash.bits)
}

export const solveHashcash = async (
	hashcash: Omit<Hashcash, 'counter'>
): Promise<Hashcash> => {
	const copy: Hashcash = { ...hashcash, counter: new Uint8Array(0) }

	do {
		copy.counter = await randomBytes(12)
	} while (!(await validHashcash(copy)))

	return copy
}

export const toTemporaryHashcash = (hashcash: Hashcash): TemporaryHashcash => {
	const temp: TemporaryHashcash & {
		shortcode?: number
		counter?: Uint8Array
	} = { ...hashcash }

	delete temp.shortcode
	delete temp.counter

	return temp as TemporaryHashcash
}
