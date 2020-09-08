import Song, { Instrument, Segment } from './Song'
import { NoteCmd, SetTempoCmd, LoadInstrumentCmd } from './Command'
import Reader from './Reader'

export default function loadToSong(data: Uint8Array): Song {
	return convert(deserialize(data))
}

type Midi = {
	format: MidiFormat
	timeDivision: TimeDivision
	tracks: MidiTrack[]
	otherChunks: Chunk[]
}

enum MidiFormat { SingleTrack, MultiTrack, Pattern }

type TimeDivision = {
	ticksPerQuarterNote: number
}

type Chunk = {
	type: string
	data: Uint8Array
}

type MidiTrack = {
	events: MidiEvent[]
}

type MidiEvent = MidiMessage | MetaEvent | SysExEvent

type MidiMessage = ChannelVoiceMessage | {
	type: 'UNKNOWN'
	deltaTime: number
	status: number
}

type ChannelVoiceMessage = {
	type: 'NOTE_OFF'
	deltaTime: number
	channel: number
	note: number
	velocity: number
} | {
	type: 'NOTE_ON'
	deltaTime: number
	channel: number
	note: number
	velocity: number
} | {
	type: 'KEY_PRESSURE'
	deltaTime: number
	channel: number
	note: number
	pressure: number
} | {
	type: 'CONTROL_CHANGE'
	deltaTime: number
	channel: number
	controller: number // Device, e.g. pedal or lever
	value: number
} | ProgramChangeEvent | {
	// Like KEY_PRESSURE, but applies to all notes on the channel
	type: 'CHANNEL_PRESSURE'
	deltaTime: number
	channel: number
	pressure: number
} | {
	type: 'PITCH_WHEEL_CHANGE'
	deltaTime: number
	channel: number
	fine: number
	coarse: number
}

type ProgramChangeEvent = {
	type: 'PROGRAM_CHANGE'
	deltaTime: number
	channel: number
	program: number
}

enum MetaEventType {
	SequenceNumber = 0x00,
	TextEvent,
	CopyrightNotice,
	TrackName,
	InstrumentName,
	Lyric,
	Marker,
	CuePoint,
	MIDIChannelPrefix = 0x20,
	EndOfTrack = 0x2F,
	SetTempo = 0x51,
	SMPTEOffset,
	TimeSignature = 0x58,
	KeySignature,
	SequencerSpecific = 0x7F,
}

type MetaEvent = {
	type: 'META'
	deltaTime: number
	metaType: MetaEventType
	data: number[]
} | {
	type: 'TRACK_NAME'
	deltaTime: number
	name: string
} | SetTempoEvent

type SetTempoEvent = {
	type: 'SET_TEMPO'
	deltaTime: number
	microsecondsPerQuarterNote: number
}

type SysExEvent = {
	type: 'SYSTEM_EXCLUSIVE'
	deltaTime: number
	data: number[]
}

/**
 * Deserializes a Standard MIDI File to a low-level structured equivalent.
 *
 * References;
 * - https://www.midi.org/specifications/item/the-midi-1-0-specification
 * - https://www.cs.cmu.edu/~music/cmsip/readings/Standard-MIDI-file-format-updated.pdf
 */
