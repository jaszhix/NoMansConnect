const axios = require('axios/dist/axios')

const opts = {
  baseURL: 'https://neuropuff.com/api/',
  timeout: 60000,
  xsrfCookieName: 'csrftoken'
};

if (process.env.NODE_ENV === 'development') {
  opts.baseURL = 'http://z.npff.co:8000/api/'
}

const ajax = axios.create(opts);

onmessage = function(e) {
  let method = e.data.method;
  let url = e.data.url;
  let obj = e.data.obj ? e.data.obj : {};
  let params = e.data.params ? e.data.params : [];
  ajax[method](url, obj).then((res)=>{
    postMessage({
      data: res.data,
      func: e.data.func,
      params: params
    });
  }).catch((err)=>{
    postMessage({
      func: e.data.func,
      params: e.data.params,
      err: 'err',
      status: err.response ? err.response.status : 400
    });
  });
}