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
  let [method, ...args] = e.data;
  ajax[method](...args)
    .then((res) => postMessage([null, {data: res.data}]))
    .catch((err) => {

      let errObject = {
        response: err. response ? {
          status: err.response.status,
          data: err.response.data,
        } : null
      };
      let {message} = err;
      postMessage([{message, ...errObject}])
    })
}