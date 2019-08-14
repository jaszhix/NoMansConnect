import {saveKeyMapping} from './constants';
import {each} from '@jaszhix/utils';

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

export {
  parseSaveKeys
}