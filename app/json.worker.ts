import Json from './json';
import {tryFn} from '@jaszhix/utils';

onmessage = function(e) {
  if (e.data.method === 'new') {
    global.Json = new Json(e.data.configDir, e.data.fileName, e.data.default, (res)=>{
      if (!res.remoteLocations || res.remoteLocations && res.remoteLocations.results === undefined) {
        res.remoteLocations = {
          results: [],
          count: 0,
          next: null,
          prev: null
        };
      } else {
        if (res.remoteLocations.page && res.remoteLocations.page > 1) {
          res.page = res.remoteLocations.page;
        } else {
          res.page = Math.ceil(res.remoteLocations.results.length / e.data.pageSize);
        }
      }
      // @ts-ignore
      postMessage(res);
    });
  } else if (e.data.method === 'set') {
    tryFn(() => global.Json.set(e.data.key, e.data.value));
  } else if (e.data.method === 'get') {
    // @ts-ignore
    postMessage(global.Json.get(e.data.key));
  } else if (e.data.method === 'remove') {
    global.Json.remove(e.data.key);
  } else if (e.data.method === 'checkIfWriting') {
    // @ts-ignore
    postMessage(global.Json.writing);
  }
}

export default {} as typeof Worker & {new (): Worker};