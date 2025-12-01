/**
 * No Man's Sky Save Codec
 * 
 * Provides two main methods:
 * - decodeSave: Decompresses and decodes a save file
 * - encodeSave: Encodes and compresses data back to save file format
 */

import lz4 from 'lz4-browser';

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

let mapping = null;

async function fetchMapping() {
  if (mapping) return mapping;

  const mappingUrl =
    "https://github.com/monkeyman192/MBINCompiler/releases/latest/download/mapping.json";
  const fetchedFile = await fetch(mappingUrl);
  const fetchedJson = await fetchedFile.json();

  mapping = fetchedJson.Mapping;
  return mapping;
}

// ============================================================================
// METADATA PRESERVATION FUNCTIONS
// ============================================================================

/**
 * Prepare mapped JSON for editing
 * Extracts clean JSON and stores original binary + path map as metadata
 */
function prepareForEditing(mappedBuffer) {
  const str = mappedBuffer.toString('utf8').replace(/\0+$/, '');

  // Scan the original string to find ALL .0 values with their property/value pairs
  const dotZeroLocations = [];

  // Find property: value.0 patterns (e.g., "FoV":60.0)
  const propPattern = /"([^"]+)":(-?\d+)\.0+[,}\]]/g;
  let match;
  while ((match = propPattern.exec(str)) !== null) {
    dotZeroLocations.push({
      prop: match[1],
      value: parseInt(match[2])
    });
  }

  // Find array element .0 patterns
  // We need to find arrays and track which elements have .0
  // Strategy: Find all arrays, parse them to get property name and indices
  const arrayPattern = /"([^"]+)":\[/g;
  while ((match = arrayPattern.exec(str)) !== null) {
    const propName = match[1];
    const arrayStart = match.index + match[0].length;

    // Find the closing bracket for this array
    let depth = 1;
    let pos = arrayStart;
    let arrayContent = '';

    while (pos < str.length && depth > 0) {
      const char = str[pos];
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) break;
      }
      arrayContent += char;
      pos++;
    }

    // Check if this is a simple value array (no nested objects/arrays at depth 1)
    // Count elements and check for .0
    let elementIndex = 0;
    let currentValue = '';
    let nestedDepth = 0;

    for (let i = 0; i < arrayContent.length; i++) {
      const char = arrayContent[i];

      if (char === '[' || char === '{') {
        nestedDepth++;
        currentValue += char;
      } else if (char === ']' || char === '}') {
        nestedDepth--;
        currentValue += char;
      } else if (char === ',' && nestedDepth === 0) {
        // End of current element
        const trimmed = currentValue.trim();
        if (/^-?\d+\.0+$/.test(trimmed)) {
          const value = parseInt(trimmed);
          dotZeroLocations.push({
            prop: propName,
            value: value,
            arrayIndex: elementIndex
          });
        }
        currentValue = '';
        elementIndex++;
      } else {
        currentValue += char;
      }
    }

    // Handle last element
    const trimmed = currentValue.trim();
    if (/^-?\d+\.0+$/.test(trimmed)) {
      const value = parseInt(trimmed);
      dotZeroLocations.push({
        prop: propName,
        value: value,
        arrayIndex: elementIndex
      });
    }
  }

  // Parse the JSON normally (this loses .0 formatting)
  const data = JSON.parse(str);

  return {
    __NMS_META__: {
      version: 11,
      originalBinary: mappedBuffer.toString('base64'),
      hasTrailingNull: mappedBuffer[mappedBuffer.length - 1] === 0,
      dotZeroLocations: dotZeroLocations,
    },
    data: data
  };
}

/**
 * Extract clean JSON for web UI editing
 * Returns just the data without metadata
 */
function extractCleanJSON(wrappedObj) {
  if (wrappedObj.__NMS_META__ && wrappedObj.data) {
    return wrappedObj.data;
  }
  return wrappedObj;
}

