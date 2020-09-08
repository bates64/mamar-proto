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

import { Instrument } from '../song/Song'

/** Handles audio playback. */
export default class Player {
	synth: Synthesizer
	seq: ISequencer

	bpm = 120

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

		this.seq.setTimeScale(1000) // 1000 ticks per second
	}

	protected timeToTick(milliseconds: number): number {
		// TODO: consider dynamic bpm
		const msPerTick = (60 / this.bpm) * 1000
		return msPerTick * milliseconds
	}

	protected translateBank(bank: number): number {
		// TODO(research): pm64.sf2 has only two banks. What are the other ones used in vanilla for?
		return bank === 0 ? 0 : 1
	}

	/**
	 * Queue a note to play.
	 * @param time Relative time offset (in ms) to play the note at.
	 * @param channel Channel number (0-15)
	 * @param pitch MIDI note number (0-127). Note that many instruments have pitch limits.
	 * @param velocity Volume (0-127)
	 * @param duration Length of note in milliseconds.
	 */
	playNote(time: number, channel: number, pitch: number, velocity: number, duration: number): void {
		// TODO: check for pitch limit breaches depending on channel's instrument

		this.seq.sendEventAt({
			type: 'note-on',
			channel,
			key: pitch,
			vel: velocity,
		}, this.timeToTick(time), false)
		this.seq.sendEventAt({
			type: 'note-off',
			channel,
			key: pitch,
		}, this.timeToTick(time + duration), false)

		// TODO: instrument reverb
	}

	/**
	 * Queue a channel changing instrument.
	 * @param time Relative time offset (in ms) to change instrument at.
	 * @param channel Channel number (0-15)
	 */
	loadInstrument(time: number, channel: number, instrument: Instrument): void {
		// TODO: handle Drum

		this.seq.sendEventAt({
			type: 'control-change',
			channel,
			control: 0x00, // MSB Bank Select
			value: this.translateBank(instrument.bank) << 8,
		}, this.timeToTick(time), false)
		this.seq.sendEventAt({
			type: 'control-change',
			channel,
			control: 0x20, // LSB Bank Select
			value: this.translateBank(instrument.bank),
		}, this.timeToTick(time), false)
		this.seq.sendEventAt({
			type: 'program-change',
			channel,
			preset: instrument.patch,
		}, this.timeToTick(time), false)
		this.seq.sendEventAt({
			type: 'control-change',
			channel,
			control: 0x07, // Volume
			value: instrument.volume, // TODO: range
		}, this.timeToTick(time), false)
		this.seq.sendEventAt({
			type: 'control-change',
			channel,
			control: 0x0A, // Pan
			value: instrument.pan, // TODO: range (MIDI is 0-127)
		}, this.timeToTick(time), false)
	}
}
