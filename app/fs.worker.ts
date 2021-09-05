import fs from 'fs-extra';
import path from 'path';
import {StringDecoder} from 'string_decoder';
import {last, orderBy} from 'lodash';
import JSZip from 'jszip';
import {each, rEach, tryFn} from '@jaszhix/utils';
import {parseSaveKeys} from './lang';
import log from './log';

const decoder = new StringDecoder('utf8');

/**
 * Helper for reading variable length sizes
 * @param data buffer to read from
 * @param start start position
 * @param val initial value from tokne
 * @returns decoded length and new read position
 */
 function readLength(
  data: Buffer,
  start: number,
  val: number
): [number, number] {
  if (val < 15) return [val, start]; // Nothing to read

  let pos = start;
  let res = val;
  let tmp = 0;

  do {
    tmp = data.readUInt8(pos++);
    res += tmp;
  } while (tmp === 255);
  return [res, pos];
}

/*
  Originally authored by bdew
  https://gist.github.com/bdew/69252923b4abdffd5b825b70756a5800
*/

function decompressSave(data: Buffer): Buffer {
  const outputs: Buffer[] = []; // Array of decompressed buffers
  let readPtr = 0; // Current read position

  while (readPtr < data.length) {
    // Check magic number
    if (data.readUInt32LE(readPtr) !== 0xfeeda1e5)
      throw new Error(`Missing magic number at ${readPtr}`);

    // Read header

    const compSize = data.readInt32LE(readPtr + 4); // Compressed data size
    const buffSize = data.readInt32LE(readPtr + 8); // Output size
    readPtr += 16; // 4 bytes unknown (always 0?)

    const blockEnd = readPtr + compSize; // End of current block in fiel
    const writeBuf = Buffer.alloc(buffSize); // Output buffer

    let chunk = 0; // Size of current chunk
    let offset = 0; // Copy operation offset
    let writePtr = 0; // Output buffer position

    while (readPtr < blockEnd) {
      // Read token
      const token = data.readUInt8(readPtr++);

      // Decode data length
      [chunk, readPtr] = readLength(data, readPtr, token >> 4);

      // Check overflow
      if (writePtr + chunk > buffSize) {
        throw new Error('Output buffer overflow');
      }

      // Copy data to output
      data.copy(writeBuf, writePtr, readPtr, readPtr + chunk);
      writePtr += chunk;
      readPtr += chunk;

      // If we aren't at the end - read offset for copy
      if (readPtr < blockEnd) {
        offset = data.readUInt16LE(readPtr);
        readPtr += 2;
      } else break;

      // Decode copy length
      [chunk, readPtr] = readLength(data, readPtr, token & 15);
      chunk += 4;

      // Check overflow
      if (writePtr + chunk > buffSize) {
        throw new Error('Output buffer overflow');
      }

      // Do copy (this can't be done with Buffer.copy since it doesn't handle overlaps)
      for (; chunk > 0; chunk--) {
        writeBuf.writeUInt8(writeBuf.readUInt8(writePtr - offset), writePtr++);
      }
    }

    // Append to outputs
    outputs.push(writeBuf.slice(0, writePtr));
  }

  // Last byte of output seems to be 0, strip it
  return Buffer.concat(outputs).slice(0, -1);
}

const walk = (dir, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) {
      return done(err);
    }
    let pending = list.length;
    if (!pending) {
      return done(null, results);
    }
    rEach(list, (file, i, next) => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err, res) => {
            results = results.concat(res);
            if (!--pending) {
              done(null, results);
            } else {
              next();
            }
          });
        } else {
          results.push(file);
          if (!--pending) {
            done(null, results);
          } else {
            next();
          }
        }
      });
    });
  });
};