/**
 * Reconstruct with perfect formatting by comparing with original
 * Uses the original binary to determine which integers had .0
 */
function reconstructWithMetadata(editedData, wrappedObj) {
  if (!wrappedObj.__NMS_META__ || !wrappedObj.__NMS_META__.originalBinary) {
    // No metadata, just stringify normally
    return Buffer.from(JSON.stringify(editedData), 'utf8');
  }

  const meta = wrappedObj.__NMS_META__;

  // Build lookup structures for .0 preservation
  const propertyDotZeroCount = new Map(); // prop:value -> count needed
  const arrayDotZeroSet = new Set();      // prop:value:index

  if (meta.dotZeroLocations) {
    for (const loc of meta.dotZeroLocations) {
      if (loc.arrayIndex !== undefined) {
        arrayDotZeroSet.add(`${loc.prop}:${loc.value}:${loc.arrayIndex}`);
      } else {
        const key = `${loc.prop}:${loc.value}`;
        propertyDotZeroCount.set(key, (propertyDotZeroCount.get(key) || 0) + 1);
      }
    }
  }

  // Custom stringifier that tracks context properly
  const propertyOccurrences = new Map();

  function stringifyValue(value, propName, arrayIndex) {
    if (value === null) return 'null';
    if (value === undefined) return undefined;

    const type = typeof value;

    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'string') return JSON.stringify(value);

    if (type === 'number') {
      if (!Number.isFinite(value)) return 'null';

      const isInteger = Math.floor(value) === value;

      if (isInteger && propName) {
        // Check if this array element needs .0
        if (arrayIndex !== undefined) {
          const key = `${propName}:${value}:${arrayIndex}`;
          if (arrayDotZeroSet.has(key)) {
            return value + '.0';
          }
          return String(value);
        }

        // Check if this property value needs .0
        const key = `${propName}:${value}`;
        const occurrences = propertyOccurrences.get(key) || 0;
        const needed = propertyDotZeroCount.get(key) || 0;

        if (occurrences < needed) {
          propertyOccurrences.set(key, occurrences + 1);
          return value + '.0';
        } else {
          if (needed > 0) propertyOccurrences.set(key, occurrences + 1);
          return String(value);
        }
      }

      return String(value);
    }

    if (Array.isArray(value)) {
      const parts = [];
      for (let i = 0; i < value.length; i++) {
        const serialized = stringifyValue(value[i], propName, i);
        parts.push(serialized);
      }
      return '[' + parts.join(',') + ']';
    }

    if (type === 'object') {
      const parts = [];
      for (const [key, val] of Object.entries(value)) {
        const serialized = stringifyValue(val, key, undefined);
        if (serialized !== undefined) {
          parts.push(JSON.stringify(key) + ':' + serialized);
        }
      }
      return '{' + parts.join(',') + '}';
    }

    return undefined;
  }

  const json = stringifyValue(editedData, null, undefined);
  const buffer = Buffer.from(json, 'utf8');
  return meta.hasTrailingNull ? Buffer.concat([buffer, Buffer.from([0])]) : buffer;
}

/**
 * Apply key mapping at binary level without parsing JSON
 * Finds quoted keys and replaces them, handling length differences
 */
function applyMapping(buffer, mappingData, reverse = false) {
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
    // We need to find the exact pattern in the binary data
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

  console.log(`  ✓ Applied ${totalReplacements} key replacements`);
  return data;
}

/**
 * Replace all occurrences of searchBuffer with replaceBuffer
 * Handles different lengths by reconstructing the buffer
 */
