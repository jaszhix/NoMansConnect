const fs = require('fs');
const copyFile = require('./copy');
const {tryFn} = require('./lang');

class Json {
  constructor(path, fileName, defaultObj, cb) {
    this.shouldWrite = false;
    this.fileName = fileName;
    this.path = `${path}/${this.fileName}`;
    this.backupPath = `${path}/__backup__${this.fileName}`;
    this.data = defaultObj ? defaultObj : {};
    this.init(this.path, cb);
    this.writing = false;
  }
  init(readPath, cb, fromFailure=null) {
    fs.readFile(readPath, (err, data=this.data) => {
      if (err) {
        this.writing = true;
        fs.writeFile(this.path, JSON.stringify(this.data), (err, data) => {
          this.writing = false;
          if (err) {
            console.log(err);
            return;
          }
          this.callback(cb);
        });
      }
      tryFn(() => {
        this.data = JSON.parse(data);
        this.callback(cb);
      }, (e) => {
        if (fs.existsSync(this.backupPath) && !fromFailure) {
          this.init(this.backupPath, cb, true);
          return;
        }
        console.log(e)
        this.callback(cb);
      });
    });
  }
  callback(cb) {
    this.shouldWrite = true;
    cb(this.data);
  }
  _writeFile(cb) {
    fs.writeFile(this.path, JSON.stringify(this.data), (err, data) => {
      this.writing = false;
      if (err) {
        console.log(err);
        return;
      }
      if (typeof cb === 'function') {
        cb(this.data);
      }
    });
  }
  writeFile(cb, backup) {
    if (!this.shouldWrite) {
      if (typeof cb === 'function') {
        cb(this.data);
      }
      return;
    }
    if (backup) {
      copyFile(this.path, this.backupPath, (err) => {
        if (err) {
          console.log(err);
          return;
        }
        this._writeFile(cb);
      });
    } else {
      this._writeFile(cb);
    }
  }
  set(key, value) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.writing) {
      this.timeout = setTimeout(() => this.set(...arguments), 1000);
      return;
    }
    this.data[key] = value;
    this.writing = true;
    this.writeFile(null, this.data.hasOwnProperty('maintenanceTS'));
  }
  get(key) {
    return tryFn(() => this.data, () => null);
  }
  remove(key) {
    delete this.data[key];
    this.writeFile();
  }
}

module.exports = Json;