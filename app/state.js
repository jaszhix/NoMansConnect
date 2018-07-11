import {remote} from 'electron';
import os from 'os';
import fs from 'graceful-fs';
import {assignIn, pick, uniqBy, take} from 'lodash';
import {each, filter} from './lang';
import initStore from './store';
import galaxies from './static/galaxies.json';
import knownProducts from './static/knownProducts.json';
import Raven from 'raven-js';

const {dialog} = remote;

const state = initStore({
  // Core
  knownProducts,
  galaxies,
  completedMigration: false,
  version: '1.1.3',
  notification: {
    message: '',
    type: 'info'
  },
  newsId: '',
  apiBase: 'https://neuropuff.com/api/',
  winVersion: os.release(),
  machineId: null,
  protected: false,
  init: true,
  homedir: remote.app.getPath('home'),
  configDir: remote.app.getPath('userData'),
  width: window.innerWidth,
  height: window.innerHeight,
  tableData: [],
  title: 'NO MAN\'S CONNECT',
  installDirectory: null,
  saveDirectory: null,
  saveFileName: '',
  saveVersion: null,
  mode: 'normal',
  storedBases: [],
  storedLocations: [],
  remoteLocations: [],
  remoteLength: 0,
  currentLocation: null,
  selectedLocation: null,
  username: 'Explorer',
  profile: null,
  favorites: [],
  mods: [],
  selectedImage: null,
  autoCapture: false,
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
  maximized: false,
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
  showHidden: false,
  showOnlyNames: false,
  showOnlyDesc: false,
  showOnlyScreenshots: false,
  showOnlyGalaxy: false,
  showOnlyBases: false,
  showOnlyPC: false,
  showOnlyCompatible: false,
  sortByDistance: false,
  sortByModded: false,
  show: {
    Shared: true,
    PS4: true,
    Explored: true,
    Center: true,
    Favorite: true,
    Current: true,
    Selected: true,
    Base: true
  },
  compactRemote: false,
  maintenanceTS: Date.now(),
  offline: false,
  error: '',
  closing: false,
  navLoad: false,
  installing: false,
  settingsKeys: [
    'newsId',
    'maximized',
    'maintenanceTS',
    'wallpaper',
    'installDirectory',
    'saveDirectory',
    'username',
    'mapLines',
    'map3d',
    'mapDrawDistance',
    'show',
    'filterOthers',
    'useGAFormat',
    'remoteLocationsColumns',
    'sortStoredByTime',
    'showHidden',
    'pollRate',
    'mode',
    'storedBases',
    'storedLocations',
    'favorites',
    'autoCapture',
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
    'sortByDistance',
    'sortByModded'
  ],
  _init: () => {

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
    }

    let saveDirPath;
    let basePath = state.configDir.split('\\AppData')[0];
    let steamPath = `${basePath}\\AppData\\Roaming\\HelloGames\\NMS`;
    let gogPath = `${basePath}\\AppData\\Roaming\\HelloGames\\NMS\\DefaultUser`;
    if (fs.existsSync(steamPath)) {
      saveDirPath = steamPath;
    } else if (fs.existsSync(gogPath)) {
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
    state.handleSettingsWorker();
    const settings = pick(state, state.settingsKeys);
    window.settingsWorker.postMessage({
      method: 'new',
      default: settings,
      fileName: 'settings.json',
      configDir: state.configDir,
    });

  },
  handleJsonWorker: () => {
    window.jsonWorker.onmessage = (e) => {
      state.set(e.data, true);
    }
  },
  handleSettingsWorker: () => {
    window.settingsWorker.onmessage = (e) => {
      let stateUpdate = {};
      if (!e.data.maintenanceTS) {
        stateUpdate.maintenanceTS = state.maintenanceTS - 6.048e+8;
      }

      if (e.data.offline) {
        stateUpdate.title = `${state.updateAvailable ? 'OLD' : 'NO'} MAN'S DISCONNECT`;
        stateUpdate.init = false;
      }

      each(e.data, (value, key) => {
        if (state.settingsKeys.indexOf(key) > -1) {
          stateUpdate[key] = value;
        }
      });

      state.set(stateUpdate, true);
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

      let locations = filter(obj.remoteLocations.results, (location) => {
        return (location.data.upvote
          || (location.data.VoxelY > -128 && location.data.VoxelY < 127
          && location.data.VoxelZ > -2048 && location.data.VoxelZ < 2047
          && location.data.VoxelX > -2048 && location.data.VoxelX < 2047));
      });
      locations = uniqBy(locations, (location) => {
        return location.data.id;
      });
      obj.remoteLocations.results = locations;
      obj.remoteLocations.count = locations.length;
      obj.page = Math.ceil(obj.remoteLocations.results.length / state.pageSize)
      obj.remoteLocations.page = obj.page;
    }
    cb(obj);
  },
  handleState: (obj) => {
    if (state.closing || obj.search) {
      return;
    }
    each(obj, (value, key) => {
      if (state.settingsKeys.indexOf(key) > -1) {
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
});
state._init();
window.state = state;
export default state;