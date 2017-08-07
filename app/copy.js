const fs = require('fs');

const copyFile = (source, target, cb) => {
  let cbCalled = false;
  const done = (err) => {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
  let read = fs.createReadStream(source);
  read.on('error', function(err) {
    done(err);
  });
  let write = fs.createWriteStream(target);
  write.on('error', function(err) {
    done(err);
  });
  write.on('close', function(ex) {
    done();
  });
  read.pipe(write);
}

module.exports = copyFile;