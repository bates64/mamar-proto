// Expose the FluidSynth namespace globally as expected by js-synthesizer
import * as FluidSynth from './libfluidsynth-2.1.3'
declare global {
	interface Window {
		Module: WebAssembly.Module
		addFunction: any
		removeFunction: any
	}
}
window.Module = FluidSynth.default
window.addFunction = FluidSynth.addFunction
window.removeFunction = FluidSynth.removeFunction

import type { Synthesizer, ISequencer } from 'js-synthesizer'

/** Handles audio playback. */
export default class Player {
	synth: Synthesizer
	seq: ISequencer

	/** Sets up the synthesizer, loads the soundfont, and connects output to the user's speakers. */
	async setup(audioContext = new AudioContext()): Promise<void> {
		const { Synthesizer, waitForReady } = await import('js-synthesizer')

		await waitForReady()

		this.synth = new Synthesizer()
		this.synth.init(audioContext.sampleRate, {
			midiChannelCount: 16,
			// TODO: test polyphony values against game for accuracy
		})
		await this.synth.loadSFont(await fetch('/pm64.sf2').then(data => data.arrayBuffer()))

		// Output to `audioContext.destination` (i.e. the user's speakers)
		const node = this.synth.createAudioNode(audioContext, 8192)
		node.connect(audioContext.destination)

		// Create and link a sequencer for time-sensitive event pushing.
		this.seq = await Synthesizer.createSequencer()
		await this.seq.registerSynthesizer(this.synth)
	}

	/**
	 * Queue a note to play.
	 * @param time Relative time offset (in ms) to play the note at.
	 * @param channel Channel number (0-15)
	 * @param pitch MIDI note number (0-127). Note that many instruments have pitch limits.
	 * @param velocity Volume (0-127)
	 * @param duration Length of note in milliseconds.
	 */
	async playNote(time: number, channel: number, pitch: number, velocity: number, duration: number): Promise<void> {
		// TODO: check for pitch limit breaches depending on channel's instrument

		this.seq.sendEventAt({
			type: 'note-on',
			channel,
			key: pitch,
			vel: velocity,
		}, time, false)
		this.seq.sendEventAt({
			type: 'note-off',
			channel,
			key: pitch,
		}, time + duration, false)
	}
}
