import fs from 'graceful-fs';
import axios from 'axios';
import {cloneDeep, assignIn, last, trimStart} from 'lodash';
import {each, findIndex, filter} from './lang';
import state from './state';
import {defaultPosition} from './constants';

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

const fsKeys = filter(Object.keys(fs), (key) => !key.includes('Sync')).concat(['walk', 'getLastGameModeSave', 'backupSaveFile']);
export const fsWorker = {};

let fsCount = 1;
let ajaxCount = 1;

const fsWorkerCaller = (method, ...args) => {
  if (fsCount > window.coreCount) {
    fsCount = 1;
  }
  let worker = `fsWorker${fsCount}`;
  if (window[worker].onmessage) {
    fsCount++;
    setTimeout(() => fsWorkerCaller(method, ...args), 0);
    return;
  }
  let cb = last(args);
  args.splice(-1);
  window[worker].onmessage = (e) => {
    window[worker].onmessage = null;
    let [err, data] = e.data;
    cb(err, data);
  }
  each(args, (arg, i) => {
    if (arg instanceof Buffer) {
      args[i] = {buffer: args[i].toString('binary')};
    }
  })
  window[worker].postMessage([method, ...args]);
  fsCount++;
}
each(fsKeys, (key) => {
  fsWorker[key] = (...args) => fsWorkerCaller(key, ...args);
});

const axiosKeys = Object.keys(axios);
export const ajaxWorker = {};

const ajaxWorkerCaller = (method, ...args) => {
  state.set({navLoad: true});
  if (ajaxCount > window.coreCount) {
    ajaxCount = 1;
  }
  let worker = `ajaxWorker${ajaxCount}`;
  if (window[worker].onmessage) {
    ajaxCount++;
    return new Promise((resolve, reject) => setTimeout(() => resolve(ajaxWorkerCaller(method, ...args)), 50));
  }
  window[worker].postMessage([method, ...args]);
  ajaxCount++;
  return new Promise((resolve, reject) => {
    window[worker].onmessage = (e) => {
      window[worker].onmessage = null;
      let [err, data] = e.data;
      state.set({navLoad: false});
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    }
  });
}
each(axiosKeys, (key) => {
  ajaxWorker[key] = (...args) => ajaxWorkerCaller(key, ...args);
});

export var formatID = (location) => {
  location.GalacticAddress.dataId = `${location.GalacticAddress.VoxelX}:${location.GalacticAddress.VoxelY}:${location.GalacticAddress.VoxelZ}:${location.RealityIndex}:${location.GalacticAddress.SolarSystemIndex}:${location.GalacticAddress.PlanetIndex}`
  return {
    ...location.GalacticAddress,
    RealityIndex: location.RealityIndex
  };
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

export const calculateDistanceToCenter = function(x, y, z) {
  return (Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2)) * 100) * 4;
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

export const formatTranslatedID = (location) => {
  let translatedX = convertInteger(location.VoxelX, 'x');
  let translatedZ = convertInteger(location.VoxelZ, 'z');
  let translatedY = convertInteger(location.VoxelY, 'y');
  return {
    ...location,
    translatedX,
    translatedY,
    translatedZ,
    translatedId: `${toHex(translatedX, 4)}:${toHex(translatedY, 4)}:${toHex(translatedZ, 4)}:${toHex(location.SolarSystemIndex, 4)}`
  };
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
      positions: [Object.assign({}, defaultPosition, {name: '', image: ''})],
      galaxy: galaxy,
      distanceToCenter: calculateDistanceToCenter(result.x, result.y, result.z),
      VoxelY: result.y,
      VoxelX: result.x,
      VoxelZ: result.z,
      SolarSystemIndex: result.SolarSystemIndex,
      PlanetIndex: 0,
      base: false,
      baseData: false,
      upvote: false,
      image: '',
      mods: [],
      manuallyEntered: true,
      created: Date.now(),
      apiVersion: 2
    };

    manualLocation = formatTranslatedID(manualLocation);

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

export var getLastGameModeSave = (saveDirectory, ps4User, log) => {
  return new Promise((resolve, reject) => {
    fsWorker.getLastGameModeSave(saveDirectory, ps4User, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    })
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
    base.Objects.splice(key, 1);
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
  let stringArr = string.split('').reverse();
  string = stringArr.join('');
  return string;
};

var signInt = (x, byteLen) => {
  let y = parseInt(x, 16);
  if (y > 0.5 * Math.pow(16, byteLen)) {
    return y - Math.pow(16, byteLen);
  } else {
    return y;
  }
}

const formatIntAddress = (x) => {
  if (typeof x === 'string' && x.indexOf('0x') !== -1) {
    x = x.substr(2, x.length);
  } else {
    x = x.toString();
    x = trimStart(
      toHex(x, x.length),
      '0'
    );
  }
  return x;
};

export const gaToObject = (x) => {
  x = formatIntAddress(x);
  return {
    PlanetIndex: parseInt(flip(x.substr(0, 1)), 16),
    SolarSystemIndex: parseInt(x.substr(1, 3), 16),
    VoxelY: signInt(x.substring(6, 8), 2),
    VoxelZ: signInt(x.substring(8, 11), 3),
    VoxelX: signInt(x.substring(11, x.length), 3)
  };
}

export const uaToObject = (x) => {
  x = formatIntAddress(x);
  const PlanetIndex = parseInt(x.substring(0, 1), 16);
  const SolarSystemIndex = parseInt(x.substring(1, 4), 16);
  const RealityIndex = parseInt(x.substring(4, 6), 16);
  const VoxelY = signInt(x.substring(6, 8), 2);
  const VoxelZ = signInt(x.substring(8, 11), 3);
  const VoxelX = signInt(x.substring(11, x.length), 3);

  let result = {
    GalacticAddress: {
      PlanetIndex,
      SolarSystemIndex,
      VoxelY,
      VoxelZ,
      VoxelX
    },
    RealityIndex: RealityIndex || 0,
  };
  return formatID(result);
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

export const formatForGlyphs = function(translatedId, planetIndex) {
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
  let result = [planetIndex, D, B, C, A].join('').split('');
  return result;
};

export function uuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    return Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8).toString(16);
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
  return `<div style="font-size:14px;border-radius:0px; max-width: 200px;">${content}</div>`
}

// Cleans up the left over object references after a component unmounts, helps with garbage collection
export const cleanUp = (obj, defer = false) => {
  if (defer) {
    setTimeout(() => cleanUp(obj), 0);
    return;
  }
  let contextProps = Object.keys(obj);
  each(contextProps, (key) => {
    if (key === 'willUnmount') {
      return;
    }
    obj[key] = undefined;
  });
}

export const dirSep = process.platform === 'win32' ? '\\' : '/';

const syncedKeys = ['image', 'name', 'description', 'teleports', 'profile'];
export const copyMetadata = (a, b, keys = syncedKeys) => {
  each(keys, (key) => a[key] = b[key]);
  return a;
}