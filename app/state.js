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
      version: '0.8.0',
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
      remoteLocationsCache: null,
      // UI
      settingsOpen: false,
      editorOpen: false,
      baseOpen: false,
      view: 'index',
      sort: '-created',
      search: '',
      searchInProgress: false,
      page: 1,
      pageSize: 60,
      paginationEnabled: true,
      loading: false,
      maximized: false,
      mapLines: false,
      mapZoom: false,
      wallpaper: null,
      filterOthers: false,
      usernameOverride: false,
      sortStoredByTime: false,
      show: {
        Shared: true,
        Explored: true,
        Center: true,
        Favorite: true,
        Current: true,
        Selected: true,
        Base: true
      }
    };
    this.handleJsonWorker();
    window.jsonWorker.postMessage({
      method: 'new',
      configDir: this.state.configDir,
    });
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
    let mapZoom = utils.store.get('mapZoom');
    if (mapZoom) {
      this.state.mapZoom = mapZoom;
    }
    let show = utils.store.get('show');
    if (show) {
      this.state.show = show;
    }
    let filterOthers = utils.store.get('filterOthers');
    if (filterOthers) {
      this.state.filterOthers = filterOthers;
    }
    let sortStoredByTime = utils.store.get('sortStoredByTime');
    if (sortStoredByTime) {
      this.state.sortStoredByTime = sortStoredByTime;
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
      console.log('JSON WORKER: ', e.data)
      if (e.data.hasOwnProperty('remoteLocations')) {
        this.state.remoteLocations = e.data.remoteLocations;
      } else {
        this.state.remoteLocations = e.data;
      }
      if (this.state.remoteLocations.results === undefined) {
        this.state.remoteLocations.results = [];
        this.state.page = 1;
      } else {
        this.state.page = _.round(this.state.remoteLocations.results.length / this.state.pageSize);
      }
      this.trigger(this.state);
    }
  },
  set(obj, cb=null, sync=false){
    obj = _.clone(obj);
    console.log('STATE INPUT: ', obj);
    if (obj.selectedLocation) {
      this.state.selectedLocation = null;
    }

    if (obj.remoteLocations
      && obj.remoteLocations.results.length > 0
      && this.state.search.length === 0
      && this.state.remoteLocations.results
      && this.state.remoteLocations.results.length > 0) {
      if (this.state.remoteLocations) {
        each(obj.remoteLocations.results, (location, i)=>{
          let refNewLocation = _.findIndex(this.state.remoteLocations.results, {id: location.id});
          if (refNewLocation !== -1) {
            this.state.remoteLocations.results[refNewLocation] = obj.remoteLocations.results[i];
          } else {
            this.state.remoteLocations.results.push(location);
          }
        });
      } else {
        this.state.remoteLocations = obj.remoteLocations;
      }
      window.jsonWorker.postMessage({
        method: 'set',
        key: 'remoteLocations',
        value: this.state.remoteLocations,
      });
    }
    if (obj.remoteLocations) {
      this.state.remoteLength = obj.remoteLocations.results.length;
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

    if (obj.hasOwnProperty('mapZoom')) {
      utils.store.set('mapZoom', obj.mapZoom);
    }

    if (obj.hasOwnProperty('show')) {
      utils.store.set('show', obj.show);
    }

    if (obj.hasOwnProperty('filterOthers')) {
      utils.store.set('filterOthers', obj.filterOthers);
    }

    if (obj.hasOwnProperty('sortStoredByTime')) {
      utils.store.set('sortStoredByTime', obj.sortStoredByTime);
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

    if (cb) {
      _.defer(()=>cb());
    }
  },
  get(){
    return this.state;
  }
});
window.state = state;
export default state;