function deserialize(data: Uint8Array, warn: (message: string) => void = console.warn): Midi {
	const file = new Reader(data)

	const chunks: { type: string, length: number, pointer: number }[] = []
	while (!file.eof()) {
		const chunk = {
			type: file.readASCII(4),
			length: file.readUint32(),
			pointer: file.pointer,
		}

		file.advance(chunk.length)
		chunks.push(chunk)
	}

	const header = chunks.shift()
	if (!header) throw new MalformedMIDIError('Missing header chunk')
	if (header.type !== 'MThd') throw new MalformedMIDIError('First chunk must be the header')
	if (header.length !== 6) warn(`Header length should be 6, but it is ${header.length}`)

	file.seek(header.pointer)

	const format = file.readUint16()
	if (![0, 1, 2].includes(format)) {
		warn(`Unknown format: ${format}`)
	}

	file.readUint16() // Number of tracks

	let timeDivision: TimeDivision
	if ((file.peekUint8() & 0b10000000) === 0) {
		timeDivision = { ticksPerQuarterNote: file.readUint16() }
	} else {
		// TODO
		throw new Error('SMPTE timecode divisions are not yet supported')
	}

	const tracks: MidiTrack[] = []
	const otherChunks: Chunk[] = []
	for (const chunk of chunks) {
		file.seek(chunk.pointer)

		switch (chunk.type) {
			// Header
			case 'MThd':
				// We should have already parsed the header when we read the first chunk!
				throw new MalformedMIDIError('Multiple header chunks')

			// Track
			case 'MTrk': {
				const events: MidiEvent[] = []
				let runningStatus
				while (file.pointer < chunk.pointer + chunk.length) {
					const deltaTime = file.readVLV()

					switch (file.peekUint8()) {
						// Meta Event
						case 0xFF: {
							file.advance(1) // 0xFF
							const type = file.readUint8()
							const length = file.readVLV()

							switch (type) {
								case MetaEventType.TrackName:
									events.push({
										type: 'TRACK_NAME',
										deltaTime,
										name: file.readASCII(length),
									})
									break
								case MetaEventType.SetTempo:
									events.push({
										type: 'SET_TEMPO',
										deltaTime,
										microsecondsPerQuarterNote: file.readUint24(),
									})
									break
								// TODO
								default:
									events.push({
										type: 'META',
										deltaTime,
										metaType: type,
										data: [...file.readBytes(length)],
									})
							}

							runningStatus = undefined
						} break

						// System Exclusive Event
						case 0xF0:
						case 0xF7: {
							const type = file.readUint8()
							const length = file.readVLV()

							events.push({
								type: 'SYSTEM_EXCLUSIVE',
								deltaTime,
								data: [type, ...file.readBytes(length)],
							})
							runningStatus = undefined
						} break

						// MIDI Message
						default: {
							let status = file.peekUint8()
							if (status >> 7 === 1) {
								runningStatus = file.readUint8()
							} else {
								// First bit is 0, meaning this is not a status.
								// In this case we reuse the status of the previous event.
								if (!runningStatus) {
									// ???
									warn('Running status used but none defined')
									file.readUint8() // Skip it
									break
								}
								status = runningStatus
							}

							switch ((status >> 4) & 0b0111) {
								case 0:
									events.push({
										type: 'NOTE_OFF',
										deltaTime,
										channel: status & 0xF,
										note: file.readUint8(),

										// https://stackoverflow.com/questions/3306866/
										// Sometimes affects release time.
										velocity: file.readUint8(),
									})
									break
								case 1:
									events.push({
										type: 'NOTE_ON',
										deltaTime,
										channel: status & 0xF,
										note: file.readUint8(),

										// This can be zero, in which case it's equivalent to a NOTE_OFF.
										velocity: file.readUint8(),
									})
									break
								case 2:
									events.push({
										type: 'KEY_PRESSURE',
										deltaTime,
										channel: status & 0xF,
										note: file.readUint8(),
										pressure: file.readUint8(),
									})
									break
								case 3:
									events.push({
										type: 'CONTROL_CHANGE',
										deltaTime,
										channel: status & 0xF,
										controller: file.readUint8(),
										value: file.readUint8(),
									})
									break
								case 4:
									events.push({
										type: 'PROGRAM_CHANGE',
										deltaTime,
										channel: status & 0xF,
										program: file.readUint8(),
									})
									break
								case 5:
									events.push({
										type: 'CHANNEL_PRESSURE',
										deltaTime,
										channel: status & 0xF,
										pressure: file.readUint8(),
									})
									break
								case 6:
									events.push({
										type: 'PITCH_WHEEL_CHANGE',
										deltaTime,
										channel: status & 0xF,
										fine: file.readUint8(),
										coarse: file.readUint8(),
									})
									break
								default:
									events.push({
										type: 'UNKNOWN',
										deltaTime,
										status,
									})
							}
						}
					}
				}
				tracks.push({ events })
			} break

			// Other (specification says to ignore unknown chunk types)
			default:
				warn(`Unknown chunk type: "${chunk.type}"`)
				otherChunks.push({
					type: chunk.type,
					data: file.readBytes(chunk.length),
				})
		}
	}

	return {
		format,
		timeDivision,
		tracks,
		otherChunks,
	}
}

export class MalformedMIDIError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'MalformedMIDIError'
	}
}

/**
 * Converts a low-level Midi to a higher-level Song. Lossy.
 * This is done by effectively performing the Midi in memory in order to determine the lengths of events and notes.
 */
