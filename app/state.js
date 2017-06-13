import {remote} from 'electron';
import os from 'os';
import fs from 'graceful-fs';
import Reflux from 'reflux';
import _ from 'lodash';
import each from './each';
import * as utils from './utils';
import knownGalaxies from './static/galaxies.json';
import knownProducts from './static/knownProducts.json';

var state = Reflux.createStore({
  init(){
    // Temporary until all 256 galaxy names are known
    let galaxies = knownGalaxies.concat(knownGalaxies).concat(knownGalaxies).concat(knownGalaxies).concat(knownGalaxies).concat([knownGalaxies[0]]);
    let galaxyIter = 1;
    each(galaxies, (g, k)=>{
      ++galaxyIter;
      if (galaxyIter > knownGalaxies.length) {
        galaxies[k] = `Galaxy ${galaxyIter}`;
      }
    });
    this.knownProducts = knownProducts;
    this.galaxies = galaxies;
    this.state = {
      // Core
      version: '0.11.0',
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
      mode: 'normal',
      storedBases: [],
      storedLocations: [],
      remoteLocations: [],
      remoteLength: 0,
      currentLocation: null,
      selectedLocation: null,
      username: '',
      profile: null,
      favorites: [],
      mods: [],
      selectedImage: null,
      autoCapture: false,
      selectedGalaxy: 0,
      galaxyOptions: [],
      pollRate: 60000,
      // UI
      settingsOpen: false,
      editorOpen: false,
      baseOpen: false,
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
      page: 1,
      pageSize: 60,
      paginationEnabled: true,
      loading: false,
      maximized: false,
      mapLines: false,
      map3d: false,
      mapDrawDistance: false,
      wallpaper: null,
      filterOthers: false,
      useGAFormat: false,
      usernameOverride: false,
      remoteLocationsColumns: 1,
      sortStoredByTime: false,
      show: {
        Shared: true,
        Explored: true,
        Center: true,
        Favorite: true,
        Current: true,
        Selected: true,
        Base: true
      },
      maintenanceTS: Date.now()
    };
    this.handleJsonWorker();
    window.jsonWorker.postMessage({
      method: 'new',
      configDir: this.state.configDir,
    });
    let maintenanceTS = utils.store.get('maintenanceTS');
    if (maintenanceTS) {
      this.state.storedBases = maintenanceTS;
    } else {
      this.state.maintenanceTS = this.state.maintenanceTS - 6.048e+8; // Set initial run
    }
    let wallpaper = utils.store.get('wallpaper');
    if (wallpaper) {
      this.state.wallpaper = wallpaper;
    }
    let basePath = this.state.configDir.split('\\AppData')[0];
    let installDirectory = utils.store.get('installDirectory');
    if (installDirectory) {
      this.state.installDirectory = installDirectory;
    }
    let saveDirectory = utils.store.get('saveDirectory');
    if (saveDirectory) {
      this.state.saveDirectory = saveDirectory;
    } else {
      let saveDirPath;
      let steamPath = `${basePath}\\AppData\\Roaming\\HelloGames\\NMS`;
      let gogPath = `${basePath}\\AppData\\Roaming\\HelloGames\\NMS\\DefaultUser`;
      if (fs.existsSync(steamPath)) {
        saveDirPath = steamPath;
      } else if (fs.existsSync(gogPath)) {
        saveDirPath = gogPath;
      }
      this.state.saveDirectory = saveDirPath;
    }
    let username = utils.store.get('username');
    if (username) {
      this.state.username = username;
    }
    let mapLines = utils.store.get('mapLines');
    if (mapLines) {
      this.state.mapLines = mapLines;
    }
    let map3d = utils.store.get('map3d');
    if (map3d) {
      this.state.map3d = map3d;
    }
    let mapDrawDistance = utils.store.get('mapDrawDistance');
    if (mapDrawDistance) {
      this.state.mapDrawDistance = mapDrawDistance;
    }
    let show = utils.store.get('show');
    if (show) {
      this.state.show = show;
    }
    let filterOthers = utils.store.get('filterOthers');
    if (filterOthers) {
      this.state.filterOthers = filterOthers;
    }
    let useGAFormat = utils.store.get('useGAFormat');
    if (useGAFormat) {
      this.state.useGAFormat = useGAFormat;
    }
    let remoteLocationsColumns = utils.store.get('remoteLocationsColumns');
    if (remoteLocationsColumns) {
      this.state.remoteLocationsColumns = remoteLocationsColumns;
    }
    let sortStoredByTime = utils.store.get('sortStoredByTime');
    if (sortStoredByTime) {
      this.state.sortStoredByTime = sortStoredByTime;
    }
    let pollRate = utils.store.get('pollRate');
    if (pollRate) {
      this.state.pollRate = pollRate;
    }
    let mode = utils.store.get('mode');
    if (mode) {
      this.state.mode = mode;
    }
    let storedBases = utils.store.get('storedBases');
    if (storedBases) {
      this.state.storedBases = storedBases;
    }
    let storedLocations = utils.store.get('storedLocations');
    // temporary
    if (_.isArray(storedLocations)) {
      storedLocations = {
        normal: storedLocations,
        creative: [],
        survival: [],
        permadeath: []
      }
      utils.store.set('storedLocations', storedLocations)
    }
    if (storedLocations) {
      this.state.storedLocations = storedLocations[this.state.mode];
    } else {
      utils.store.set('storedLocations', {
        normal: [],
        creative: [],
        survival: [],
        permadeath: []
      });
    }
    let favorites = utils.store.get('favorites');
    if (favorites) {
      this.state.favorites = favorites;
    } else {
      utils.store.set('favorites', []);
    }
    let autoCapture = utils.store.get('autoCapture');
    if (autoCapture !== null) {
      this.state.autoCapture = autoCapture;
    } else {
      utils.store.set('autoCapture', false);
    }
  },
  handleJsonWorker(){
    window.jsonWorker.onmessage = (e)=>{
      this.state.remoteLocations = JSON.parse(e.data).remoteLocations;

      if (!this.state.remoteLocations || this.state.remoteLocations && this.state.remoteLocations.results === undefined) {
        this.state.remoteLocations = {
          results: [],
          count: 0,
          next: null,
          prev: null
        };
      } else {
        this.state.page = Math.floor(this.state.remoteLocations.results.length / this.state.pageSize) + 1;
      }
      this.trigger(this.state);
    }
  },
  handleMaintenance(obj){
    return new Promise((resolve, reject)=>{
      if (this.state.maintenanceTS + 6.048e+8 < Date.now()) {
        // Maintenance task set to run once a week
        let locations = [];
        _.each(obj.remoteLocations.results, (location, i)=>{
          // Remove locations with invalid coordinates
          if (location.data.VoxelY > -128 && location.data.VoxelY < 127
            && location.data.VoxelZ > -2048 && location.data.VoxelZ < 2047
            && location.data.VoxelX > -2048 && location.data.VoxelX < 2047) {
            locations.push(location)
          }
        });
        obj.remoteLocations.results = locations;
        obj.remoteLocations.count = locations.length;

        _.defer(()=>{
          obj.maintenanceTS = Date.now();
          resolve(obj)
        });
      } else {
        resolve(obj);
      }
    });
  },
  set(obj, cb=null){
    if (process.env.NODE_ENV === 'development') {
      try {
        throw new Error('STATE STACK')
      } catch (e) {
        let stackParts = e.stack.split('\n');
        console.log('STATE CALLEE: ', stackParts[2].trim());
      }
    }
    obj = _.clone(obj);
    console.log('STATE INPUT: ', obj);
    if (obj.selectedLocation) {
      this.state.selectedLocation = null;
    }

    let objRemoteLen = 0;
    if (obj.remoteLocations) {
      objRemoteLen = obj.remoteLocations.results.length;
    }

    if (obj.remoteLocations
      && objRemoteLen > 0
      && this.state.search.length === 0
      && this.state.remoteLocations
      && this.state.remoteLocations.results
      && this.state.remoteLocations.results.length > 0) {
      this.handleMaintenance(obj).then((newObj)=>{
        window.jsonWorker.postMessage({
          method: 'set',
          key: 'remoteLocations',
          value: JSON.stringify(newObj.remoteLocations),
        });
        this.handleState(newObj, cb, objRemoteLen);
      });
    } else {
      this.handleState(obj, cb, objRemoteLen);
    }
  },
  handleState(obj, cb=null, objRemoteLen){
    if (obj.remoteLocations && obj.remoteLocations.results) {
      this.state.remoteLength = objRemoteLen;
    }

    _.assignIn(this.state, obj);
    console.log('STATE: ', this.state);
    if (obj.mode) {
      let storedLocations = utils.store.get('storedLocations');
      utils.store.set('mode', obj.mode);
      this.state.storedLocations = storedLocations[obj.mode];
    }
    this.trigger(this.state);
    if (obj.storedLocations) {
      let storedLocations = utils.store.get('storedLocations');
      console.log('STORED: ', storedLocations);
      storedLocations[this.state.mode] = obj.storedLocations;
      utils.store.set('storedLocations', storedLocations);
    }

    if (obj.hasOwnProperty('storedBases')) {
      utils.store.set('storedBases', obj.storedBases);
    }

    if (obj.hasOwnProperty('favorites')) {
      utils.store.set('favorites', obj.favorites);
    }

    if (obj.hasOwnProperty('autoCapture')) {
      utils.store.set('autoCapture', obj.autoCapture);
    }

    if (obj.hasOwnProperty('mapLines')) {
      utils.store.set('mapLines', obj.mapLines);
    }

    if (obj.hasOwnProperty('map3d')) {
      utils.store.set('map3d', obj.map3d);
    }

    if (obj.hasOwnProperty('mapDrawDistance')) {
      utils.store.set('mapDrawDistance', obj.mapDrawDistance);
    }

    if (obj.hasOwnProperty('show')) {
      utils.store.set('show', obj.show);
    }

    if (obj.hasOwnProperty('filterOthers')) {
      utils.store.set('filterOthers', obj.filterOthers);
    }

    if (obj.hasOwnProperty('useGAFormat')) {
      utils.store.set('useGAFormat', obj.useGAFormat);
    }

    if (obj.hasOwnProperty('remoteLocationsColumns')) {
      utils.store.set('remoteLocationsColumns', obj.remoteLocationsColumns);
    }

    if (obj.hasOwnProperty('sortStoredByTime')) {
      utils.store.set('sortStoredByTime', obj.sortStoredByTime);
    }

    if (obj.hasOwnProperty('pollRate')) {
      utils.store.set('pollRate', obj.pollRate);
    }

    if (obj.hasOwnProperty('installDirectory')) {
      utils.store.set('installDirectory', obj.installDirectory);
    }

    if (obj.hasOwnProperty('saveDirectory')) {
      utils.store.set('saveDirectory', obj.saveDirectory);
    }

    if (obj.hasOwnProperty('wallpaper')) {
      utils.store.set('wallpaper', obj.wallpaper);
    }

    if (obj.hasOwnProperty('username')) {
      utils.store.set('username', obj.username);
    }

    if (obj.hasOwnProperty('maintenanceTS')) {
      utils.store.set('maintenanceTS', obj.maintenanceTS);
    }

    if (cb) {
      _.defer(cb);
    }
  },
  get(){
    return this.state;
  }
});
window.state = state;
export default state;