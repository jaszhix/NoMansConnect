import fs from 'graceful-fs';
import path from 'path';
import {StringDecoder} from 'string_decoder';
const decoder = new StringDecoder('utf8');
import axios from 'axios';
import {cloneDeep, assignIn, pullAt, last, orderBy, isString, trimStart, defer} from 'lodash';
import {each, findIndex} from './lang';

var exec = require('child_process').exec;
export var msToTime = (s) => {
  var ms = s % 1000;
  s = (s - ms) / 1000;
  var secs = s % 60;
  s = (s - secs) / 60;
  var mins = s % 60;
  var hrs = (s - mins) / 60;

  var output = `${hrs}h ${mins}m ${secs}s`;
  output = hrs <= 0 ? output.split('h ')[1] : output;
  output = mins <= 0 ? output.split('m ')[1] : output;
  return output;
};

export var exc = (cmd) => {
  return new Promise((resolve, reject) => {
    var opts = {
      encoding: 'utf8',
      timeout: 0,
      maxBuffer: 200*1024,
      killSignal: 'SIGTERM',
      cwd: null,
      env: null
    };
    if (process.platform === 'win32') {
      opts.shell = 'powershell.exe';
    } else {
      opts.shell = '/bin/sh';
    }
    exec(cmd, function (err, stdout, stderr) {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

export var formatID = (location) => {
  location.GalacticAddress.id = `${location.GalacticAddress.VoxelX}:${location.GalacticAddress.VoxelY}:${location.GalacticAddress.VoxelZ}:${location.RealityIndex}:${location.GalacticAddress.SolarSystemIndex}:${location.GalacticAddress.PlanetIndex}`
  return location.GalacticAddress;
};

export var parseID = (id) => {
  id = id.split(':');
  let location = {
    PlanetIndex: id[4],
    SolarSystemIndex: id[3],
    VoxelX: id[0],
    VoxelY: id[1],
    VoxelZ: id[2]
  };
  return location;
};

export var isNegativeInteger = (int) => {
  return int.toString()[0] === '-';
};

export var convertInteger = (int, axis) => {
  let oldMin = axis === 'y' ? -128 : -2048;
  let oldMax = axis === 'y' ? 127 : 2047;
  let oldRange = (oldMax - oldMin);
  let newMax = axis === 'y' ? 255 : 4096;
  let newMin = 0;
  let newRange = (newMax - newMin);
  return Math.floor(((((int - oldMin) * newRange) / oldRange) + newMin) - 1);
};

export var convertHex = (int, axis) => {
  let oldMin = 0;
  let oldMax = axis === 'y' ? 255 : 4096;
  let oldRange = (oldMax - oldMin);
  let newMax = axis === 'y' ? 127 : 2047;
  let newMin = axis === 'y' ? -128 : -2048;
  let newRange = (newMax - newMin);
  let offset = axis === 'y' ? 1 : 2;
  return Math.floor(((((int - oldMin) * newRange) / oldRange) + newMin) + offset)
};

var setDefaultValueIfNull = (variable, defaultVal) => {
  if (variable == null) {
    variable = defaultVal;
  }
  return variable;
}

export const toHex = (str, totalChars) => {
  totalChars = setDefaultValueIfNull(totalChars, 2);
  str = ('0'.repeat(totalChars)+Number(str).toString(16)).slice(-totalChars).toUpperCase();
  return str;
}

export var fromHex = (str, username, galaxy) => {
  try {
    let result = {x: 0, y: 0, z: 0, SolarSystemIndex: 0};
    let resultKeys = Object.keys(result);
    if (str.indexOf(':') === -1) {
      return null;
    }
    let strParts = str.split(':');
    if (strParts.length !== 4) {
      return null;
    }
    let valid = true;
    each(strParts, (part, key) => {
      part = part.trim();
      if (!part.match(/^[a-z0-9]+$/i)) {
        valid = false;
        return;
      }
      let _key = resultKeys[key];
      result[_key] = _key.length === 1 ? convertHex(parseInt(part, 16), _key) : parseInt(part, 16);
    });

    if (!valid) {
      return
    }

    let manualLocation = {
      username: username,
      playerPosition: false,
      playerTransform: false,
      shipPosition: false,
      shipTransform: false,
      galaxy: galaxy,
      distanceToCenter: Math.sqrt(Math.pow(result.x, 2) + Math.pow(result.y, 2) + Math.pow(result.z, 2)) * 100,
      VoxelY: result.y,
      VoxelX: result.x,
      VoxelZ: result.z,
      SolarSystemIndex: result.SolarSystemIndex,
      PlanetIndex: 0,
      translatedX: convertInteger(result.x, 'x'),
      translatedZ: convertInteger(result.z, 'z'),
      translatedY: convertInteger(result.y, 'y'),
      base: false,
      baseData: false,
      upvote: false,
      image: '',
      mods: [],
      manuallyEntered: true,
      timeStamp: Date.now(),
    };

    if (isNaN(manualLocation.SolarSystemIndex)
      || isNaN(manualLocation.translatedX)
      || isNaN(manualLocation.translatedY)
      || isNaN(manualLocation.translatedZ)
      || manualLocation.translatedX > 4096
      || manualLocation.translatedZ > 4096
      || manualLocation.translatedY > 256
      || manualLocation.SolarSystemIndex > 600
      || manualLocation.VoxelY < -128
      || manualLocation.VoxelY > 127
      || manualLocation.VoxelZ < -2048
      || manualLocation.VoxelZ > 2047
      || manualLocation.VoxelX < -2048
      || manualLocation.VoxelX > 2047) {
      return null;
    }
    assignIn(manualLocation, {
      jumps: Math.ceil(manualLocation.distanceToCenter / 400),
      translatedId: `${toHex(manualLocation.translatedX, 4)}:${toHex(manualLocation.translatedY, 4)}:${toHex(manualLocation.translatedZ, 4)}:${toHex(manualLocation.SolarSystemIndex, 4)}`,
      GalacticAddress: {
        VoxelY: result.y,
        VoxelX: result.x,
        VoxelZ: result.z,
        SolarSystemIndex: result.SolarSystemIndex,
        PlanetIndex: 0,
        RealityIndex: galaxy
      },
      RealityIndex: galaxy
    });

    let _manualLocation = formatID(manualLocation);
    delete manualLocation.GalacticAddress;
    delete manualLocation.RealityIndex;

    assignIn(manualLocation, _manualLocation)
    return manualLocation;
  } catch (e) {
    console.log(e);
    return null;
  }
}

export var walk = (dir, done) => {
  var results = [];
  fs.readdir(dir, (err, list) => {
    if (err) {
      return done(err);
    }
    var pending = list.length;
    if (!pending) {
      return done(null, results);
    }
    each(list, (file) => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err, res) => {
            results = results.concat(res);
            if (!--pending) {
              done(null, results);
            }
          });
        } else {
          results.push(file);
          if (!--pending) {
            done(null, results);
          }
        }
      });
    });
  });
};

