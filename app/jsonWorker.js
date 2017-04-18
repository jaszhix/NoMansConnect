const Json = require('./json');

onmessage = function(e) {
  if (e.data.method === 'new') {
    global.Json = new Json(e.data.configDir, (res)=>{
      postMessage(res);
    });
  } else if (e.data.method === 'set') {
    global.Json.set(e.data.key, e.data.value);
  } else if (e.data.method === 'get') {
    postMessage(global.Json.get(e.data.key));
  } else if (e.data.method === 'remove') {
    global.Json.remove(e.data.key);
  }
}