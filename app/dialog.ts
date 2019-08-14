import {remote} from 'electron';
import openExternal from 'open-external';
import {each} from '@jaszhix/utils';

import log from './log';
import state from './state';
import v from 'vquery';
import {ajaxWorker} from './utils';

// @ts-ignore
import defaultWallpaper from './assets/images/default_wallpaper.png';

const {dialog} = remote;

export const baseError = () => {
  dialog.showMessageBox({
    type: 'info',
    buttons: [],
    title: 'Base Save',
    message: 'Unable to save your base. Have you claimed a base yet?'
  });
};

export const handleRestart = () => {
  let monitor = state.trigger('getMonitor');
  state.set({closing: true});
  setTimeout(() => {
    if (process.env.NODE_ENV === 'production') {
      remote.app.relaunch();
      if (process.platform === 'darwin') {
        remote.app.quit();
      } else {
        window.close();
      }
    } else {
      if (monitor) {
        monitor.stop();
      }
      window.location.reload();
    }
  }, 2000);
};

export const handleWallpaper = () => {
  let wallpaper: string = defaultWallpaper;
  if (state.wallpaper) {
    wallpaper = `'file://${state.wallpaper}'`;
  }
  v(document.body).css({
    backgroundImage: `url(${wallpaper})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat'
  });
};

export const handleSetWallpaper = () => {
  if (state.wallpaper) {
    state.set({wallpaper: null}, handleWallpaper);
    return;
  }
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif']},],
  }, (cb) => {
    if (cb && cb[0]) {
      state.set({
        wallpaper: cb[0]
      }, handleWallpaper);
    }
  });
};

export const handleSelectInstallDirectory = () => {
  dialog.showOpenDialog({properties: ['openDirectory']}, (cb) => {
    if (cb && cb[0]) {
      state.set({
        installDirectory: cb[0]
      }, handleRestart);
    }
  });
};

export const handleSelectSaveDirectory = () => {
  dialog.showOpenDialog({properties: ['openDirectory']}, (cb) => {
    if (cb && cb[0]) {
      state.set({
        saveDirectory: cb[0],
        title: 'No Man\'s Connect'
      }, handleRestart);
    }
  });
}

export const handleUpgrade = (nextVersion) => {
  let {title} = state;

  title = title.replace(/NO/, 'OLD');
  state.set({
    updateAvailable: true,
    title
  });

  let upgradeMessage = `No Man's Connect v${nextVersion} is available.`;
  let infoUrl = 'https://github.com/jaszhix/NoMansConnect/releases';

  log.error(upgradeMessage);

  setTimeout(() => {
    dialog.showMessageBox({
      title: 'No Man\'s Connect Upgrade',
      message: upgradeMessage,
      buttons: ['OK', 'Teleport to the Github releases page']
    }, result=>{
      if (result === 1) {
        openExternal(infoUrl);
      } else {
        return;
      }
    });
  }, 0);
}

export const handleSaveDataFailure = () => {
  dialog.showMessageBox({
    title: 'Which platform do you use?',
    message: 'Save data not found. Select PS4 to skip this step, and disable PC specific features.',
    buttons: ['PC', 'PS4/XB1']
  }, result=>{
    state.set({ps4User: result === 1}, () => {
      if (result === 0) {
        handleSelectSaveDirectory();
      } else {
        handleRestart();
      }
    });
  });
};

export const handleUsernameOverride = (username: string): void => {
  if (username.length === 0) {
    dialog.showMessageBox({
      type: 'info',
      buttons: [],
      title: 'Username Override',
      message: 'Username field cannot be blank.'
    });
    return;
  }

  ajaxWorker.post('/nmsoverride/', {
    username: state.username,
    override: username,
    machineId: state.machineId,
    ps4User: state.ps4User
  }).then((res) => {
    window.jsonWorker.postMessage({
      method: 'remove',
      key: 'remoteLocations'
    });
    each(state.storedLocations, (location, i) => {
      if (state.storedLocations[i].username === state.username) {
        state.storedLocations[i].username = username;
      }
    });
    state.set({
      storedLocations: state.storedLocations,
      username: username
    }, handleRestart);

  }).catch((err) => {
    if (typeof err.response.data.status !== 'undefined' && err.response.data.status === 'protected') {
      dialog.showMessageBox({
        type: 'info',
        buttons: [],
        title: 'Username Protected',
        message: 'You must disable username protection before changing your username.'
      });
    }
  });
}

export const handleProtectedSession = (username = 'Explorer'): void => {
  dialog.showMessageBox({
    title: `Protection Enabled For ${username}`,
    message: 'This username was protected by another user. When you protect your username, the app will associate your computer with your username to prevent impersonation. If this is in error, please open an issue on the Github repository.',
    buttons: ['OK', 'Send Recovery Email', 'Enter Recovery Token']
  }, result=>{
    if (result === 1) {
      ajaxWorker.post('/nmsrequestrecovery/', {
        machineId: state.machineId,
        username
      }).then(() => {
        state.set({username}, () => handleProtectedSession(username));
      }).catch((err) => {
        if (err.response && err.response.status === 400) {
          dialog.showMessageBox({
            type: 'info',
            buttons: [],
            title: 'Email Not Found',
            message: 'An email address associated with your profile could not be found.'
          });
        }
      });
    } else if (result === 2) {
      state.set({recoveryToken: true});
    }
  });
}
