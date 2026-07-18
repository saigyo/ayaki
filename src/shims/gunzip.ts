import { ungzip } from 'pako'

/**
 * Drop-in replacement for zlibjs/bin/gunzip.min.js (crashes under strict-mode
 * ESM bundling). Sniffs the gzip magic bytes so data already decompressed by
 * the transport (dev/preview servers set Content-Encoding for .gz files)
 * passes through untouched.
 */
class Gunzip {
  private readonly data: Uint8Array
  constructor(data: Uint8Array) {
    this.data = data
  }
  decompress(): Uint8Array {
    return this.data[0] === 0x1f && this.data[1] === 0x8b ? ungzip(this.data) : this.data
  }
}
export const Zlib = { Gunzip }
export default { Zlib }
