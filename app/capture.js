import {remote, desktopCapturer} from 'electron';
import log from './log';

const primaryDisplay = remote.screen.getPrimaryDisplay();
const types = ['window']
let key = 'bounds';

const screenshot = function(proceed, callback, debug) {
  if (!proceed) {
    callback('');
    return;
  }

  if (process.platform === 'win32') {
    types.push('screen');
    key = 'workArea';
  }

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
        callback(sources[i].thumbnail.toDataURL('image/jpeg', 0.75));
        return;
      }
    }
    log.error('No screen found for screenshot auto-capture.');
    callback('');
  });
}

export default screenshot;