function replaceAllInBuffer(buffer, searchBuffer, replaceBuffer) {
  const chunks = [];
  let position = 0;
  let found = 0;

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
    found++;

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
function fixIDEncoding(buffer) {
  const result = [];
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
function unfixIDEncoding(buffer) {
  const result = [];
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
// CONSTANTS
// ============================================================================

const BLOCK_MAGIC = 0xfeeda1e5;
const MAX_BLOCK_SIZE = 0x80000; // 524288 bytes (512 KB)

// ============================================================================
// UTILITY FUNCTIONS (Matching Python)
// ============================================================================

/**
 * Convert 4 bytes to a little endian unsigned integer
 * Python: uint32(data: bytes) -> int
 */
function uint32(data, offset = 0) {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0; // Ensure unsigned 32-bit
}

/**
 * Convert unsigned 32 bit integer to 4 bytes
 * Python: byte4(data: int)
 */
function byte4(value) {
  const bytes = Buffer.alloc(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

// ============================================================================
// DECOMPRESSION (Matching Python)
// ============================================================================

/**
 * Decompresses the given save bytes
 * Python: decompress(data)
 */
function decompress(data) {
  const size = data.length;
  let pos = 0;
  const out = [];

  while (pos < size) {
    // Read magic
    const magic = uint32(data, pos);
    if (magic !== BLOCK_MAGIC) {
      console.error("Invalid Block, bad file");
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
    // This matches Python's lz4.block.decompress(data, uncompressed_size=...)
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
// COMPRESSION (Matching Python)
// ============================================================================

/**
 * Compresses the given save bytes
 * Python: compress(data)
 */
function compress(data) {
  const size = data.length;
  let pos = 0;
  const out = [];

  while (pos < size) {
    // Calculate uncompressed block size (min of MAX_BLOCK_SIZE or remaining)
    const uncompressedSize = Math.min(MAX_BLOCK_SIZE, size - pos);
    
    // Extract block
    const block = data.slice(pos, pos + uncompressedSize);
    
    // Compress using lz4.encode (raw block compression)
    // This matches Python's lz4.block.compress(data, store_size=False)
    // store_size=False means we don't prepend the size, just raw LZ4 block
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
// PUBLIC API
// ============================================================================

/**
 * Decode a No Man's Sky save file
 * @param saveData - Raw save file buffer
 * @returns Object containing clean JSON data and metadata for re-encoding
 */
export async function decodeSave(saveData: Buffer) {
  // Fetch mapping data
  const mappingData = await fetchMapping();
  
  // Decompress
  let decompressed = decompress(saveData);
  
  // Fix ID encoding (binary bytes → hex strings)
  decompressed = fixIDEncoding(decompressed);
  
  // Apply forward mapping (obfuscated keys → human-readable keys)
  const mapped = applyMapping(decompressed, mappingData, false);
  
  // Prepare for editing (captures .0 formatting metadata)
  const wrapped = prepareForEditing(mapped);
  
  // Extract clean JSON
  const cleanData = extractCleanJSON(wrapped);
  
  return {
    data: cleanData,
    metadata: {
      ...wrapped.__NMS_META__,
      mappingData
    }
  };
}

/**
 * Encode data back to No Man's Sky save file format
 * @param data - The clean JSON data to encode
 * @param metadata - The metadata object returned from decodeSave
 * @returns Compressed save file buffer
 */
export function encodeSave(data: any, metadata: any) {
  // Reconstruct wrapped object for metadata preservation
  const wrappedObj = {
    __NMS_META__: {
      version: metadata.version,
      originalBinary: metadata.originalBinary,
      hasTrailingNull: metadata.hasTrailingNull,
      dotZeroLocations: metadata.dotZeroLocations
    },
    data: data
  };
  
  // Reconstruct with metadata (preserves .0 formatting)
  let buffer = reconstructWithMetadata(data, wrappedObj);
  
  // Apply reverse mapping (human-readable keys → obfuscated keys)
  buffer = applyMapping(buffer, metadata.mappingData, true);
  
  // Unfix ID encoding (hex strings → binary bytes)
  buffer = unfixIDEncoding(buffer);
  
  // Compress
  const compressed = compress(buffer);
  
  return compressed;
}


