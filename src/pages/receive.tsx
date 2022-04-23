import { useEffect, useState } from 'preact/hooks'
import { WakuMessage } from 'js-waku'
import randomBytes from 'randombytes'

// Types
import type { RouteComponentProps } from '@reach/router'
import type { Waku } from 'js-waku'

// Config
import { SHORTCODE_BITS, SHORTCODE_TOPIC } from '../config/waku'

// Libs
import { solveHashcash } from '../libs/hashcash'
import { deriveShortcode } from '../libs/shortcode'
import { getTimestampInSeconds } from '../libs/tools'

// Protos
import { TemporaryHashcash, Shortcode } from '../protos/shortcode'

type ReceiveProps = RouteComponentProps & {
	waku: Waku
}

const generateTemporaryHashcash = async (): Promise<TemporaryHashcash> => ({
	bits: SHORTCODE_BITS,
	date: BigInt(getTimestampInSeconds()),
	blockHash: new Uint8Array(), // TODO: Set actual block hash
	random: await randomBytes(12),
})

const generateKeypair = async (): Promise<CryptoKeyPair> => {
	const pair = await crypto.subtle.generateKey(
		{
			name: 'RSA-PSS',
			modulusLength: 2048,
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			hash: 'SHA-256',
		},
		true,
		['sign']
	)
	return pair as CryptoKeyPair
}

const signTemporaryHashcash = async (
	hashcash: TemporaryHashcash,
	key: CryptoKey
): Promise<Uint8Array> => {
	const signature = await crypto.subtle.sign(
		{
			name: 'RSA-PSS',
			saltLength: 128,
		},
		key,
		TemporaryHashcash.encode(hashcash)
	)
	return new Uint8Array(signature)
}

export const Receive = ({ waku }: ReceiveProps) => {
	const [shortcode, setShortcode] = useState<number>()

	useEffect(() => {
		;(async () => {
			const { privateKey, publicKey } = await generateKeypair()
			const temp = await generateTemporaryHashcash()
			const signature = await signTemporaryHashcash(temp, privateKey)
			const shortcode = deriveShortcode(signature)
			const hashcash = await solveHashcash({
				...temp,
				shortcode,
			})

			const msg = await WakuMessage.fromBytes(
				Shortcode.encode({
					hashcash,
					signature,
					publicKey: new Uint8Array(
						await crypto.subtle.exportKey('spki', publicKey)
					),
				}),
				SHORTCODE_TOPIC
			)
			await waku.waitForRemotePeer()
			await waku.relay.send(msg)
			setShortcode(hashcash.shortcode)
		})()
	}, [])

	if (!shortcode) {
		return <p>Loading...</p>
	}

	return <p>Shortcode: {shortcode.toString().padStart(5, '0')}</p>
}
