import axios from 'axios';
import _ from 'lodash';

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
  location.id = `${location.VoxelX}:${location.VoxelY}:${location.VoxelZ}:${location.SolarSystemIndex}:${location.PlanetIndex}`
  return location;
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

export var ajax = axios.create({
  //baseURL: 'http://192.168.1.148:8000/api/',
  baseURL: 'https://neuropuff.com/api/',
  timeout: 30000,
  xsrfCookieName: 'csrftoken'
});