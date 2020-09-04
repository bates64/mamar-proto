export default class Reader {
	data: Uint8Array
	pointer = 0

	constructor(data: Uint8Array) {
		this.data = data
	}

	seek(pointer: number): Reader {
		this.pointer = pointer
		return this
	}

	advance(bytes: number): Reader {
		this.pointer += bytes
		return this
	}

	eof(): boolean {
		return this.pointer >= this.data.length
	}

	peekUint8(): number {
		return this.data[this.pointer]
	}

	readUint8(): number {
		return this.data[this.pointer++]
	}

	peekUint16(): number {
		return (this.data[this.pointer] << 8) +
			this.data[this.pointer]
	}

	readUint16(): number {
		// SMF are always big-endian (most significant first).
		return (this.data[this.pointer++] << 8) +
			this.data[this.pointer++]
	}

	readUint24(): number {
		return (this.data[this.pointer++] << 16) +
			(this.data[this.pointer++] << 8) +
			this.data[this.pointer++]
	}

	readUint32(): number {
		return (this.data[this.pointer++] << 32) +
			(this.data[this.pointer++] << 16) +
			(this.data[this.pointer++] << 8) +
			this.data[this.pointer++]
	}

	readUint64(): number {
		return (this.data[this.pointer++] << 64) +
			(this.data[this.pointer++] << 32) +
			(this.data[this.pointer++] << 16) +
			(this.data[this.pointer++] << 8) +
			this.data[this.pointer++]
	}

	readBytes(length: number): Uint8Array {
		return this.data.slice(this.pointer, this.pointer += length)
	}

	readASCII(length: number): string {
		const bytes = []
		for (let i = 0; i < length; i++) {
			bytes.push(this.readUint8())
		}

		return String.fromCharCode(...bytes)
	}

	readZeroTerminatedASCII(): string {
		const bytes = []
		while (!this.eof()) {
			const byte = this.readUint8()
			if (byte === 0) break
			bytes.push(byte)
		}

		return String.fromCharCode(...bytes)
	}

	/**
	 * Read a Variable Length Value.
	 * This is a direct translation of ReadVarLen() from the SMF specification.
	 */
	readVLV(): number {
		let value = 0

		if ((value = this.readUint8()) & 0x80) {
			value &= 0x7F

			let c
			do {
				value = (value << 7) + ((c = this.readUint8()) & 0x7F)
			} while (c & 0x80)
		}

		return value
	}
}
