const {saveKeyMapping} = require('./constants');

const each = (obj, cb)=>{
  if (Array.isArray(obj)) {
    for (let i = 0, len = obj.length; i < len; i++) {
      if (cb(obj[i], i) === false) {
        return;
      }
    }
  } else if (typeof obj === 'object') {
    let keys = Object.keys(obj);
    for (let i = 0, len = keys.length; i < len; i++) {
      cb(obj[keys[i]], keys[i]);
    }
  }
};

const rEach = (array, cb, finishCb, i = -1) => {
  i++;
  if (array[i] === undefined) {
    if (typeof finishCb === 'function') finishCb();
    return;
  }
  let next = () => rEach(array, cb, finishCb, i);
  cb(array[i], i, next);
}

const findIndex = function(arr, cb) {
	for (let i = 0, len = arr.length; i < len; i++) {
		if (cb(arr[i], i, arr)) {
			return i;
		}
	}
	return -1;
}

const find = function(arr, cb) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      return arr[i];
    }
  }
  return null;
}

const filter = function (arr, cb) {
  let result = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
};

const map = function (arr, fn) {
  if (arr == null) {
    return [];
  }

  let len = arr.length;
  let out = Array(len);

  for (let i = 0; i < len; i++) {
    out[i] = fn(arr[i], i, arr);
  }

  return out;
}

const includes = function (arr, val, index) {
  for (let i = 0 | index; i < arr.length; i++) {
    if (arr[i] === val) {
      return true;
    }
  }
  return false;
}

const merge = function() {
  let [result, ...extenders] = Array.from(arguments);
  for (let i = 0, len = extenders.length; i < len; i++) {
    let keys = Object.keys(extenders[i]);
    for (let z = 0, len = keys.length; z < len; z++) {
      result[keys[z]] = extenders[i][keys[z]]
    }
  }
  return result;
}

const tryFn = function(fn, errCb) {
  try {
    return fn();
  } catch (e) {
    if (typeof errCb === 'function') {
      errCb(e);
    }
  }
};

const parseSaveKeys = (saveData, write = false) => {
  let reverse = {};
  if (write) {
    reverse = saveKeyMapping;
  } else {
    each(saveKeyMapping, (val, key) => {
      reverse[val] = key;
    });
  }
  each(saveData, (val, key) => {
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        each(val, (item, i) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            val[i] = parseSaveKeys(item);
          }
        })
      } else {
        val = parseSaveKeys(val);
      }
    }
    if (reverse[key]) {
      saveData[reverse[key]] = val;
      delete saveData[key];
    }
  });
  return saveData;
}

module.exports = {each, rEach, findIndex, find, filter, map, includes, merge, tryFn, parseSaveKeys};