import {remote} from 'electron';
import os from 'os';
import path from 'path';
import Raven from 'raven-js';
import {assignIn, pick, uniqBy, cloneDeep} from 'lodash';
import {each, filter} from '@jaszhix/utils';
import initStore from '@jaszhix/state';

import {handleRestart} from './dialog';
import log from './log';
import {fsWorker} from './utils';
import galaxies from './static/galaxies.json';
import knownProducts from './static/knownProducts.json';


const {dialog} = remote;
const win = remote.getCurrentWindow();

const showDefault = {
  Shared: {
    color: '#0080db',
    value: true,
    listKey: 'remoteLocations'
  },
  PS4: {
    color: '#0039db',
    value: true,
    listKey: 'ps4Locations'
  },
  Explored: {
    color: '#5fcc93',
    value: true,
    listKey: 'locations'
  },
  Center: {
    color: '#ba3935',
    value: true,
    listKey: 'center'
  },
  Favorite: {
    color: '#9c317c',
    value: true,
    listKey: 'favLocations'
  },
  Current: {
    color: '#FFF',
    value: true,
    listKey: 'currentLocation'
  },
  Selected: {
    color: '#ffc356',
    value: true,
    listKey: 'selectedLocation'
  },
  Base: {
    color: '#9A9D99',
    value: true,
    listKey: 'baseLocations'
  }
};

