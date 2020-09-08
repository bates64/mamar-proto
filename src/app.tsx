import { FunctionComponent } from 'preact'
import { useState, useCallback } from 'preact/hooks'

import { fileOpen } from 'browser-nativefs'

import Song from './song/Song'
import { NoteCmd, SetTempoCmd, LoadInstrumentCmd } from './song/Command'
import midiToSong from './song/midi'

import type Player from './playback/Player'

export const App: FunctionComponent = props => {
	const [player, setPlayer] = useState<Player>(null)
	const [song, setSong] = useState<Song>(null)

	const openMidi = useCallback(async () => {
		// Load song
		const file = await fileOpen({
			mimeTypes: ['audio/midi', 'audio/x-midi'],
			extensions: ['mid', 'midi'],
			description: 'MIDI file',
		}) as File
		const data = new Uint8Array(await file.arrayBuffer())
		const song = midiToSong(data)
		song.name = file.name.replace(/\.midi?$/, '')
		setSong(song)

		// Load player
		const { default: Player } = await import('./playback/Player')
		const player = new Player()
		await player.setup()
		setPlayer(player)
	}, [])

	const playSong = useCallback(() => {
		console.log(song)

		const subsegment = song.segments[0]?.subsegments[0]
		if (!subsegment) return

		let bpmChanges = 0

		for (let channel = 0; channel < subsegment.tracks.length; channel++) {
			const { commands } = subsegment.tracks[channel]

			for (const command of commands) {
				if (command instanceof NoteCmd) {
					player.playNote(command.time, channel, command.pitch, command.velocity, command.duration)
				} else if (command instanceof SetTempoCmd) {
					player.bpm = command.bpm
					if (bpmChanges++ > 0) {
						// TODO: support dynamic tempo changes
						console.warn('song uses dynamic tempo, which is not supported')
					}
				} else if (command instanceof LoadInstrumentCmd) {
					// FIXME: instrument loads at t=0 come AFTER notes at t=0. This is probably because Song.insertCommand does not guarantee the order of commands with the same time.
					player.loadInstrument(command.time, channel, command.instrument)
				}
			}
		}
	}, [player, song])

	return (
		<>
			<p>Hello, world!</p>
			{song === null && <button onClick={openMidi}>Open MIDI</button>}
			{player && song && <button onClick={playSong}>Play {song.name}</button>}
		</>
	)
}