export function convert(midi: Midi): Song {
	const { ticksPerQuarterNote } = midi.timeDivision

	if (midi.format === 2) {
		// TODO: find a MIDI file that actually uses this
		throw new Error('MIDI format 2 (multi-sequence) is unsupported')
	}

	const usedChannels = new Set<number>()

	/*
	// TODO: Combine UPDATE_INSTRUMENTs executed at the same time

	const initialMasterCommands = []
	for (const command of masterCommands) {
		if (command.time > 0) break
		initialMasterCommands.push(command)
	}

	const instruments: Instrument[] = [] // There might be holes in this array!
	for (const channelNo of usedChannels) {
		const instrument = {
			bank: 0,
			patch: 0,
			tuneCoarse: 0,
			tuneFine: 0,
			volume: 1,
			pan: 0,
			reverb: 0,
		}

		// Apply time=0 updates to this instrument, removing the updates from `masterCommands`.
		// Note we don't mutate `initialMasterCommands` in this list.
		for (const command of initialMasterCommands) {
			if (command.type !== 'UPDATE_INSTRUMENT') continue
			if (command.channel !== channelNo) continue

			// Mutate `instrument` with the partial.
			Object.assign(instrument, command.update)

			// Simple linear search from the start of commands. We can't use a binary search
			// because we know that time=0 and that's the non-unique sort key, plus we know
			// it'll be somewhere near the start of `masterCommands` since time=0.
			for (let i = 0; i < masterCommands.length; i++) {
				if (masterCommands[i].id === command.id) {
					// Delete it :)
					masterCommands.splice(i, 1)
					continue
				}
			}
		}

		instruments[channelNo] = instrument
	}

	return {
		instruments,
		sections: [
			{
				commands: masterCommands,
				tracks,
			},
		],
	}
	*/

	const song = new Song()
	const subsegment = song.addSegment().addSubsegment()

	for (const midiTrack of midi.tracks) {
		const track = subsegment.addTrack()

		// We make an assumption about the MIDI file here: that it makes sense to assign each track exactly one
		// instrument. This obviously won't be logical for some files (e.g. files optimised to fit more than 16
		// instruments into 16 channels), but it'll likely be good enough for most people. Additionally, it
		// makes track-specific control events easier to reason about and translate.
		const instrument = song.addInstrument()
		track.insertCommand(new LoadInstrumentCmd(0, instrument))

		// TODO: handle channel 9 (drum)

		let time = 0

		// Tracks notes that are currently being played, so we can determine their lengths.
		const activeNotes: Set<{
			startTime: number
			channel: number
			note: number
			velocity: number
		}> = new Set()

		for (const event of midiTrack.events) {
			time += event.deltaTime / ticksPerQuarterNote

			if (event.type === 'NOTE_OFF' || (event.type === 'NOTE_ON' && event.velocity === 0)) {
				for (const active of activeNotes) {
					if (active.note === event.note && active.channel === event.channel) {
						track.insertCommand(new NoteCmd(active.startTime, event.note, active.velocity, time - active.startTime))
						activeNotes.delete(active)
						break
					}
				}
			} else if (event.type === 'NOTE_ON') {
				usedChannels.add(event.channel)
				activeNotes.add({
					startTime: time,
					channel: event.channel,
					note: event.note,
					velocity: event.velocity,
				})
			} else if (event.type === 'META' && event.metaType === MetaEventType.EndOfTrack) {
				track.duration = time
			} else if (event.type === 'SET_TEMPO') {
				// See https://www.midi.org/forum/4452-calculate-absolute-time-from-ppq-and-ticks.
				// Note that we already handle ticksPerQuarterNote in `time`.
				const bpm = Math.round(1000000 * 60 / event.microsecondsPerQuarterNote)
				track.insertCommand(new SetTempoCmd(time, bpm))
			} else if (event.type === 'CONTROL_CHANGE') {
				if (time === 0) {
					// Instrument setup.
					// See https://www.midi.org/specifications-old/item/table-3-control-change-messages-data-bytes-2
					if (event.controller === 0x00) instrument.bank = event.value << 8
					if (event.controller === 0x20) instrument.bank = (instrument.bank & 0xFF) + event.value
					if (event.controller === 0x07) instrument.volume = event.value
					if (event.controller === 0x0A) instrument.pan = event.value // TODO: range
					if (event.controller === 0x5B) instrument.reverb = event.value
				} else {
					// TODO: handle t != 0
				}
			} else if (event.type === 'PROGRAM_CHANGE') {
				if (time === 0) {
					// Instrument setup.
					instrument.patch = event.program
				} else {
					// TODO: handle t != 0
				}
			}
		}

		// There shouldn't be any notes that don't end, but we'll handle them anyway.
		for (const { startTime, note, velocity } of activeNotes) {
			track.insertCommand(new NoteCmd(startTime, note, velocity, time - startTime))
		}
	}

	return song
}
