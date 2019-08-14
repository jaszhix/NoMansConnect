import fs from 'graceful-fs';

const copyFile = (source: fs.PathLike, target: fs.PathLike, cb: (e?: Error) => void) => {
  let cbCalled = false;

  const done = (err?) => {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  };

  let read = fs.createReadStream(source);
  read.on('error', done);

  let write = fs.createWriteStream(target);
  write.on('error', done);
  write.on('close', done);

  read.pipe(write);
}

export default copyFile;