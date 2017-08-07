const fs = require('fs');
const copyFile = require('./copy');

class Json {
  constructor(path, fileName, defaultObj, cb){
    this.shouldWrite = false;
    this.fileName = fileName;
    this.path = `${path}/${this.fileName}`;
    this.backupPath = `${path}/__backup__${this.fileName}`;
    this.data = defaultObj ? defaultObj : {};
    this.init(this.path, cb);
  }
  init(readPath, cb, fromFailure=null){
    fs.readFile(readPath, (err, data=this.data)=>{
      if (err) {
        fs.writeFile(this.path, JSON.stringify(this.data), (err, data)=>{
          if (err) {
            console.log(err);
            return;
          }
          this.callback(cb);
        });
      }
      try {
        this.data = typeof data === 'string' ? JSON.parse(data) : data;
        this.callback(cb);
      } catch (e) {
        if (fs.existsSync(this.backupPath) && !fromFailure) {
          this.init(this.backupPath, cb, true);
          return;
        }
        console.log(e)
        this.callback(cb);
      }
    });
  }
  callback(cb){
    this.shouldWrite = true;
    cb(this.data);
  }
  writeFile(cb){
    if (!this.shouldWrite) {
      cb(this.data);
      return;
    }
    copyFile(this.path, this.backupPath, (err)=>{
      if (err) {
        console.log(err);
        return;
      }
      fs.writeFile(this.path, JSON.stringify(this.data), (err, data)=>{
        if (err) {
          console.log(err);
          return;
        }
        if (typeof cb === 'function') {
          cb(this.data);
        }
      });
    });
  }
  set(key, value){
    this.data[key] = value;
    this.writeFile();
  }
  get(key){
    try {
      return this.data;
    } catch (e) {
      return null;
    }
  }
  remove(key){
    delete this.data[key];
    this.writeFile();
  }
}

module.exports = Json;