export var getLastGameModeSave = (saveDirectory, ps4User, log) => {
  return new Promise((resolve, reject) => {
    if (ps4User) {
      resolve();
      return;
    }
    walk(saveDirectory, (err, results) => {
      if (err) {
        console.log(err)
        reject(err);
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
      each(saveInts, (int) => {
        each(results, (result) => {
          let fileName = last(result.split('\\'));
          if (((int === 0 && fileName.indexOf('save.hg') > -1) || result.indexOf(`save${int + 1}.hg`) > -1)
          || ((int === 0 && fileName.indexOf('storage.hg') > -1) || result.indexOf(`storage${int + 1}.hg`) > -1)) {
            saves.push({
              fileName: fileName,
              result: result,
              mtime: fs.statSync(result).mtime,
              int: int
            });
          }
        });
      });

      let lastModifiedSave = last(orderBy(saves, 'mtime', 'asc'));
      if (!lastModifiedSave) {
        reject();
        return;
      }
      lastModifiedSave.path = lastModifiedSave.result;

      let json;
      try {
        json = fs.readFileSync(lastModifiedSave.result);
      } catch (e) {
        if (e.message.indexOf('EBUSY') > -1) {
          log.error(`Unable to read your last modified save file because it is in use by another program. Please make sure you are only teleporting, restoring bases, or using the cheat menu while the game is closed or paused.`);
        }
        reject();
        return;
      }
      if (json instanceof Buffer) {
        const decodedJson = decoder.write(json);
        if (decodedJson.indexOf('\0') > -1) {
          lastModifiedSave.result = decodedJson.replace(/\0$/, '');
        } else {
          lastModifiedSave.result = decodedJson;
        }
      } else if (isString(json)) {
        lastModifiedSave.result = json;
      }
      try {
        lastModifiedSave.result = JSON.parse(lastModifiedSave.result);
        let {int} = lastModifiedSave;
        if (lastModifiedSave.result.version <= 4104) {
          lastModifiedSave.slot = int > 8 ? 4 : int > 5 ? 3 : int > 2 ? 2 : 1;
        } else {
          lastModifiedSave.slot = int > 7 ? 5 : int > 5 ? 4 : int > 3 ? 3 : int > 1 ? 2 : 1
        }
      } catch (e) {
        lastModifiedSave.result = null;
        log.error(`There was an error parsing your last modified save file. Please verify the integrity of ${lastModifiedSave.path}`);
        reject();
        return;
      }
      resolve(lastModifiedSave);
    });
  });
};

export var repairInventory = (saveData) => {
  let primaryShipIndex = saveData.result.PlayerStateData.PrimaryShip;
  each(saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots, (slot, i) => {
    saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots[i].DamageFactor = 0;
  });

  each(saveData.result.PlayerStateData.Inventory.Slots, (slot, i) => {
    saveData.result.PlayerStateData.Inventory.Slots[i].DamageFactor = 0;
  });

  each(saveData.result.PlayerStateData.WeaponInventory.Slots, (slot, i) => {
    saveData.result.PlayerStateData.WeaponInventory.Slots[i].DamageFactor = 0;
  });
  return saveData.result;
};

export var refuelEnergy = (saveData) => {
  let primaryShipIndex = saveData.result.PlayerStateData.PrimaryShip;
  let refillableTech = [
    // Suit inventory
    '^PROTECT',
    '^ENERGY',
    '^TOX1',
    '^TOX2',
    '^TOX3',
    '^RAD1',
    '^RAD2',
    '^RAD3',
    '^COLD1',
    '^COLD2',
    '^COLD3',
    '^HOT1',
    '^HOT2',
    '^HOT3',
    '^UNW1',
    '^UNW2',
    '^UNW3',
    // Ship inventory
    '^SHIPGUN1',
    '^SHIPSHIELD',
    '^SHIPJUMP1',
    '^HYPERDRIVE',
    '^LAUNCHER',
    '^SHIPLAS1',
    // Multitool inventory
    '^LASER',
    '^GRENADE'
  ];

  saveData.result.PlayerStateData.ShipHealth = 8;
  saveData.result.PlayerStateData.ShipShield = 200;
  saveData.result.PlayerStateData.Health = 8;
  saveData.result.PlayerStateData.Energy = 100;
  saveData.result.PlayerStateData.Shield = 100;
  each(saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots, (slot, i) => {
    if (slot.Type.InventoryType === 'Technology' && refillableTech.indexOf(slot.Id) !== -1) {
      saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.Inventory.Slots, (slot, i) => {
    if (slot.Type.InventoryType === 'Technology' && refillableTech.indexOf(slot.Id) !== -1) {
      saveData.result.PlayerStateData.Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.WeaponInventory.Slots, (slot, i) => {
    if (refillableTech.indexOf(slot.Id) !== -1) {
      saveData.result.PlayerStateData.WeaponInventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  return saveData.result;
};

export var stockInventory = (saveData) => {
  let primaryShipIndex = saveData.result.PlayerStateData.PrimaryShip;
  each(saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots, (slot, i) => {
    if (slot.Type.InventoryType === 'Product' || slot.Type.InventoryType === 'Substance') {
      saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.Inventory.Slots, (slot, i) => {
    if (slot.Type.InventoryType === 'Product' || slot.Type.InventoryType === 'Substance') {
      saveData.result.PlayerStateData.Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.FreighterInventory.Slots, (slot, i) => {
    if (slot.Type.InventoryType === 'Product' || slot.Type.InventoryType === 'Substance') {
      saveData.result.PlayerStateData.FreighterInventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  return saveData.result;
};

export var modifyUnits = (saveData, n=100000) => {
  saveData.result.PlayerStateData.Units += n;
  return saveData.result;
};

export var formatBase = (saveData, knownProducts, i = 0) => {
  let base = cloneDeep(saveData.result.PlayerStateData.PersistentPlayerBases[i]);
  // Check for modded objects and remove them
  let moddedObjectKeys = [];
  each(base.Objects, (object, key) => {
    let refProduct = findIndex(knownProducts, product => product === object.ObjectID);
    if (refProduct === -1) {
      moddedObjectKeys.push(key);
    }
  });
  each(moddedObjectKeys, (key) => {
    pullAt(base.Objects, key);
  });
  let cachedBase = {
    Objects: base.Objects,
    Forward: base.Forward,
    Position: base.Position,
    Name: base.Name
  };
  return cloneDeep(cachedBase);
};

var flip = (string) => {
  console.log('flip', string)
  let stringArr = string.split('').reverse();
  string = stringArr.join('');
  console.log('flip return: ', string)
  return string;
};

var signInt = (x, byteLen) => {
  console.log('signInt', x, byteLen)
  let y = parseInt(x, 16);
  if (y > 0.5 * Math.pow(16, byteLen)) {
    return y - Math.pow(16, byteLen);
  } else {
    return y;
  }
}

export const intToObject = (x, isUA = false) => {
  if (typeof x === 'string' && x.indexOf('0x') !== -1) {
    x = x.substr(2, x.length);
  } else if (typeof x === 'number') {
    x = x.toString();
    x = trimStart(
      toHex(x, x.length),
      '0'
    );
  }
  let RealityIndex = null;
  if (isUA) {
    RealityIndex = parseInt(x.substring(3, 6), 16); // TBD
  }
  let data = {
    PlanetIndex: parseInt(flip(x.substr(0, 1)), 16),
    SolarSystemIndex: parseInt(x.substr(1, 3), 16),
    VoxelY: signInt(x.substring(6, 8), 2),
    VoxelZ: signInt(x.substring(8, 11), 3),
    VoxelX: signInt(x.substring(11, x.length), 3)
  };
  if (typeof RealityIndex === 'number') {
    data.RealityIndex = RealityIndex;
  }
  return data;
}

export function whichToShow ({outerHeight, itemHeight, scrollTop, columns}) {
  let start = Math.floor(scrollTop / itemHeight);
  let heightOffset = scrollTop % itemHeight;
  let length = Math.ceil((outerHeight + heightOffset) / itemHeight) * columns;

  return {
    start: start,
    length: length,
  }
}

export function convertRange(value, r1, r2) {
  return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
};

export const formatForGlyphs = function(translatedId) {
  if (!translatedId || typeof translatedId !== 'string') {
    return [];
  }
  // Based on
  // https://github.com/nmsportals/nmsportals.github.io/blob/47f52a729ed38bb5ce4224e7fe52575b5c8329ec/js/glyphs.js#L378
  let [A, B, C, D] = translatedId.split(':');
  A = parseInt(A, 16);
  A = +A + 2049;
  A = Math.abs(+A % 4096);
  A = A.toString(16).toUpperCase();
  if (A.length === 2) {
    A = '0' + A;
  }
  if (A.length === 1) {
    A = '00' + A;
  }
  B = parseInt(B, 16);
  B = +B + 129;
  B = +B % 256;
  B = Math.abs(B);
  B = B.toString(16).toUpperCase();
  if (B.length === 1) {
    B = '0' + B;
  }
  C = parseInt(C, 16);
  C = +C + 2049;
  C = +C % 4096;
  C = Math.abs(C);
  C = C.toString(16).toUpperCase();
  if (C.length === 1) {
    C = '00' + C;
  }
  if (C.length === 2) {
    C = '0' + C;
  }
  D = D.slice(1);
  let result = [0, D, B, C, A].join('').split('');
  return result;
};

export function uuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export var validateEmail = (email) => {
  let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

export var css = (styleObject, newObject) => {
  return assignIn({}, styleObject, newObject);
};

export var tip = (content) => {
  if (content.length === 0) {
    return null;
  }
  return `<div style="font-family:'geosanslight-nmsregular';font-size:14px;border-radius:0px; max-width: 200px;">${content}</div>`
}

const opts = {
  baseURL: 'https://neuropuff.com/api/',
  timeout: 60000,
  xsrfCookieName: 'csrftoken'
};

if (process.env.NODE_ENV === 'development') {
  opts.baseURL = 'http://z.npff.co:8000/api/'
}

export const ajax = axios.create(opts);

// Cleans up the left over object references after a component unmounts, helps with garbage collection
export const cleanUp = (obj) => {
  defer(() => {
    let contextProps = Object.keys(obj);
    each(contextProps, (key) => {
      if (key === 'willUnmount') {
        return;
      }
      obj[key] = undefined;
    })
  });
}

export const dirSep = process.platform === 'win32' ? '\\' : '/';