const Json = require('./json');

onmessage = function(e) {
  if (e.data.method === 'new') {
    global.Json = new Json(e.data.configDir, e.data.fileName, e.data.default, (res)=>{
      postMessage(JSON.stringify(res));
    });
  } else if (e.data.method === 'set') {
    global.Json.set(e.data.key, JSON.parse(e.data.value));
  } else if (e.data.method === 'get') {
    postMessage(JSON.stringify(global.Json.get(e.data.key)));
  } else if (e.data.method === 'remove') {
    global.Json.remove(e.data.key);
  }
}