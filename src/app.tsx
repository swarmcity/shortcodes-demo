import { Router, Link } from '@reach/router'
import { Waku } from 'js-waku'
import { useState, useEffect } from 'preact/hooks'

// Pages
import { Send } from './pages/send'
import { Receive } from './pages/receive'

export function App() {
	const [waku, setWaku] = useState<Waku>()

	useEffect(() => {
		Waku.create({ bootstrap: { default: true } }).then(setWaku)
	}, [])

	if (!waku) {
		return <div>Loading...</div>
	}

	return (
		<div>
			<nav>
				<Link to="/send">Send</Link> - <Link to="/receive">Receive</Link>
			</nav>
			{/* @ts-expect-error: no clue why this is an issue all of a sudden */}
			<Router>
				<Send path="/send" waku={waku} />
				<Receive path="/receive" waku={waku} />
			</Router>
		</div>
	)
}
