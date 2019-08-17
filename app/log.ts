import fs from 'graceful-fs';
import path from 'path';

const lineEnding = process.platform === 'win32' ? '\r\n' : '\n';

class log {
  public location: string;

  constructor() {
    this.location = './';
  }
  init(location) {
    this.location = location;
  }
  error(...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }

    let ts = Date.now();
    let argsString = '';
    for (let i = 0; i < args.length; i++) {
      if (args[i] instanceof Error) {
        argsString += `${args[i].message}\n`;
        argsString += `${args[i].stack}\n`;
        if (typeof window !== 'undefined') {
          window.Raven.captureException(args[i]);
        }
        continue;
      }
      argsString += `${JSON.stringify(args[i])} `;
    }
    let output = `${ts}:    ${argsString.replace(/"/g, '').replace(/\\\\/g, '\\')}`;
    let configPath = path.resolve(this.location, 'NMC.log');
    fs.appendFile(configPath, output + lineEnding, {
      // @ts-ignore
      flags: 'w'
    }, (err) => {
      if (err) console.log(err);
    });
  }
}

export default new log();
