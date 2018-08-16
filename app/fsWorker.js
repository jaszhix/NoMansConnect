const fs = require('graceful-fs');
const path = require('path');
const {StringDecoder} = require('string_decoder');
const decoder = new StringDecoder('utf8');
const {last, orderBy} = require('lodash');
const {each, rEach, tryFn} = require('./lang');
const log = require('./log');

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
          log.error(err);
          if (e.message.indexOf('EBUSY') > -1) {
            log.error(`Unable to read your last modified save file because it is in use by another program. Please make sure you are only teleporting, restoring bases, or using the cheat menu while the game is closed or paused.`);
          }
          cb(new Error());
          return;
        }

        if (json instanceof Buffer) {
          const decodedJson = decoder.write(json);
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
          let {int} = lastModifiedSave;
          if (lastModifiedSave.result.version <= 4104) {
            lastModifiedSave.slot = int > 8 ? 4 : int > 5 ? 3 : int > 2 ? 2 : 1;
          } else {
            lastModifiedSave.slot = int > 7 ? 5 : int > 5 ? 4 : int > 3 ? 3 : int > 1 ? 2 : 1
          }
        }, (e) => {
          lastModifiedSave.result = null;
          log.error(e);
          log.error(`There was an error parsing your last modified save file. Please verify the integrity of ${lastModifiedSave.path}`);
          cb(new Error());
        });
        cb(null, lastModifiedSave);
      });
    }

    rEach(saveInts, (int, i, next1) => {
      rEach(results, (result, r, next2) => {
        let fileName = last(result.split('\\'));
        if (((int === 0 && fileName.indexOf('save.hg') > -1) || result.indexOf(`save${int + 1}.hg`) > -1)
          || ((int === 0 && fileName.indexOf('storage.hg') > -1) || result.indexOf(`storage${int + 1}.hg`) > -1)) {
          fs.stat(result, (err, stats) => {
            if (err) {
              reject(err);
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

const next = (err, data) => postMessage([err ? err.message : null, data]);

onmessage = function(e) {
  let [method, ...args] = e.data;
  if (method === 'walk') {
    walk(...args, (err, data) => next(err, data));
  } else if (method === 'getLastGameModeSave') {
    getLastGameModeSave(...args, (err, data) => next(err, data));
  } else {
    fs[method](...args, (err, data) => next(err, data));
  }
}