const fs = require('fs');
const path = require('path');

const lineEnding = process.platform === 'win32' ? '\r\n' : '\n';

class log {
  constructor() {
    this.location = './';
  }
  init(location) {
    this.location = location;
  }
  error() {
    let args = Array.from(arguments);
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
    try {
      let ts = Date.now();
      let argsString = '';
      for (let i = 0; i < args.length; i++) {
        argsString += `${JSON.stringify(args[i])} `;
      }
      let output = `${ts}:    ${argsString.replace(/"/g, '').replace(/\\\\/g, '\\')}`;
      let configPath = path.resolve(this.location, 'NMC.log');
      fs.appendFile(configPath, output + lineEnding, {
        flags: 'w'
      }, (err)=>{
        if (err) throw err;
      });
    } catch (e) {}
  }
}

module.exports = new log();