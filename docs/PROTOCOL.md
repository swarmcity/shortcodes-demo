# Shortcode based on Pub/Sub

## Prerequisites

- Alice has a newly gnerated keypair: `PubA`, `PrivA`

## Protocol

1. Bob starts listening to the shortcode channel
2. Alice creates a partial hashcash header that doesn't contain the resource and counter fields, signs it, and derives the shortcode from that signature (see later)
3. Alice sends a message containing:
   1. a hashcash header with resource = derived shortcode
   2. a signature with `PrivA` of the hashcash header info excluding the counter and shortcode (resource)
   3. `PubA`
4. Alice tells Bob what shortcode she used over an external channel
5. Bob fetches all messages containing Alice's shortcode and checks the hashcash header. If it's ok, he checks the signature by re-creating the partial hashcash header.
6. Bob should now know who Alice is

> NOTE: In order to preserve anonymity, it would probably be best to do this in both directions so that the actual address can be sent with confidence to Bob by Alice instead of leaking it to others later on.

## Example

### Alice

#### Generate keypair

```js
const { generateKeyPairSync } = require('crypto')
const { publicKey, privateKey } = generateKeyPairSync('ec', {
	namedCurve: 'secp256k1',
	publicKeyEncoding: {
		type: 'spki',
		format: 'der',
	},
	privateKeyEncoding: {
		type: 'pkcs8',
		format: 'der',
	},
})

console.log('Public key:', publicKey.toString('hex'))
console.log('Private key:', privateKey.toString('hex'))
```

**Result:**

Public key (`PubA`): `3056301006072a8648ce3d020106052b8104000a034200041dec15e304aa1d8646f927966bc479b55e6a807e158722c9eed9623bec84aa8ea84e0528207418dd6a93ffbbb49f44e4124c1576ac2249f74a02d5b1b6858769`
Private key (`PrivA`): `308184020100301006072a8648ce3d020106052b8104000a046d306b0201010420c586c294fecd0c787fa750c1442b94e46bb23967a836d2316ee2634501785484a144034200041dec15e304aa1d8646f927966bc479b55e6a807e158722c9eed9623bec84aa8ea84e0528207418dd6a93ffbbb49f44e4124c1576ac2249f74a02d5b1b6858769`

#### Partial hashcash

- Version: 1
- Bits: 20
- Date: April 23rd 2022, 19:52:34
- Extension: `ddf34116a9aebd7f305be898daa82be9381452acd2c7fa412aa7d9a21ea825c9` (last Ethereum block hash, used to make sure that codes cannot be pre-mined, at least not too long in advance)
- Random: `gEa//D5d2BD2nMFN` (`require('crypto').randomBytes(12).toString('base64')`)

**Result:** `1:20:220423195234:ddf34116a9aebd7f305be898daa82be9381452acd2c7fa412aa7d9a21ea825c9:gEa//D5d2BD2nMFN`

> NOTE: A timestamp is easier to use.

#### Partial hashcash signature

```js
const { sign, createPrivateKey } = require('crypto')
const privateKey = createPrivateKey({
	key: Buffer.from(
		'308184020100301006072a8648ce3d020106052b8104000a046d306b0201010420c586c294fecd0c787fa750c1442b94e46bb23967a836d2316ee2634501785484a144034200041dec15e304aa1d8646f927966bc479b55e6a807e158722c9eed9623bec84aa8ea84e0528207418dd6a93ffbbb49f44e4124c1576ac2249f74a02d5b1b6858769',
		'hex'
	),
	format: 'der',
	type: 'pkcs8',
})

const signature = sign(
	'RSA-SHA256',
	Buffer.from(
		'1:20:220422195234:ddf34116a9aebd7f305be898daa82be9381452acd2c7fa412aa7d9a21ea825c9:gEa//D5d2BD2nMFN',
		'utf8'
	),
	privateKey
)

console.log('Signature:', signature.toString('hex'))
console.log(
	'Shortcode:',
	signature
		.readUint32BE(signature.length - 4)
		.toString(10)
		.substr(-5)
		.padStart(5, '0')
)
```

**Result:**

Signature: `30450220652c1dd7038de4a7346418488bb43b8bd155c0e26ff47d8b714873975758254c022100dc5e9a1ac810fe6c446748a1f77d7d6f7ea8e39e25a102cae4976b777133d397`
Shortcode: `28896`

#### Final hashcash

Header: `1:20:220423195234:28896:ddf34116a9aebd7f305be898daa82be9381452acd2c7fa412aa7d9a21ea825c9:gEa//D5d2BD2nMFN:*`

#### Final message sent

```json
{
	"publicKey": "3056301006072a8648ce3d020106052b8104000a034200041dec15e304aa1d8646f927966bc479b55e6a807e158722c9eed9623bec84aa8ea84e0528207418dd6a93ffbbb49f44e4124c1576ac2249f74a02d5b1b6858769",
	"hashcash": "1:20:220423195234:28896::gEa//D5d2BD2nMFN:*",
	"signature": "304502200abcad2c478573e9052e147ca2b4f456843ea8e8e60fcb33d6ebc012f3051a0102210094bc39ac096a8a98d82c7cb3cf86479e3f10e57b2807a4423c24187ea5b141fd"
}
```

## Threats

### Bruteforce

It's still possible to bruteforce short codes, as they're sent over plaintext on a public channel. However, this requires finding a matching signature and a solid hashcash in time.

### Pre-mining short codes

If bruteforcing isn't fast enough, it is also possible to pre-mine some short codes to send them out as soon as one is detected on the common channel. This is avoided to some degree thanks to the block hash used in the hashcash header. One can check the date and block hash to make sure that the code was generated somewhat recently.

For example, assuming that the worst Ethereum block time is 15 seconds, one could check that the block hash given is at most 15 seconds earlier than the date contained in the hashcash. Then, the hashcash date can be used to allow for arbitrarly old codes.

If some duplicate short codes still come through, Bob could ask for a second one to make it that less likely that an attacker could have pre-mined or bruteforced codes.

### Node sync

This protocol relies on a good connection with a fully synced RPC endpoint. If block sync is not fast enough or the internet connection is bad, the interaction could fail.

The only solution to improve this is to allow for longer delays before a short code becomes invalid, making bruteforce more plausible.

### Light mobile devices

Mobile devices that are too slow to generate a hashcash in time would not be able to participate.

## Shortcode derivation

Take the signature of the partial hashcash header, convert it to a base 10 integer and take the last 5 digits. Pad if necessary.

> TODO: This might not be the best "hashing function" from a signature to 00000 - 99999

## Notes

- It doesn't make sense for Bob to send a request as it would just spam the channel
- It doesn't make sense for Bob to send his public key as we can't authenticate him yet anyways, meaning that we'd just send the same data encrypted to anyone who asks, allowing for man-in-the-middle attacks
- The signature function should be chosen to be fairly expensive
