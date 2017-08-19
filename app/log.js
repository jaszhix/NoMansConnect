const fs = require('fs');
const path = require('path');

class log {
  constructor() {
    this.location = './';
  }
  init(location){
    this.location = location;
  }
  error(data){
    try {
      let ts = new Date();
      let output = `${ts}:    ${JSON.stringify(data)}`;
      let configPath = path.resolve(this.location, 'NMC.log');
      fs.appendFile(configPath, output + '\r\n', {
        flags: 'w'
      }, (err)=>{
        if (err) throw err;
      });
    } catch (e) {}
  }
}

module.exports = new log();