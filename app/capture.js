import {remote, desktopCapturer} from 'electron';

const primaryDisplay = remote.screen.getPrimaryDisplay();

function screenshot(proceed, callback, debug) {
  if (!proceed) {
    callback('');
    return;
  }

  desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: {
      width: primaryDisplay.workArea.width / 2,
      height: primaryDisplay.workArea.height / 2
    }
  }, (error, sources) => {
    if (error) {
      log.error(error);
      callback('');
      return;
    };
    for (let i = 0; i < sources.length; ++i) {
      if (sources[i].name === 'Screen 1' || sources[i].name === 'Entire screen') {
        callback(sources[i].thumbnail.toDataURL('image/jpeg', 0.75));
        return;
      }
    }
    log.error('No screen found for screenshot auto-capture.');
    callback('');
  });
}

module.exports = screenshot;