import fs from 'fs';
import path from 'path';
import {StringDecoder} from 'string_decoder';
const decoder = new StringDecoder('utf8');
import axios from 'axios';
import _ from 'lodash';
import state from './state';

var exec = require('child_process').exec;
export var formatBytes = (bytes, decimals)=>{
  if (bytes === 0) {
    return '0 Byte';
  }
  var k = 1000;
  var dm = decimals + 1 || 3;
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toPrecision(dm) + ' ' + sizes[i];
};

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
      opts.shell = 'cmd.exe';
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
    window.localStorage.setItem(key, JSON.stringify(obj));
  },
  get: (key)=>{
    return JSON.parse(window.localStorage.getItem(key));
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
  let isNegative = int < 0;
  let offsets = {
    x: isNegative ? [4096, 2048, 1024] : [3584, 1536, 4096],
    z: [3584, 1536, 4096],
    y: isNegative ? [128, 256] : [224, 96, 256],
  };
  let na = offsets[axis];
  int = Math.abs(int);

  if (isNegative) {
    int = Math.abs(Math.abs(int - na[0]) - na[1]);
  } else {
    int = Math.abs(Math.abs(Math.abs(int - na[0]) - na[1]) - na[2]);
  }

  return int - 1;
};

export var convertIntegerZ = (int, na)=>{
  int = Math.abs(int);

  int = Math.abs(Math.abs(Math.abs(int - na[0]) - na[1]) - na[2])
  return int - 1;
};

var isValueNull = (variable)=>{
  return (variable == undefined || variable == null);
}

var setDefaultValueIfNull = (variable, defaultVal)=>{
  if(isValueNull(variable)) { variable = defaultVal; }
  return variable;
}

export var toHex = (str, totalChars)=>{
  totalChars = setDefaultValueIfNull(totalChars,2);
  str = ('0'.repeat(totalChars)+Number(str).toString(16)).slice(-totalChars).toUpperCase();
  return str;
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
    _.each(list, (file)=>{
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

export var getLastGameModeSave = (saveDirectory, mode, cb)=>{
  return new Promise((resolve, reject)=>{
    walk(saveDirectory, (err, results)=>{
      if (err) {
        console.log(err)
        reject(err);
      }
      results = _.filter(results, (result)=>{
        return (result.indexOf('st_') !== -1 || result.indexOf('DefaultUser') !== -1) && result.indexOf('\\cache\\') === -1 && result.indexOf('.hg') !== -1 && result.indexOf('mf_') === -1;
      });

      let obj = {
        normal: [0, 1, 2],
        survival: [3, 4, 5],
        creative: [6, 7, 8],
        permadeath: [9, 10, 11]
      };
      let saves = [];
      let saveInts = obj[mode];
      _.each(saveInts, (int)=>{
        _.each(results, (result)=>{
          let fileName = _.last(result.split('\\'));
          if (int === 0 && fileName === 'storage.hg' || result.indexOf(`storage${int + 1}.hg`) !== -1) {
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
      lastModifiedSave.result = decoder.write(fs.readFileSync(lastModifiedSave.result)).replace(/\0$/, '');
      lastModifiedSave.result = JSON.parse(lastModifiedSave.result);
      resolve(lastModifiedSave);
    });
  });
};

export var each = (obj, cb)=>{
  if (Array.isArray(obj)) {
    for (let i = 0, len = obj.length; i < len; i++) {
      cb(obj[i], i);
    }
  } else {
    for (let key in obj) {
      cb(obj[key], key);
    }
  }
};

export var repairInventory = (saveData)=>{
  each(saveData.result.PlayerStateData.ShipOwnership[0].Inventory.Slots, (slot, i)=>{
    saveData.result.PlayerStateData.ShipOwnership[0].Inventory.Slots[i].DamageFactor = 0;
  });

  each(saveData.result.PlayerStateData.Inventory.Slots, (slot, i)=>{
    saveData.result.PlayerStateData.Inventory.Slots[i].DamageFactor = 0;
  });

  each(saveData.result.PlayerStateData.WeaponInventory.Slots, (slot, i)=>{
    saveData.result.PlayerStateData.WeaponInventory.Slots[i].DamageFactor = 0;
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

export var css = (styleObject, newObject)=>{
  return _.assignIn(_.clone(styleObject), _.clone(newObject));
};

export var ajax = axios.create({
  //baseURL: 'http://192.168.1.148:8000/api/',
  baseURL: 'https://neuropuff.com/api/',
  timeout: 8000,
  xsrfCookieName: 'csrftoken'
});