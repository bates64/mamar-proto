import Command, { NoteCmd } from './Command'

export default class Song {
	name?: string
	segments: [Segment?, Segment?, Segment?, Segment?] = []
	instruments: Instrument[] = []
	drums: Drum[] = []

	addSegment(): Segment {
		for (let i = 0; i < 4; i++) {
			if (!this.segments[i]) {
				return this.segments[i] = new Segment(this)
			}
		}

		throw new Error('A song can have a maximum of 4 segments')
	}

	addInstrument(): Instrument {
		const instrument = new Instrument(this, this.instruments.length)
		this.instruments.push(instrument)
		return instrument
	}

	addDrum(): Drum {
		const drum = new Drum(this, this.instruments.length)
		this.drums.push(drum)
		return drum
	}
}

export class Instrument {
	protected song: Song

	name?: string
	readonly index: number

	constructor(parent: Song, index: number) {
		this.song = parent
		this.index = index
	}

	// TODO: determine ranges for these values, e.g. is pan=0 hard left, pan=255 hard right?
	bank = 0
	patch = 0
	volume = 127
	pan = 64
	reverb = 0
	tuneCoarse = 0
	tuneFine = 0
	unknown7 = 0
}

export class Drum extends Instrument {
	// TODO
	unknown8 = 0
	unknown9 = 0
	unknownA = 0
	unknownB = 0
}

export class Segment {
	protected song: Song

	name?: string
	subsegments: Subsegment[] = []

	constructor(parent: Song) {
		this.song = parent
	}

	addSubsegment(): Subsegment {
		const subseg = new Subsegment(this)
		this.subsegments.push(subseg)
		return subseg
	}
}

export class Subsegment {
	protected segment: Segment

	name: string
	flags: number
	tracks: Track[] = []

	constructor(parent: Segment) {
		this.segment = parent
	}

	addTrack(): Track {
		const track = new Track(this)
		this.tracks.push(track)
		return track
	}
}

export class Track {
	protected subsegment: Subsegment

	flags = 0
	commands: Command[] = []
	muteState = MuteState.Play
	duration = 0

	constructor(parent: Subsegment) {
		this.subsegment = parent
	}

	// TODO: should this be reflected in exported BGM?
	canHear(): boolean {
		// Check if any of the parent subsegment tracks are Solo, including ourselves.
		const hasSoloTracks = this.subsegment.tracks.some(track => track.muteState === MuteState.Solo)

		// If any tracks are Solo, we must be Solo to be heard.
		return hasSoloTracks ? this.muteState === MuteState.Solo : this.muteState === MuteState.Play
	}

	/**
	 * Finds an appropriate index to insert a command at time `targetTime`, assuming any existing
	 * command at the returned array index is pushed to the right rather than be replaced.
	 */
	private findIndexForTime(targetTime: number): number {
		let min = 0
		let max = this.commands.length

		// Quick check for `targetTime` being after our last command, as that's a common case.
		if (max && this.commands[max - 1].time < targetTime) return max

		while (max > min) {
			const index = Math.floor((min + max) / 2)

			if (this.commands[index].time > targetTime) max = index
			else if (this.commands[index].time < targetTime) min = index + 1
			else return index
		}

		return min
	}

	/** Inserts the given command into the list, appropriate to its time. */
	insertCommand(command: Command): void {
		let index = this.findIndexForTime(command.time)

		// Special-case for NoteCmds: they should always be placed at the tail of a set of commands at
		// the same time as them. This mitigates an issue where playback would queue an instrument change
		// *after* a note is played, despite both commands having the same time value (common at t=0 of
		// MIDI data), leaving the note at that time using the old (or undefined!) instrument settings.
		//
		// This could arguably be done with all insertions (not just with NoteCmd), but, as most (!)
		// commands are not dependent on exact ordering at the same time value, we can skip this.
		if (command instanceof NoteCmd) {
			while (index < this.commands.length && this.commands[index].time === command.time) {
				index++
			}
		}

		this.commands.splice(index, 0, command) // In-place.

		if (command.time > this.duration) {
			this.duration = command.time
		}
	}
}

export enum MuteState {
	/** The default state. Unless other tracks are Solo, this is heard. */
	Play,

	/** Explicitly muted. Never heard. */
	Mute,

	/** If any tracks are Solo, only Solo tracks are heard. */
	Solo,
}
