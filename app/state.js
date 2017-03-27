import Reflux from 'reflux';
import _ from 'lodash';
import os from 'os';
import {store} from './utils';

var state = Reflux.createStore({
  init(){
    this.state = {
      // Core
      version: '0.0.2',
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
      // UI
      settingsOpen: false,
      view: 'index',
      search: '',
      lastSearch: '',
      searchQuery: [],
      page: 1,
      pageSize: 20,
      loading: false
    };
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
    this.index = 0;
    this.history = [];
  },
  set(obj, cb=null){
    console.log('STATE INPUT: ', obj);
    _.assignIn(this.state, _.cloneDeep(obj));
    console.log('STATE: ', this.state);
    if (obj.mode) {
      let storedLocations = store.get('storedLocations');
      store.set('mode', obj.mode);
      this.state.storedLocations = storedLocations[obj.mode];
    }
    this.trigger(this.state);
    if (obj.storedLocations) {
      let storedLocations = store.get('storedLocations');
      storedLocations[this.state.mode] = obj.storedLocations;
      store.set('storedLocations', storedLocations);
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