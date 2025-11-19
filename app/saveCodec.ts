/**
 * No Man's Sky Save Codec - TypeScript Implementation
 * 
 * This module handles compression, decompression, and key mapping for NMS save files.
 * Based on the Python decoder-encode-nms.py script by Robert Maupin (2021)
 */

import * as lz4 from 'lz4';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface MappingItem {
  Key: string;
  Value: string;
}

interface Mapping {
  libMBIN_version: string;
  Mapping: MappingItem[];
}

interface DotZeroLocation {
  prop: string;
  value: number;
  arrayIndex?: number;
}

interface SaveMetadata {
  version: number;
  originalBinary: string;
  hasTrailingNull: boolean;
  dotZeroLocations: DotZeroLocation[];
}

interface WrappedSaveData {
  __NMS_META__: SaveMetadata;
  data: any;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BLOCK_MAGIC = 0xfeeda1e5;
const MAX_BLOCK_SIZE = 0x80000; // 524288 bytes (512 KB)

// ============================================================================
// MAPPING
// ============================================================================

let cachedMapping: MappingItem[] | null = null;

/**
 * Load mapping from local file
 */
function loadMapping(): MappingItem[] {
  if (cachedMapping) {
    return cachedMapping;
  }

  try {
    // Try to load from save-decoder directory
    const mappingPath = path.join(__dirname, '..', 'save-decoder', 'mapping.json');
    const mappingData = fs.readFileSync(mappingPath, 'utf8');
    const parsed: Mapping = JSON.parse(mappingData);
    cachedMapping = parsed.Mapping;
    return cachedMapping;
  } catch (err) {
    console.error('Failed to load mapping.json:', err);
    return [];
  }
}

/**
 * Apply key mapping at binary level without parsing JSON
 * Finds quoted keys and replaces them, handling length differences
 */
export function applyMapping(buffer: Buffer, reverse = false): Buffer {
  const mappingData = loadMapping();
  if (mappingData.length === 0) {
    console.warn('No mapping data available, returning buffer unchanged');
    return buffer;
  }

  let data = buffer;
  let totalReplacements = 0;

  // Sort mappings by search string length (longest first)
  // This prevents replacing parts of longer keys
  const sortedMappings = [...mappingData].sort((a, b) => {
    const aKey = reverse ? a.Value : a.Key;
    const bKey = reverse ? b.Value : b.Key;
    return bKey.length - aKey.length;
  });

  for (const item of sortedMappings) {
    const search = reverse ? item.Value : item.Key;
    const replace = reverse ? item.Key : item.Value;

    // Pattern: "key": (with quote, colon, and possible whitespace)
    const searchPattern = `"${search}":`;
    const replacePattern = `"${replace}":`;

    const searchBuffer = Buffer.from(searchPattern, 'utf8');
    const replaceBuffer = Buffer.from(replacePattern, 'utf8');

    // Find and replace all occurrences
    const newData = replaceAllInBuffer(data, searchBuffer, replaceBuffer);

    if (newData.length !== data.length) {
      const diff = newData.length - data.length;
      const count = Math.abs(diff) / Math.abs(replaceBuffer.length - searchBuffer.length);
      totalReplacements += count;
    }

    data = newData;
  }

  console.log(`Applied ${totalReplacements} key replacements`);
  return data;
}

/**
 * Replace all occurrences of searchBuffer with replaceBuffer
 * Handles different lengths by reconstructing the buffer
 */
function replaceAllInBuffer(buffer: Buffer, searchBuffer: Buffer, replaceBuffer: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let position = 0;

  while (position < buffer.length) {
    const index = buffer.indexOf(searchBuffer, position);

    if (index === -1) {
      // No more matches, add remaining data
      chunks.push(buffer.slice(position));
      break;
    }

    // Add data before match
    if (index > position) {
      chunks.push(buffer.slice(position, index));
    }

    // Add replacement
    chunks.push(replaceBuffer);

    // Move past the match
    position = index + searchBuffer.length;
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : buffer;
}

// ============================================================================
// ID ENCODING FIX
// ============================================================================

/**
 * Fix encoding issues in No Man's Sky save files
 * Converts binary ID bytes to hex string representation
 * Pattern: ^[binary bytes]#[number] -> ^[HEX]#[number]
 */
export function fixIDEncoding(buffer: Buffer): Buffer {
  const result: number[] = [];
  let i = 0;

  while (i < buffer.length) {
    const byte = buffer[i];

    // Look for '^' character (0x5E)
    if (byte === 0x5E) {
      // Find the next '#' character (0x23)
      let hashPos = -1;
      for (let j = i + 1; j < Math.min(i + 50, buffer.length); j++) {
        if (buffer[j] === 0x23) {
          hashPos = j;
          break;
        }
      }

      if (hashPos > i + 1) {
        // Extract bytes between ^ and #
        const idBytes = buffer.slice(i + 1, hashPos);

        // Check if any bytes are non-ASCII (> 127) - these need hex conversion
        const hasNonASCII = idBytes.some(b => b > 127 || b < 32);

        if (hasNonASCII) {
          // Convert to hex string: ^HEXHEX...
          result.push(0x5E); // ^
          const hexString = idBytes.toString('hex').toUpperCase();
          for (const char of hexString) {
            result.push(char.charCodeAt(0));
          }
          // Continue from the # position
          i = hashPos;
          continue;
        }
      }
    }

    // Regular byte - copy as-is
    result.push(byte);
    i++;
  }

  return Buffer.from(result);
}

/**
 * Reverse: Convert hex string IDs back to binary bytes
 * Pattern: ^[HEXHEX]#[number] -> ^[binary bytes]#[number]
 */
export function unfixIDEncoding(buffer: Buffer): Buffer {
  const result: number[] = [];
  let i = 0;

  while (i < buffer.length) {
    const byte = buffer[i];

    // Look for '^' character (0x5E)
    if (byte === 0x5E) {
      // Find the next '#' character (0x23)
      let hashPos = -1;
      for (let j = i + 1; j < Math.min(i + 100, buffer.length); j++) {
        if (buffer[j] === 0x23) {
          hashPos = j;
          break;
        }
      }

      if (hashPos > i + 1) {
        // Extract bytes between ^ and #
        const hexStringBytes = buffer.slice(i + 1, hashPos);
        const hexString = hexStringBytes.toString('ascii');

        // Check if this is a valid hex string (even length, only 0-9A-F)
        if (hexString.length > 0 &&
            hexString.length % 2 === 0 &&
            /^[0-9A-F]+$/i.test(hexString)) {

          // Convert hex string back to raw bytes
          result.push(0x5E); // ^

          for (let k = 0; k < hexString.length; k += 2) {
            const hexByte = hexString.substr(k, 2);
            result.push(parseInt(hexByte, 16));
          }

          // Continue from the # position
          i = hashPos;
          continue;
        }
      }
    }

    // Regular byte - copy as-is
    result.push(byte);
    i++;
  }

  return Buffer.from(result);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert 4 bytes to a little endian unsigned integer
 */
function uint32(data: Buffer, offset = 0): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0; // Ensure unsigned 32-bit
}

/**
 * Convert unsigned 32 bit integer to 4 bytes
 */
function byte4(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

// ============================================================================
// DECOMPRESSION
// ============================================================================

/**
 * Decompresses the given save bytes
 */
export function decompress(data: Buffer): Buffer {
  const size = data.length;
  let pos = 0;
  const out: Buffer[] = [];

  while (pos < size) {
    // Read magic
    const magic = uint32(data, pos);
    if (magic !== BLOCK_MAGIC) {
      console.error('Invalid Block, bad file');
      return Buffer.alloc(0); // some unsupported format
    }

    // Read sizes
    const compressedSize = uint32(data, pos + 4);
    const uncompressedSize = uint32(data, pos + 8);
    
    // Skip 4 bytes (reserved)
    pos += 16;

    // Read compressed block
    const compressedBlock = data.slice(pos, pos + compressedSize);
    
    // Decompress using lz4.decode (raw block decompression)
    const decompressedBlock = Buffer.alloc(uncompressedSize);
    const decodedSize = lz4.decodeBlock(compressedBlock, decompressedBlock);
    
    // Verify decompression succeeded
    if (decodedSize !== uncompressedSize) {
      console.warn(`Warning: Block decompressed to ${decodedSize} bytes, expected ${uncompressedSize}`);
    }
    
    out.push(decompressedBlock);
    pos += compressedSize;
  }

  // Concatenate all blocks
  return Buffer.concat(out);
}

// ============================================================================
// COMPRESSION
// ============================================================================

/**
 * Compresses the given save bytes
 */
export function compress(data: Buffer): Buffer {
  const size = data.length;
  let pos = 0;
  const out: Buffer[] = [];

  while (pos < size) {
    // Calculate uncompressed block size (min of MAX_BLOCK_SIZE or remaining)
    const uncompressedSize = Math.min(MAX_BLOCK_SIZE, size - pos);
    
    // Extract block
    const block = data.slice(pos, pos + uncompressedSize);
    
    // Compress using lz4.encode (raw block compression)
    const maxCompressedSize = lz4.encodeBound(uncompressedSize);
    const compressedBlock = Buffer.alloc(maxCompressedSize);
    const compressedSize = lz4.encodeBlock(block, compressedBlock);
    
    // Trim to actual compressed size
    const actualCompressed = compressedBlock.slice(0, compressedSize);
    
    // Write header
    out.push(byte4(BLOCK_MAGIC));
    out.push(byte4(compressedSize));
    out.push(byte4(uncompressedSize));
    out.push(byte4(0)); // reserved
    
    // Write compressed block
    out.push(actualCompressed);
    
    pos += uncompressedSize;
  }

  // Concatenate all parts
  return Buffer.concat(out);
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

/**
 * Decode a save file (decompress + fix ID encoding + apply mapping)
 */
export function decodeSave(data: Buffer, useMapping = false): Buffer {
  console.log('Decompressing save file...');
  let decompressed = decompress(data);

  console.log('Fixing ID encoding...');
  decompressed = fixIDEncoding(decompressed);

  if (useMapping) {
    console.log('Applying forward mapping...');
    decompressed = applyMapping(decompressed, false);
  }

  return decompressed;
}

/**
 * Encode a save file (reverse mapping + unfix ID encoding + compress)
 */
export function encodeSave(data: Buffer, useMapping = false): Buffer {
  let processed = data;

  if (useMapping) {
    console.log('Applying reverse mapping...');
    processed = applyMapping(processed, true);
  }

  console.log('Unfixing ID encoding...');
  processed = unfixIDEncoding(processed);

  console.log('Compressing save file...');
  const compressed = compress(processed);

  return compressed;
}

