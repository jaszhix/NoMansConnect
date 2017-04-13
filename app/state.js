import {remote} from 'electron';
import {machineId} from 'electron-machine-id';
import os from 'os';
import Reflux from 'reflux';
import _ from 'lodash';
import * as utils from './utils';
import Json from './json';

var state = Reflux.createStore({
  init(){
    this.state = {
      // Core
      version: '0.6.0',
      machineId: null,
      protected: false,
      init: true,
      homedir: os.homedir(),
      configDir: remote.app.getPath('userData'),
      width: window.innerWidth,
      height: window.innerHeight,
      tableData: [],
      title: 'NO MAN\'S CONNECT',
      installDirectory: null,
      saveDirectory: null,
      saveFileName: '',
      triggerSaveDirFileDialogue: false,
      triggerInstallDirFileDialogue: false,
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
      transparent: false,
      wallpaper: null,
      filterOthers: false
    };
    machineId().then((id) => {
      this.state.machineId = id;
      this.json = new Json(this.state.configDir, (res)=>{
        if (res.remoteLocations) {
          this.state.remoteLocations = res.remoteLocations;
          this.state.page = _.round(this.state.remoteLocations.results.length / this.state.pageSize);
        }

        let wallpaper = utils.store.get('wallpaper');
        if (wallpaper) {
          this.state.wallpaper = wallpaper;
        }
        let installDirectory = utils.store.get('installDirectory');
        if (installDirectory) {
          this.state.installDirectory = installDirectory;
        }
        let saveDirectory = utils.store.get('saveDirectory');
        if (saveDirectory) {
          this.state.saveDirectory = saveDirectory;
        }
        let mapLines = utils.store.get('mapLines');
        if (mapLines) {
          this.state.mapLines = mapLines;
        }
        let mapZoom = utils.store.get('mapZoom');
        if (mapZoom) {
          this.state.mapZoom = mapZoom;
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
      });
    });
  },
  set(obj, cb=null, sync=false){
    obj = _.cloneDeep(obj);
    console.log('STATE INPUT: ', obj);
    if (obj.selectedLocation) {
      this.state.selectedLocation = null;
    }

    if (obj.remoteLocations && obj.remoteLocations.results.length > 0 && this.state.search.length === 0) {
      this.state.remoteLocations = this.json.get('remoteLocations');
      let hasState = false;
      if (this.state.remoteLocations) {
        hasState = true;
        utils.each(obj.remoteLocations.results, (location, i)=>{
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
      this.json.set('remoteLocations', this.state.remoteLocations);
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