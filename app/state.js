import {remote} from 'electron';
import os from 'os';
import Reflux from 'reflux';
import _ from 'lodash';
import {store} from './utils';

var state = Reflux.createStore({
  init(){
    this.state = {
      // Core
      version: '0.5.2',
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
      currentLocation: null,
      selectedLocation: null,
      username: '',
      favorites: [],
      mods: [],
      selectedImage: null,
      autoCapture: false,
      selectedGalaxy: 0,
      galaxyOptions: [],
      remoteLocationsCache: null,
      // UI
      settingsOpen: false,
      view: 'index',
      sort: '-created',
      search: '',
      searchInProgress: false,
      page: 1,
      pageSize: 20,
      loading: false,
      maximized: false,
      mapLines: false,
      mapZoom: false,
      transparent: false
    };
    let installDirectory = store.get('installDirectory');
    if (installDirectory) {
      this.state.installDirectory = installDirectory;
    }
    let saveDirectory = store.get('saveDirectory');
    if (saveDirectory) {
      this.state.saveDirectory = saveDirectory;
    }
    let mapLines = store.get('mapLines');
    if (mapLines) {
      this.state.mapLines = mapLines;
    }
    let mapZoom = store.get('mapZoom');
    if (mapZoom) {
      this.state.mapZoom = mapZoom;
    }
    let mode = store.get('mode');
    if (mode) {
      this.state.mode = mode;
    }
    let storedLocations = store.get('storedLocations');
    // temporary
    if (_.isArray(storedLocations)) {
      storedLocations = {
        normal: storedLocations,
        creative: [],
        survival: [],
        permadeath: []
      }
      store.set('storedLocations', storedLocations)
    }
    if (storedLocations) {
      this.state.storedLocations = storedLocations[this.state.mode];
    } else {
      store.set('storedLocations', {
        normal: [],
        creative: [],
        survival: [],
        permadeath: []
      });
    }
    let favorites = store.get('favorites');
    if (favorites) {
      this.state.favorites = favorites;
    } else {
      store.set('favorites', []);
    }
    let autoCapture = store.get('autoCapture');
    if (autoCapture !== null) {
      this.state.autoCapture = autoCapture;
    } else {
      store.set('autoCapture', false);
    }
    this.index = 0;
    this.history = [];
  },
  set(obj, cb=null){
    obj = _.cloneDeep(obj);
    console.log('STATE INPUT: ', obj);
    if (obj.selectedLocation) {
      this.state.selectedLocation = null;
    }
    _.assignIn(this.state, obj);
    console.log('STATE: ', this.state);
    if (obj.mode) {
      let storedLocations = store.get('storedLocations');
      store.set('mode', obj.mode);
      this.state.storedLocations = storedLocations[obj.mode];
    }
    this.trigger(this.state);
    if (obj.storedLocations) {
      _.each(_.cloneDeep(obj.storedLocations), (location, key)=>{
        if (location.image && location.image.length > 0) {
          delete obj.storedLocations[key].image;
        }
      });
      let storedLocations = store.get('storedLocations');
      console.log('STORED: ', storedLocations);
      storedLocations[this.state.mode] = obj.storedLocations;
      store.set('storedLocations', storedLocations);
    }

    if (obj.favorites) {
      store.set('favorites', obj.favorites);
    }

    if (obj.autoCapture) {
      store.set('autoCapture', obj.autoCapture);
    }

    if (obj.mapLines) {
      store.set('mapLines', obj.mapLines);
    }

    if (obj.mapZoom) {
      store.set('mapZoom', obj.mapZoom);
    }

    if (obj.installDirectory) {
      store.set('installDirectory', obj.installDirectory);
    }

    if (obj.saveDirectory) {
      store.set('saveDirectory', obj.saveDirectory);
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