import {remote, desktopCapturer} from 'electron';
import sendkeys from 'sendkeys'
import {each, rEach} from '@jaszhix/utils';
import {orderBy} from 'lodash';
import state from './state';
import log from './log';
import {fsWorker} from './utils';
import {letters} from './constants';

const steamScreenshotPathRegex = /\\remote\\275850\\screenshots\\(\d+_\d+)\.jpg/;
const primaryDisplay = remote.screen.getPrimaryDisplay();
const types = ['window'];
let key = 'bounds';

const steamCapture = (callback) => {
  // Trigger F12 key press, then find the newest screenshot in NMS' screenshot directory.
  // Timestamps are conveniently in the file name.
  sendkeys('{F12}').then(() => setTimeout(() => {
    fsWorker.walk(state.steamInstallDirectory, (err, paths) => {
      if (err) {
        log.error(err);
        callback('');
        return;
      }

      let captures = [];

      each(paths, (path) => {
        const match = path.match(steamScreenshotPathRegex);
        if (match) {
          const [time, n] = match[1].split('_');
          captures.push({
            path: match.input,
            time: parseInt(time),
            n: parseInt(n)
          });
        }
      });

      captures = orderBy(captures, ['time', 'n'], ['desc', 'desc']);

      fsWorker.readFile(captures[0].path, (err, data) => {
        if (err) {
          log.error(err);
          callback('');
          return;
        }

        callback(`data:image/jpg;base64,${Buffer.from(data).toString('base64')}`);
      });
    });
  }, 2000));
}

const screenshot = function(proceed: boolean, callback: Function) {
  if (!proceed) {
    callback('');
    return;
  }

  if (process.platform === 'win32') {
    types.push('screen');
    key = 'workArea';
  }

  switch (state.autoCaptureBackend) {
    case 'steam':
      // Find the system Steam directory. This looks similar to the way NMS' install directory is found,
      // but the NMS install directory might be on another drive. Once it's found, result is stored.
      fsWorker.exists(state.steamInstallDirectory, (exists) => {
        if (exists) {
          steamCapture(callback);
          return;
        }

        rEach(letters, (letter, i, next) => {
          const steamInstallDirectory = `${letter}:\\Program Files (x86)\\Steam\\userdata`;
          fsWorker.exists(steamInstallDirectory, (exists) => {
            if (exists) {
              state.set({steamInstallDirectory});
              steamCapture(callback);
              return;
            }
            next();
          });
        });
      });
      break;
    case 'legacy':
      desktopCapturer.getSources({
        types,
        thumbnailSize: {
          width: Math.floor(primaryDisplay[key].width / 2),
          height: Math.floor(primaryDisplay[key].height / 2)
        }
      }, (error, sources) => {
        if (error) {
          log.error(`Unable to get desktop capturer sources: ${error}`);
          callback('');
          return;
        };
        for (let i = 0; i < sources.length; ++i) {
          if (sources[i].name === 'Screen 1' || sources[i].name === 'Entire screen' || sources[i].name === `No Man's Sky`) {
            // @ts-ignore
            callback(sources[i].thumbnail.toDataURL('image/jpeg', 0.75));
            return;
          }
        }
        log.error('No screen found for screenshot auto-capture.');
        callback('');
      });
      break;
  }
}

export default screenshot;