const getLastGameModeSave = (saveDirectory, ps4User, cb) => {
  if (ps4User) {
    cb(null);
    return;
  }
  walk(saveDirectory, (err, results) => {
    if (err) {
      console.log(err)
      cb(err);
      return;
    }

    let filterResults = [];
    each(results, (result) => {
      if (result != null
        && result.indexOf('SlotRestructureBackup') < 0
        && (result.indexOf('st_') > -1 || result.indexOf('DefaultUser') > -1)
        && result.indexOf('\\cache\\') < 0
        && result.substr(-3) === '.hg'
        && result.indexOf('mf_') < 0) {
        filterResults.push(result);
      }
    });

    results = filterResults;

    let saves = [];
    let saveInts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    let next = () => {
      let lastModifiedSave = last(orderBy(saves, 'mtime', 'asc'));
      if (!lastModifiedSave) {
        cb(new Error('Cannot retrieve last modified save file.'));
        return;
      }
      lastModifiedSave.path = lastModifiedSave.result;

      fs.readFile(lastModifiedSave.result, {}, (err, json) => {
        if (err) {
          err.message = `getLastGameModeSave -> next:\n${err.message}`;
          if (err.message.indexOf('EBUSY') > -1) {
            err.message += `\nUnable to read your last modified save file because it is in use by another program. `
              + 'Please make sure you are only teleporting, restoring bases, or using the cheat menu while the game is closed or paused.';
          }
          cb(err);
          return;
        }

        if (json instanceof Buffer) {
          const decodedJson = decoder.write(decompressSave(json));
          if (decodedJson.indexOf('\0') > -1) {
            lastModifiedSave.result = decodedJson.replace(/\0$/, '');
          } else {
            lastModifiedSave.result = decodedJson;
          }
        } else if (typeof json === 'string' || json instanceof String) {
          lastModifiedSave.result = json;
        }

        tryFn(() => {
          lastModifiedSave.result = JSON.parse(lastModifiedSave.result);
          if (lastModifiedSave.result.F2P) {
            lastModifiedSave.result = parseSaveKeys(lastModifiedSave.result);
            lastModifiedSave.needsConversion = true;
          }
          let {int} = lastModifiedSave;
          if (lastModifiedSave.result.version <= 4104) {
            lastModifiedSave.slot = int > 8 ? 4 : int > 5 ? 3 : int > 2 ? 2 : 1;
          } else {
            lastModifiedSave.slot = int > 7 ? 5 : int > 5 ? 4 : int > 3 ? 3 : int > 1 ? 2 : 1
          }
        }, (err) => {
          lastModifiedSave.result = null;
          err.message += `\nThere was an error parsing your last modified save file. Please verify the integrity of ${lastModifiedSave.path}`;
          cb(err);
        });
        cb(null, lastModifiedSave);
      });
    }

    rEach(saveInts, (int, i, next1) => {
      rEach(results, (result, r, next2) => {
        let fileName: string = last(result.split('\\'));
        if (((int === 0 && fileName.indexOf('save.hg') > -1) || result.indexOf(`save${int + 1}.hg`) > -1)
          || ((int === 0 && fileName.indexOf('storage.hg') > -1) || result.indexOf(`storage${int + 1}.hg`) > -1)) {
          fs.stat(result, (err, stats) => {
            if (err) {
              log.error(err);
              return;
            }
            saves.push({
              fileName: fileName,
              result: result,
              mtime: stats.mtime,
              int: int
            });
            next2();
          });
        } else {
          next2();
        }
      }, next1);
    }, next);
  });
};

const _backupSaveFile = (saveDir, backupDir, saveFile, cb) => {
  let d = new Date();
  let dateString = `${d.getDay()}-${d.getMonth()}-${d.getFullYear()}-${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}`;
  let save = path.join(saveDir, saveFile);
  let mfSave = path.join(saveDir, `mf_${saveFile}`);
  fs.readFile(save, (err, data) => {
    if (err) {
      cb(err);
      return;
    }
    save = data;
    fs.readFile(mfSave, (err, data) => {
      if (err) {
        cb(err);
        return;
      }
      mfSave = data;
      let zip = new JSZip();
      zip.file(`${saveFile}`, save, {
        binary: true
      });
      zip.file(`mf_${saveFile}`, mfSave, {
        binary: true
      });
      zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {level: 9}
      }).then((buffer) => {
        fs.writeFile(path.join(backupDir, `${saveFile}.bk-${dateString}.zip`), buffer, cb);
      }).catch((err) => cb(err));
    });
  });
}

const backupSaveFile = (saveDir, saveFile, cb) => {
  let backupDir = path.join(saveDir, 'nmcBackup');
  fs.exists(backupDir, (exists) => {
    if (!exists) {
      fs.mkdir(backupDir, (err) => {
        if (err) {
          log.error('Unable to create save file backup directory: ', err);
          cb(err);
          return;
        }
        _backupSaveFile(saveDir, backupDir, saveFile, cb);
      });
      return;
    }
    _backupSaveFile(saveDir, backupDir, saveFile, cb);
  })
}

// @ts-ignore
const next = (err, data) => postMessage([err ? err.message : null, data]);

onmessage = function(e) {
  let [method, ...args] = e.data;
  if (method === 'walk') {
    // @ts-ignore
    walk(...args, (err, data) => next(err, data));
  } else if (method === 'getLastGameModeSave') {
    // @ts-ignore
    getLastGameModeSave(...args, (err, data) => next(err, data));
  } else if (method === 'backupSaveFile') {
    // @ts-ignore
    backupSaveFile(...args, (err) => next(err));
  } else {
    each(args, (arg, i) => {
      if (arg && arg.buffer) {
        args[i] = Buffer.from(arg.buffer, 'binary');
      }
    });
    fs[method](...args, (err, data) => {
      if (method === 'exists') {
        // @ts-ignore
        postMessage([err]);
        return;
      }
      next(err, data)
    });
  }
}

export default {} as typeof Worker & {new (): Worker};