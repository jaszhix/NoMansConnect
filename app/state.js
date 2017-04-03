import Reflux from 'reflux';
import _ from 'lodash';
import os from 'os';
import {store} from './utils';

var state = Reflux.createStore({
  init(){
    this.state = {
      // Core
      version: '0.3.0',
      init: true,
      homedir: os.homedir(),
      width: window.innerWidth,
      height: window.innerHeight,
      tableData: [],
      title: 'NO MAN\'S CONNECT',
      mode: 'normal',
      storedLocations: [],
      remoteLocations: [],
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
      maximized: false
    };
    if (!store.get('migrated')) {
      store.set('migrated', false)
    }
    store.get('mode', (data)=>{
      if (data) {
        this.state.mode = data;
      }
    });
    store.get('storedLocations', (data)=>{
      if (data) {
        this.state.storedLocations = data[this.state.mode];
      } else {
        store.set('storedLocations', {
          normal: [],
          creative: [],
          survival: [],
          permadeath: []
        });
      }
    });

    store.get('favorites', (data)=>{
      if (data) {
        this.state.favorites = data;
      } else {
        store.set('favorites', []);
      }
    });

    store.get('autoCapture', (data)=>{
      if (data !== null) {
        this.state.autoCapture = data;
      } else {
        store.set('autoCapture', false);
      }
    });
  },
  set(obj, cb=null){
    console.log('STATE INPUT: ', obj);
    _.assignIn(this.state, _.cloneDeep(obj));
    console.log('STATE: ', this.state);
    if (obj.mode) {
      store.get('storedLocations', (data)=>{
        store.set('mode', obj.mode);
        this.state.storedLocations = data[obj.mode];
      });
    }
    this.trigger(this.state);
    if (obj.storedLocations) {
      store.get('storedLocations', (data)=>{
        data[this.state.mode] = obj.storedLocations;
        store.set('storedLocations', data);
      });
    }

    if (obj.favorites) {
      store.set('favorites', obj.favorites);
    }

    if (obj.autoCapture) {
      store.set('autoCapture', obj.autoCapture);
    }

    if (cb) {
      _.defer(()=>cb());
    }
  },
  get(){
    return this.state;
  }
});

//window.state = state;
export default state;