const state: GlobalState = initStore({
  // Core
  knownProducts,
  galaxies,
  defaultLegendKeys: Object.keys(showDefault),
  completedMigration: false,
  newUser: false,
  version: '1.7.1',
  notification: {
    message: '',
    type: 'info'
  },
  newsId: '',
  apiBase: 'https://neuropuff.com/api/',
  staticBase: 'https://neuropuff.com',
  winVersion: os.release(),
  apiVersion: 3,
  machineId: null,
  protected: false,
  ready: false,
  init: true,
  homedir: remote.app.getPath('home'),
  configDir: remote.app.getPath('userData'),
  width: window.innerWidth,
  height: window.innerHeight,
  tableData: [],
  title: 'NO MAN\'S CONNECT',
  installDirectory: null,
  saveDirectory: null,
  steamInstallDirectory: '',
  saveFileName: '',
  saveVersion: null,
  mode: 'normal',
  storedBases: [],
  storedLocations: [],
  remoteLocations: [],
  remoteLength: 0,
  remoteNext: null,
  remoteChanged: [],
  currentLocation: null,
  selectedLocation: null,
  multiSelectedLocation: false,
  username: 'Explorer',
  profile: null,
  displaySettings: null,
  displayLog: null,
  displayProfile: null,
  displayFriendRequest: null,
  displayBaseRestoration: null,
  displaySaveEditor: false,
  favorites: [],
  mods: [],
  selectedImage: null,
  autoCapture: false,
  autoCaptureSpaceStations: false,
  autoCaptureBackend: 'steam', // or 'legacy'
  nmsIsFullscreen: false,
  backupSaveFile: true,
  selectedGalaxy: 0,
  galaxyOptions: [],
  pollRate: 60000,
  ps4User: process.platform === 'darwin',
  // UI
  updateAvailable: false,
  view: 'index',
  sort: '-created',
  search: '',
  searchInProgress: false,
  searchCache: {
    results: [],
    count: 0,
    next: null,
    prev: null
  },
  pagination: false,
  page: 1,
  pageSize: 60,
  paginationEnabled: true,
  loading: 'Loading...',
  maximized: win.isMaximized(),
  mapLines: false,
  map3d: false,
  mapDrawDistance: false,
  wallpaper: null,
  filterOthers: false,
  useGAFormat: false,
  usernameOverride: false,
  registerLocation: false,
  setEmail: false,
  recoveryToken: false,
  remoteLocationsColumns: 1,
  sortStoredByTime: false,
  sortStoredByKey: 'created',
  filterStoredByBase: false,
  filterStoredByScreenshot: false,
  showHidden: false,
  showOnlyNames: false,
  showOnlyDesc: false,
  showOnlyScreenshots: false,
  showOnlyGalaxy: false,
  showOnlyBases: false,
  showOnlyPC: false,
  showOnlyCompatible: false,
  showOnlyFriends: false,
  sortByDistance: false,
  sortByModded: false,
  sortByFavorites: false,
  sortByTeleports: false,
  sortByModified: false,
  show: cloneDeep(showDefault),
  compactRemote: false,
  maintenanceTS: Date.now(),
  offline: false,
  error: '',
  closing: false,
  navLoad: false,
  settingsKeys: [
    'apiVersion',
    'newsId',
    'maximized',
    'maintenanceTS',
    'wallpaper',
    'installDirectory',
    'saveDirectory',
    'steamInstallDirectory',
    'username',
    'mapLines',
    'map3d',
    'mapDrawDistance',
    'show',
    'filterOthers',
    'useGAFormat',
    'remoteLocationsColumns',
    'sortStoredByTime',
    'sortStoredByKey',
    'filterStoredByBase',
    'filterStoredByScreenshot',
    'showHidden',
    'pollRate',
    'mode',
    'storedBases',
    'storedLocations',
    'favorites',
    'autoCapture',
    'autoCaptureSpaceStations',
    'autoCaptureBackend',
    'backupSaveFile',
    'ps4User',
    'compactRemote',
    'offline',
    'showOnlyNames',
    'showOnlyDesc',
    'showOnlyScreenshots',
    'showOnlyGalaxy',
    'showOnlyBases',
    'showOnlyPC',
    'showOnlyCompatible',
    'showOnlyFriends',
    'sortByDistance',
    'sortByModded',
    'sortByFavorites',
    'sortByTeleports',
    'sortByModified',
  ],
  _init: (cb: Function) => {
    state.windowId = state.connect('window', () => win);

    if (process.env.NODE_ENV === 'production') {
      Raven
        .config('https://9729d511f78f40d0ae5ebdeabc9217fc@sentry.io/180778', {
          environment: process.env.NODE_ENV,
          release: state.version,
          dataCallback: (data) => {
            assignIn(data.user, {
              username: state.username,
              resourceUsage: remote.app.getAppMetrics(),
              winVersion: state.winVersion,
              remoteLength: state.remoteLength,
              map3d: state.map3d,
              mapDrawDistance: state.mapDrawDistance,
              pollRate: state.pollRate
            });
            return data;
          }
        })
        .install();
        window.Raven = Raven;
    } else {
      state.staticBase = 'http://z.npff.co:8000';
    }

    let saveDirPath;
    let basePath = state.configDir.split('\\AppData')[0];
    let steamPath = `${basePath}\\AppData\\Roaming\\HelloGames\\NMS`;
    let gogPath = `${basePath}\\AppData\\Roaming\\HelloGames\\NMS\\DefaultUser`;
    fsWorker.exists(steamPath, (sExists) => {
      fsWorker.exists(gogPath, (gExists) => {
        if (sExists) {
          saveDirPath = steamPath;
        } else if (gExists) {
          saveDirPath = gogPath;
        }

        console.log(saveDirPath);

        state.saveDirectory = saveDirPath;

        state.handleJsonWorker();
        window.jsonWorker.postMessage({
          method: 'new',
          default: {
            remoteLocations: []
          },
          fileName: 'cache.json',
          configDir: state.configDir,
          pageSize: state.pageSize
        });
        state.handleSettingsWorker(cb);
        const settings = pick(state, state.settingsKeys);
        window.settingsWorker.postMessage({
          method: 'new',
          default: settings,
          fileName: 'settings.json',
          configDir: state.configDir,
        });
      });
    });
  },
  handleJsonWorker: () => {
    window.jsonWorker.onmessage = (e) => {
      state.set(e.data, true);
    }
  },
  handleSettingsWorker: (cb: Function) => {
    window.settingsWorker.onmessage = (e) => {
      let stateUpdate: GlobalState = {};

      // Clear all cache for major API change
      if (!e.data.apiVersion || e.data.apiVersion !== state.apiVersion) {
        state.set({loading: 'Performing migration, NMC will restart...'});
        fsWorker.unlink(path.join(state.configDir, 'settings.json'), (err) => {
          fsWorker.unlink(path.join(state.configDir, '__backup__settings.json'), (err) => {
            fsWorker.unlink(path.join(state.configDir, 'cache.json'), (err) => {
              handleRestart();
            });
          });
        });
        return;
      }

      if (!e.data.maintenanceTS) {
        stateUpdate.maintenanceTS = state.maintenanceTS - 6.048e+8;
      }

      if (e.data.offline) {
        stateUpdate.title = state.title.replace(/CONNECT/, 'DISCONNECT');
        stateUpdate.init = false;
      }

      each(e.data, (value, key) => {
        if (state.settingsKeys.indexOf(key) > -1) {
          stateUpdate[key] = value;
        }
      });

      // Temporary migration for legend data
      if (stateUpdate.show && typeof stateUpdate.show.Center === 'boolean') {
        each(stateUpdate.show, (val, key) => {
          each(showDefault, (_val, _key) => {
            if (key === _key) {
              stateUpdate.show[key] = _val;
            }
          });
        });
      }

      if (!state.ready) stateUpdate.ready = true;

      state.set(stateUpdate, () => {
        log.error('State initialized');
        if (typeof cb === 'function') {
          setTimeout(cb, 0);
        }
      }, true);
    }
  },
  handleMaintenance: (obj, cb) => {
    // This function will purge 25% of cached remote loccations after 4000 are
    // stored, so performance isn't compromised in the interim of a better solution.
    // Favorites will always stay in the list.
    // TODO: Find a beter way to handle cache
    if ((state.maintenanceTS + 86400000 < Date.now())) {
      let remoteLength = obj.remoteLocations.results.length;
      state.set({loading: 'Validating locations Please wait...', remoteLength});
      obj.maintenanceTS = Date.now();
      if (remoteLength < 6000) {
        cb(obj);
        return;
      }

      let locations = filter(obj.remoteLocations.results, (location: NMSLocation) => {
        return (location.upvote
          || (location.VoxelY > -128 && location.VoxelY < 127
          && location.VoxelZ > -2048 && location.VoxelZ < 2047
          && location.VoxelX > -2048 && location.VoxelX < 2047));
      });

      locations = uniqBy(locations, (location: NMSLocation) => {
        return location.dataId;
      });

      obj.remoteLocations.results = locations;
      obj.remoteLocations.count = locations.length;

      obj.page = Math.ceil(obj.remoteLocations.results.length / state.pageSize)
      obj.remoteLocations.page = obj.page;
    }

    cb(obj);
  },
  handleState: (obj) => {
    each(obj, (value, key) => {
      if (state.settingsKeys.indexOf(key) > -1) {
        console.log('Storing: ', key, value)
        window.settingsWorker.postMessage({
          method: 'set',
          key,
          value
        });
      }
    });
  },
  displayErrorDialog: (error) => {
    dialog.showErrorBox('NMC Error', error);
  },
  disconnectWindow: () => state.disconnect(state.windowId)
});

if (process.env.NODE_ENV === 'development') {
  window.state = state.default;
}

export default state;