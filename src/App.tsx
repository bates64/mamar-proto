import { useState, useCallback } from 'preact/hooks'

import { fileOpen } from 'browser-nativefs'

import Button from './ui/Button'
import { Page, Play } from './ui/icon'

import Song from './song/Song'
import { NoteCmd } from './song/Command'
import midiToSong from './song/midi'

import type Player from './playback/Player'

import './App.css'

export default () => {
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

		const segment = song.segments[0]
		if (!segment) return
		player.bpm = segment.tempoAt(0)

		const subsegment = segment.subsegments[0]
		if (!subsegment) return

		for (let channel = 0; channel < subsegment.tracks.length; channel++) {
			for (const section of subsegment.tracks[channel].sections) {
				player.loadInstrument(section.time, channel, section.instrument)

				for (const command of section.commands) {
					if (command instanceof NoteCmd) {
						player.playNote(command.time, channel, command.pitch, command.velocity, command.duration)
					}
				}
			}
		}
	}, [player, song])

	return (
		<div class='App'>
			{song === null && <Button large onClick={openMidi}><Page color='black'/>Open MIDI</Button>}
			{player && song && <Button large onClick={playSong}><Play color='#519872'/>Play {song.name}</Button>}
		</div>
	)
}
