import { Instrument } from './Song'

export default abstract class Command {
	/**
	 * Relative to the start of the subsegment. One time unit is a crotchet (1/4 of a bar).
	 * Should not be mutated without consulting the parent Track.
	 */
	readonly time: number

	constructor(time: number) {
		this.time = time
	}
}

export class NoteCmd extends Command {
	pitch: number
	velocity: number // max 127
	duration: number

	constructor(time: number, pitch: number, velocity: number, duration: number) {
		super(time)
		this.pitch = pitch
		this.velocity = velocity
		this.duration = duration
	}
}

export class LoadInstrumentCmd extends Command {
	instrument: Instrument

	constructor(time: number, instrument: Instrument) {
		super(time)
		this.instrument = instrument
	}
}

export class SetTempoCmd extends Command {
	bpm: number

	constructor(time: number, bpm: number) {
		super(time)
		this.bpm = bpm
	}
}

// TODO
