import Command from './Command'

export default class Song {
	name?: string
	segments: [Segment?, Segment?, Segment?, Segment?] = []
	drums: Drum[] = []
	instruments: Instrument[] = []

	addSegment(): Segment {
		for (let i = 0; i < 4; i++) {
			if (!this.segments[i]) {
				return this.segments[i] = new Segment(this)
			}
		}

		throw new Error('A song can have a maximum of 4 segments')
	}
}

export class Instrument {
	name: string

	bank: number
	patch: number
	volume: number
	pan: number
	reverb: number
	tuneCoarse: number
	tuneFine: number
	unknown7: number
}

export class Drum extends Instrument {
	unknown8: number
	unknown9: number
	unknownA: number
	unknownB: number
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
		const index = this.findIndexForTime(command.time)
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
