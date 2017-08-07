import fs from 'graceful-fs';
import path from 'path';
import {StringDecoder} from 'string_decoder';
const decoder = new StringDecoder('utf8');
import axios from 'axios';
import _ from 'lodash';
import state from './state';
import each from './each';

var exec = require('child_process').exec;
export var msToTime = (s)=>{
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

export var exc = (cmd)=>{
  return new Promise((resolve, reject)=>{
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

export var store = {
  set: (key, obj)=>{
    console.log(`Setting storage key ${key}:`, obj)
    window.localStorage.setItem(key, JSON.stringify(obj));
  },
  get: (key)=>{
    let res = window.localStorage.getItem(key);
    res = res === 'undefined' ? null : res;
    return JSON.parse(res);
  },
  remove: (key)=>{
    window.localStorage.removeItem(key);
  },
  clear: ()=>{
    window.localStorage.clear();
  }
};

export var formatID = (location)=>{
  location.GalacticAddress.id = `${location.GalacticAddress.VoxelX}:${location.GalacticAddress.VoxelY}:${location.GalacticAddress.VoxelZ}:${location.RealityIndex}:${location.GalacticAddress.SolarSystemIndex}:${location.GalacticAddress.PlanetIndex}`
  return _.cloneDeep(location.GalacticAddress);
};

export var parseID = (id)=>{
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

export var isNegativeInteger = (int)=>{
  return int.toString()[0] === '-';
};

export var convertInteger = (int, axis)=>{
  let oldMin = axis === 'y' ? -128 : -2048;
  let oldMax = axis === 'y' ? 127 : 2047;
  let oldRange = (oldMax - oldMin);
  let newMax = axis === 'y' ? 255 : 4096;
  let newMin = 0;
  let newRange = (newMax - newMin);
  return Math.floor(((((int - oldMin) * newRange) / oldRange) + newMin) - 1);
};

export var convertHex = (int, axis)=>{
  let oldMin = 0;
  let oldMax = axis === 'y' ? 255 : 4096;
  let oldRange = (oldMax - oldMin);
  let newMax = axis === 'y' ? 127 : 2047;
  let newMin = axis === 'y' ? -128 : -2048;
  let newRange = (newMax - newMin);
  let offset = axis === 'y' ? 1 : 2;
  return Math.floor(((((int - oldMin) * newRange) / oldRange) + newMin) + offset)
};

window.convertInteger = convertInteger

export var convertIntegerZ = (int, na)=>{
  int = Math.abs(int);

  int = Math.abs(Math.abs(Math.abs(int - na[0]) - na[1]) - na[2])
  return int - 1;
};

var isValueNull = (variable)=>{
  return (variable === undefined || variable == null);
}

var setDefaultValueIfNull = (variable, defaultVal)=>{
  if(isValueNull(variable)) { variable = defaultVal; }
  return variable;
}

export var toHex = (str, totalChars)=>{
  totalChars = setDefaultValueIfNull(totalChars, 2);
  str = ('0'.repeat(totalChars)+Number(str).toString(16)).slice(-totalChars).toUpperCase();
  return str;
}

export var fromHex = (str, username, galaxy)=>{
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
    each(strParts, (part, key)=>{
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
      || manualLocation.SolarSystemIndex > 600) {
      return null;
    }
    _.assignIn(manualLocation, {
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

    _.assignIn(manualLocation, _manualLocation)
    return manualLocation;
  } catch (e) {
    return null;
  }
}

export var walk = (dir, done)=>{
  var results = [];
  fs.readdir(dir, (err, list)=>{
    if (err) {
      return done(err);
    }
    var pending = list.length;
    if (!pending) {
      return done(null, results);
    }
    each(list, (file)=>{
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat)=>{
        if (stat && stat.isDirectory()) {
          walk(file, (err, res)=>{
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

export var getLastGameModeSave = (saveDirectory, mode, ps4User, log)=>{
  return new Promise((resolve, reject)=>{
    if (ps4User) {
      resolve();
      return;
    }
    walk(saveDirectory, (err, results)=>{
      if (err) {
        console.log(err)
        reject(err);
      }
      results = _.filter(results, (result)=>{
        return (result != null
          && (result.indexOf('st_') !== -1 || result.indexOf('DefaultUser') !== -1)
          && result.indexOf('\\cache\\') === -1
          && result.indexOf('.hg') !== -1
          && result.indexOf('mf_') === -1);
      });

      let obj = {
        normal: [0, 1, 2],
        survival: [3, 4, 5],
        creative: [6, 7, 8],
        permadeath: [9, 10, 11]
      };
      let saves = [];
      let saveInts = obj[mode];
      each(saveInts, (int)=>{
        each(results, (result)=>{
          let fileName = _.last(result.split('\\'));
          if (int === 0 && fileName.indexOf('storage.hg') > -1 || result.indexOf(`storage${int + 1}.hg`) > -1) {
            saves.push({
              fileName: fileName,
              result: result,
              mtime: fs.statSync(result).mtime
            });
          }
        });
      });

      let lastModifiedSave = _.chain(saves).orderBy('mtime', 'asc').last().value();
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
      } else if (_.isString(json)) {
        lastModifiedSave.result = json;
      }
      try {
        lastModifiedSave.result = JSON.parse(lastModifiedSave.result);
      } catch (e) {
        lastModifiedSave.result = null;
        log.error(`There was an error parsing your last modified save file. Please verify the integrity of ${lastModifiedSave.path}`);
        reject();
        return;
      }
      resolve(_.cloneDeep(lastModifiedSave));
    });
  });
};

export var repairInventory = (saveData)=>{
  let primaryShipIndex = saveData.result.PlayerStateData.PrimaryShip;
  each(saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots, (slot, i)=>{
    saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots[i].DamageFactor = 0;
  });

  each(saveData.result.PlayerStateData.Inventory.Slots, (slot, i)=>{
    saveData.result.PlayerStateData.Inventory.Slots[i].DamageFactor = 0;
  });

  each(saveData.result.PlayerStateData.WeaponInventory.Slots, (slot, i)=>{
    saveData.result.PlayerStateData.WeaponInventory.Slots[i].DamageFactor = 0;
  });
  return saveData.result;
};

export var refuelEnergy = (saveData)=>{
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
  each(saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots, (slot, i)=>{
    if (slot.Type.InventoryType === 'Technology' && refillableTech.indexOf(slot.Id) !== -1) {
      saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.Inventory.Slots, (slot, i)=>{
    if (slot.Type.InventoryType === 'Technology' && refillableTech.indexOf(slot.Id) !== -1) {
      saveData.result.PlayerStateData.Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.WeaponInventory.Slots, (slot, i)=>{
    if (refillableTech.indexOf(slot.Id) !== -1) {
      saveData.result.PlayerStateData.WeaponInventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  return saveData.result;
};

export var stockInventory = (saveData)=>{
  let primaryShipIndex = saveData.result.PlayerStateData.PrimaryShip;
  each(saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots, (slot, i)=>{
    if (slot.Type.InventoryType === 'Product' || slot.Type.InventoryType === 'Substance') {
      saveData.result.PlayerStateData.ShipOwnership[primaryShipIndex].Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.Inventory.Slots, (slot, i)=>{
    if (slot.Type.InventoryType === 'Product' || slot.Type.InventoryType === 'Substance') {
      saveData.result.PlayerStateData.Inventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  each(saveData.result.PlayerStateData.FreighterInventory.Slots, (slot, i)=>{
    if (slot.Type.InventoryType === 'Product' || slot.Type.InventoryType === 'Substance') {
      saveData.result.PlayerStateData.FreighterInventory.Slots[i].Amount = slot.MaxAmount;
    }
  });
  return saveData.result;
};

export var writeCurrentSaveFile = (fileName, json, cb)=>{
  json = JSON.stringify(json) + '\0';
  fs.writeFile(fileName, json, {flag: 'w'}, (err, data)=>{
    if (err) {
      cb(err);
      return;
    }
    cb(null);
  });
};

export var modifyUnits = (saveData, n=100000)=>{
  saveData.result.PlayerStateData.Units += n;
  return saveData.result;
};

export var css = (styleObject, newObject)=>{
  return _.assignIn(_.clone(styleObject), _.clone(newObject));
};

export var tip = (content)=>{
  if (content.length === 0) {
    return null;
  }
  return `<div style="font-family:'geosanslight-nmsregular';font-size:14px;border-radius:0px; max-width: 200px;">${content}</div>`
}

export var ajax = axios.create({
  //baseURL: 'http://z.npff.co:8000/api/',
  baseURL: 'https://neuropuff.com/api/',
  timeout: 15000,
  xsrfCookieName: 'csrftoken'
});

export var formatBase = (saveData, knownProducts)=>{
  let base = _.cloneDeep(saveData.result.PlayerStateData.PersistentPlayerBases[0]);
  // Check for modded objects and remove them
  let moddedObjectKeys = [];
  each(base.Objects, (object, key)=>{
    let refProduct = _.findIndex(knownProducts, (product)=>product === object.ObjectID);
    if (refProduct === -1) {
      moddedObjectKeys.push(key);
    }
  });
  each(moddedObjectKeys, (key)=>{
    _.pullAt(base.Objects, key);
  });
  let cachedBase = {
    Objects: base.Objects,
    Forward: base.Forward,
    Position: base.Position,
    Name: base.Name
  };
  return _.cloneDeep(cachedBase);
};

var flip = (string)=>{
  console.log('flip', string)
  let stringArr = string.split('').reverse();
  string = stringArr.join('');
  console.log('flip return: ', string)
  return string;
};

var signInt = (x, byteLen)=>{
  console.log('signInt', x, byteLen)
  let y = parseInt(x, 16);
  if (y > 0.5 * Math.pow(16, byteLen)) {
    return y - Math.pow(16, byteLen);
  } else {
    return y;
  }
}

var toAdd = (x)=>{
  let y = null;
  if (typeof x === 'string' && x.indexOf('0x') !== -1) {
    y = x.substr(2, x.length);
  }
  let data = {
    PlanetIndex: parseInt(flip(y.substring(0, 3)), 16),
    SolarSystemIndex: parseInt(flip(y.substring(3, 6)), 16),
    VoxelY: signInt(y.substring(6, 8), 2),
    VoxelZ: signInt(y.substring(8, 11), 3),
    VoxelX: signInt(y.substring(11, y.length), 3)
  };
  return data;
}
window.toAdd = toAdd;

export function whichToShow ({outerHeight, itemHeight, scrollTop, columns}) {
  let start = Math.floor(scrollTop / itemHeight);
  let heightOffset = scrollTop % itemHeight;
  let length = Math.ceil((outerHeight + heightOffset) / itemHeight) * columns;

  return {
    start: start,
    length: length,
  }
}

/*export function rotateLeft(value, bits) {
  return (value << bits) | (value >> (32 - bits));
}

export function parseMeta (buffer, archiveNumber) {
  archiveNumber += 2;

  // Murmurhash-like
  var k1 = 0 ^ 0x1422cb8c;
  var h1 = rotateLeft(k1, 13) * 5 + 0xe6546b64;
}*/

export function convertRange(value, r1, r2) {
  return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
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