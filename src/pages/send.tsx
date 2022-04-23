import { useEffect, useRef, useState } from 'preact/hooks'

// Types
import type { RouteComponentProps } from '@reach/router'
import type { Waku, WakuMessage } from 'js-waku'

// Config
import { SHORTCODE_BITS, SHORTCODE_TOPIC } from '../config/waku'

// Protos
import { Shortcode, TemporaryHashcash } from '../protos/shortcode'
import { toTemporaryHashcash, validHashcash } from '../libs/hashcash'
import { deriveShortcode } from '../libs/shortcode'
import { getTimestampInSeconds } from '../libs/tools'

type SendProps = RouteComponentProps & {
	waku: Waku
}

export const Send = ({ waku }: SendProps) => {
	const received = useRef<Shortcode[]>([])
	const [input, setInput] = useState<number>()
	const [message, setMessage] = useState('')

	const onSubmit = (event: any) => {
		event.preventDefault()
		const found = []

		for (const shortcode of received.current) {
			if (shortcode.hashcash.shortcode === input) {
				found.push(shortcode)
			}
		}

		if (found.length === 0) {
			setMessage('Shortcode not found')
			return
		}

		if (found.length > 1) {
			setMessage('Multiple shortcodes found')
			return
		}

		setMessage(
			'Shortcode found, user: 0x' +
				[...found[0].publicKey]
					.map((x) => x.toString(16).padStart(2, '0'))
					.join('')
		)
	}

	useEffect(() => {
		const onMessage = async (message: WakuMessage) => {
			if (!message.payload) {
				return
			}

			const shortcode = Shortcode.decode(message.payload)

			console.log(shortcode)

			if (shortcode.hashcash.bits < SHORTCODE_BITS) {
				throw new Error('Not enough zeroed out bits in hashcash')
			}

			if (!(await validHashcash(shortcode.hashcash))) {
				throw new Error('Invalid hashcash')
			}

			if (
				deriveShortcode(shortcode.signature) !== shortcode.hashcash.shortcode
			) {
				throw new Error('Derived shortcode different from hashcash code')
			}

			if (shortcode.hashcash.date < BigInt(getTimestampInSeconds()) - 90n) {
				throw new Error('Hashcash older than 90 seconds')
			}

			const publicKey = await crypto.subtle.importKey(
				'spki',
				shortcode.publicKey,
				{
					name: 'RSA-PSS',
					hash: 'SHA-256',
				},
				false,
				['verify']
			)

			const validSignature = await crypto.subtle.verify(
				{
					name: 'RSA-PSS',
					saltLength: 128,
				},
				publicKey,
				shortcode.signature,
				TemporaryHashcash.encode(toTemporaryHashcash(shortcode.hashcash))
			)
			if (!validSignature) {
				throw new Error('Invalid signature')
			}

			// TODO: Check block hash

			console.log('Got valid shortcode:', shortcode)
			received.current.push(shortcode)
		}

		waku.relay.addObserver(onMessage, [SHORTCODE_TOPIC])

		return () => {
			waku.relay.deleteObserver(onMessage, [SHORTCODE_TOPIC])
		}
	}, [])

	return (
		<div>
			<p>
				Ask the receiver to generate a shortcode for you, then enter it here:
			</p>
			<form onSubmit={onSubmit}>
				<input
					type="number"
					min="0"
					max="99999"
					step="0"
					onChange={(event) => setInput(parseInt(event.currentTarget.value))}
				/>
				<button type="submit">Check</button>
			</form>
			{message && <p>{message}</p>}
		</div>
	)
}
