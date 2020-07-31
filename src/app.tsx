import { FunctionComponent } from 'preact'
import { useState, useCallback } from 'preact/hooks'

import type Player from './playback/Player'

const player = (async () => {
	const { default: Player } = await import('./playback/Player')
	const player = new Player()
	await player.setup()
	return player
})()

export const App: FunctionComponent = props => {
	const [player, setPlayer] = useState<Player>(null)
	const loadPlayer = useCallback(async () => {
		const { default: Player } = await import('./playback/Player')
		const player = new Player()
		await player.setup()
		setPlayer(player)
	}, [])

	const playNote = useCallback(() => {
		player.playNote(0, 0, 60, 127, 500)
	}, [player])

	return (
		<>
			<p>Hello, world!</p>
			{player === null
				? <button onClick={loadPlayer}>Load Player</button>
				: <button onClick={playNote}>Play Middle C</button>}
		</>
	)
}
