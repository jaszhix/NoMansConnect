const fs = require('fs');

class Json {
  constructor(path, fileName, defaultObj, cb){
    this.path = `${path}/${fileName}`;
    this.data = defaultObj ? defaultObj : {};
    fs.readFile(this.path, (err, data=this.data)=>{
      if (err) {
        fs.writeFile(this.path, JSON.stringify(this.data), (err, data)=>{
          if (err) {
            console.log(err);
            return;
          }
          cb(this.data);
        });
      }
      try {
        this.data = JSON.parse(data);
        cb(this.data);
      } catch (e) {
        console.log(e)
        cb(this.data);
      }
    });
  }
  set(key, value){
    this.data[key] = value;
    fs.writeFile(this.path, JSON.stringify(this.data), (err, data)=>{
      if (err) {
        console.log(err);
        return;
      }
    });
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
    fs.writeFile(this.path, JSON.stringify(this.data), (err, data)=>{
      if (err) {
        console.log(err);
        return;
      }
    });
  }
}

module.exports = Json;