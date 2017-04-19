import {remote} from 'electron';
import os from 'os';
import fs from 'fs';
import Reflux from 'reflux';
import _ from 'lodash';
import each from './each';
import * as utils from './utils';
import knownGalaxies from './static/galaxies.json';


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
    this.galaxies = galaxies;
    this.state = {
      // Core
      version: '0.7.1',
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
    let mode = utils.store.get('mode');
    if (mode) {
      this.state.mode = mode;
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

    if (obj.remoteLocations && obj.remoteLocations.results.length > 0 && this.state.search.length === 0 && this.state.remoteLocations.results && this.state.remoteLocations.results.length > 0) {
      //this.state.remoteLocations = this.json.get('remoteLocations');
      let hasState = false;
      if (this.state.remoteLocations) {
        hasState = true;
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
      let sort = 'created';
      if (this.state.sort === '-teleports') {
        sort = 'teleports';
      } else if (this.state.sort === '-score') {
        sort = 'score';
      }
      if (hasState) {
        obj.remoteLocations.results = _.chain(this.state.remoteLocations.results).orderBy(sort, 'desc').value();
      }
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
      utils.store.set('filterOthers', obj.mapZoom);
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