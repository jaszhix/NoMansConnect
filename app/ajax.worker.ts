import axios from 'axios';
import log from './log';

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
    // @ts-ignore
    .then((res) => postMessage([null, {data: res.data}]))
    .catch((err) => {
      log.error(err);
      let errObject = {
        response: err. response ? {
          status: err.response.status,
          data: err.response.data,
        } : null
      };
      let {message} = err;
      // @ts-ignore
      postMessage([{message, ...errObject}])
    })
}

export default {} as typeof Worker & {new (): Worker};