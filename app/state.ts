import {remote} from 'electron';
import os from 'os';
import path from 'path';
import {pick, uniqBy} from 'lodash';
import {each, filter, findIndex, cloneDeep} from '@jaszhix/utils';
import {init} from '@jaszhix/state';

import {handleRestart} from './dialog';
import log from './log';
import {fsWorker, ajaxWorker} from './utils';
import galaxies from './static/galaxies.json';
import knownProducts from './static/knownProducts.json';
import {showDefault} from './constants';

const {dialog} = remote;
const win = remote.getCurrentWindow();

const state: GlobalState = init({
  // Core
  knownProducts,
  galaxies,
  defaultLegendKeys: Object.keys(showDefault),
  completedMigration: false,
  newUser: false,
  version: '1.10.2',
  notification: {
    message: '',
    type: 'info',
    onClick: null,
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
  focusKey: false,
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
  mapDrawDistance: true,
  mapLODFar: false,
  mapSkyBox: true,
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
  showMap: true,
  displayColorPicker: false,
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
    'mapLODFar',
    'mapSkyBox',
    'show',
    'showMap',
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
    'focusKey',
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
  _init: (cb: () => void) => {
    state.windowId = state.connect('window', () => win);

    if (process.env.NODE_ENV === 'production') {
      import(/* webpackChunkName: "sentry" */ '@sentry/browser').then((Sentry) => {
        Sentry.init({dsn: 'https://9729d511f78f40d0ae5ebdeabc9217fc@sentry.io/180778'});
        Sentry.setExtras(pick(state, ['version', 'username', 'winVersion', 'remoteLength', 'map3d', 'pollRate', 'ps4User', 'offline']));
        Sentry.setExtra('NODE_ENV', process.env.NODE_ENV);
        window.Sentry = Sentry;

        state.initStorageWorkers(cb);
      });
    } else {
      state.staticBase = 'http://z.npff.co:8000';
      state.initStorageWorkers(cb);
    }
  },
  initStorageWorkers: (cb: () => void) => {
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
      if (!stateUpdate.show.Center.shape) {
        each(stateUpdate.show, (val, key) => {
          stateUpdate.show[key].shape = 'circle';
        });
      }

      if (stateUpdate.show.PS4) {
        stateUpdate.show.Manual = showDefault.Manual;
        delete stateUpdate.show.PS4;
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
  validateCache: (obj) => {
    let remoteLength = obj.remoteLocations.results.length;
    state.set({loading: 'Validating locations Please wait...', remoteLength});

    // Only reset the maintenance routine wait period if the client is online,
    // since it partially depends on an API query.
    if (!state.offline && !obj.offline) obj.maintenanceTS = Date.now();

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
  },
  handleMaintenance: async (obj, cb) => {
    let {maintenanceTS} = state;

    // Maintenance runs once every 24 hours, and only during startup.
    // It clears locations with invalid coordinates that will result in NMS or NMC not
    // working properly, and purges locations from cache other users marked private.
    let needsMaintenance = maintenanceTS + 86400000 < Date.now();

    if (!needsMaintenance) return cb();

    let next = () => {
      state.validateCache(obj);

      cb();
    };

    if (!state.offline && !obj.offline) {
      // Fetch a list of private location IDs that will be removed from client cache.
      // The API is also filtering these from responses, but if a location later becomes
      // private after being cached locally, it needs to be removed during maintenance.
      ajaxWorker.get('/nmslocationmaintenance/').then((res) => {
        let ids = res.data;

        each(ids, (id) => {
          let index = findIndex(obj.remoteLocations.results, (location) => {
            let isFriendOfPrivateOwner = false;

            // Friends can see each other's private locations.
            if (state.profile) {
              let {friends} = state.profile;

              each(friends, (friend) => {
                if (friend.username === location.username) isFriendOfPrivateOwner = true;
              })
            }
            return location.id === id && location.username !== state.username && !isFriendOfPrivateOwner;
          });

          if (index > -1) obj.remoteLocations.results.splice(index, 1);
        });

        next();
      }).catch(next)

      return;
    }

    next();
  },
  handleState: (obj) => {
    console.log(`STATE: `, obj);

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
  window.state = state;
}

export default state;