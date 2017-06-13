import {remote, desktopCapturer} from 'electron';

const primaryDisplay = remote.screen.getPrimaryDisplay();

function screenshot(init, callback, debug) {
  if (init) {
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
      callback('');
      return;
    };
    for (let i = 0; i < sources.length; ++i) {
      if (sources[i].name === 'Screen 1') {
        callback(sources[i].thumbnail.toDataURL('image/jpeg', 0.75));
        return
      }
    }
  });
}

module.exports = screenshot;