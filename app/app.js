import {remote} from 'electron';
const win = remote.getCurrentWindow();
import fs from 'graceful-fs';
import log from './log';
import watch from 'watch';
import {machineId} from 'node-machine-id';
import state from './state';
import React from 'react';
import ReactTooltip from 'react-tooltip';
import {assignIn, cloneDeep, orderBy, uniqBy, defer, concat, first, isArray, pullAt, throttle, pick, last} from 'lodash';
import math from 'mathjs';

import Loader from './loader';
import * as utils from './utils';
import pollSaveData from './poll';
import {handleWallpaper, handleUpgrade, baseError} from './dialog';
import {each, find, findIndex, map, filter, tryFn} from './lang';

import baseIcon from './assets/images/base_icon.png';

import {DropdownMenu, SaveEditorDropdownMenu, BaseDropdownMenu, NotificationDropdown} from './dropdowns';
import {ImageModal, UsernameOverrideModal, LocationRegistrationModal, RecoveryModal, Notification, ProfileModal, FriendRequestModal, BaseRestorationModal} from './modals';
import Search from './search';
import Container from './container';

const {dialog} = remote;

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = state.get();
    state
      .setMergeKeys(['remoteLocations'])
      .connect('*', (obj) => {
      if (process.env.NODE_ENV === 'development') {
        tryFn(() => {
          throw new Error('STATE STACK');
        }, (e) => {
          let stackParts = e.stack.split('\n');
          console.log('STATE CALLEE: ', stackParts[6].trim());
        });
      }
      console.log('STATE INPUT: ', obj);

      if (obj.error) {
        state.displayErrorDialog(obj.error);
        state.error = '';
      }

      if (!obj.search
        && obj.remoteLocations
        && obj.remoteLength > 0
        && state.search.length === 0
        && state.remoteLocations
        && state.remoteLocations.results
        && state.remoteLocations.results.length > 0
        && !state.closing) {
        state.handleMaintenance(obj, (nextObject) => {
          window.jsonWorker.postMessage({
            method: 'set',
            key: 'remoteLocations',
            value: nextObject.remoteLocations,
          });
          this.setState(nextObject, () => state.handleState(obj));
        });
        return;
      }
      this.setState(obj, () => {
        state.handleState(obj);
      });
      console.log(`STATE: `, this.state);
    });
    state.connect({
      fetchRemoteLocations: () => this.fetchRemoteLocations(1),
      pollSaveData: () => this.pollSaveData(),
      restoreBase: (restoreBase, selected) => this.handleRestoreBase(restoreBase, selected),
      setWaypoint: (location) => this.setWaypoint(location),
      getMonitor: () => this.monitor,
      handleClearSearch: () => this.handleClearSearch()
    });

    this.topAttachedMenuStyle = {
      position: 'absolute',
      maxHeight: '42px',
      zIndex: '99',
      WebkitUserSelect: 'none',
      WebkitAppRegion: 'drag'
    };
    this.titleStyle = {
      position: 'absolute',
      left: '16px',
      top: '5px',
      margin: 'initial',
      WebkitTransition: 'left 0.1s',
      textTransform: 'uppercase'
    };
    this.titleBarControlsStyle = {
      WebkitAppRegion: 'no-drag',
      paddingRight: '0px'
    };
    this.noDragStyle = {
      WebkitAppRegion: 'no-drag'
    };
    this.headerItemClasses = 'ui dropdown icon item';
  }
  componentDidMount() {
    window.addEventListener('resize', this.onWindowResize);
    log.init(this.state.configDir);
    log.error(`Initializing No Man's Connect ${this.state.version}`);
    if (this.state.offline) {
      log.error(`Offline mode enabled.`);
    }
    this.handleWorkers();

    // TBD: Work around electron starting in the home directory on Linux
    let modulePath = remote.app.getPath('module').split(utils.dirSep);
    modulePath.pop();
    modulePath = modulePath.join(utils.dirSep);
    window.modulePath = modulePath;

    if (process.env.NODE_ENV === 'production') {
      this.saveJSON = `${remote.app.getPath('userData')}${utils.dirSep}saveCache.json`;
      this.saveTool = `${modulePath}${utils.dirSep}nmssavetool${utils.dirSep}nmssavetool.exe`;
    } else {
      this.saveJSON = `.${utils.dirSep}app${utils.dirSep}nmssavetool${utils.dirSep}saveCache.json`;
      this.saveTool = `.${utils.dirSep}app${utils.dirSep}nmssavetool${utils.dirSep}nmssavetool.exe`;
    }

    if (!this.state.offline) {
      window.ajaxWorker.postMessage({
        method: 'get',
        func: 'version',
        url: '/nmslocation',
        obj: {
          params: {
            version: true
          }
        }
      });
    }
    let initialized = false;
    let initialize = () => {
      if (initialized) {
        return;
      }
      initialized = true;
      machineId().then((id) => {
        this.pollSaveData(this.state.mode, true, id);
      }).catch((err) => {
        log.error(err.message);
        this.pollSaveData(this.state.mode, true, null);
      });
    };

    let indexMods = () => {
      let letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'X', 'Z'];
      let indexModsInUse = (_path, modPath) => {
        fs.readFile(`${_path}\\Binaries\\SETTINGS\\TKGRAPHICSSETTINGS.MXML`, (err, data) => {
          let fullscreen = null;
          if (data) {
            fullscreen = data.toString().split('<Property name="FullScreen" value="')[1].substr(0, 4);
          }
          if (fullscreen === 'true' || err) {
            state.set({autoCapture: false, loading: 'Checking for mods...'});
          }
          if (!fs.existsSync(`${_path}${modPath}`)) {
            initialize();
            return;
          }
          fs.readdir(`${_path}${modPath}`, (err, list) => {
            if (err) {
              log.error(`Failed to read mods directory: ${err}`);
              return;
            }
            list = filter(list, (item) => {
              return item.toLowerCase().indexOf('.pak') !== -1;
            });
            state.set({mods: list}, () => {
              initialize();
            }, true);
          });
        });
      };

      let paths = [
        `/Program Files (x86)/GalaxyClient/Games/No Man's Sky`,
        `/Program Files (x86)/Steam/steamapps/common/No Man's Sky`,
        `/Steam/steamapps/common/No Man's Sky`,
        `/steamapps/common/No Man's Sky`,
        `/Program Files/No Man's Sky`,
        `/GOG Games/No Man's Sky`,
        `/Games/No Man's Sky`,
      ];

      if (this.state.installDirectory) {
        paths = [this.state.installDirectory.split(':\\')[1]];
      }

      let modPath = `\\GAMEDATA\\PCBANKS\\MODS`;

      let hasPath = false;
      each(letters, (drive, key) => {
        each(paths, (_path) => {
          let __path = `${drive}:${_path}`;
          if (fs.existsSync(__path)) {
            hasPath = true;
            indexModsInUse(__path, modPath);
            return;
          }
        });
      });
      if (!hasPath) {
        log.error('Failed to locate NMS install: path doesn\'t exist.')
        initialize();
      }
    };
    defer(indexMods);
  }
  componentWillUnmount() {
    if (this.monitor) {
      this.monitor.stop();
    }
  }
  handleWorkers = () => {
    window.ajaxWorker.onmessage = (e) => {
      if (this.state.closing) {
        return;
      }
      if (e.data.err) {
        if (!this.state.offline) {
          log.error(`AJAX Worker failure: ${e.data.func}`);
        }
        if (e.data.func === 'handleSync') {
          this.fetchRemoteLocations(state.page, state.sort, state.init, false);
        } else if (e.data.func === 'pollRemoteLocations') {
          this.timeout = setTimeout(() => this.pollRemoteLocations(), this.state.pollRate);
        } else if (e.data.func === 'fetchRemoteLocations' && e.data.status === 404) {
          state.remoteLocations.next = null;
          state.set({
            remoteLocations: state.remoteLocations,
            navLoad: false
          });
        }
        return;
      }
      console.log('AJAX WORKER: ', e.data);
      if (e.data.func === 'version') {
        if (e.data.data.version !== this.state.version) {
          handleUpgrade(e.data.data.version);
        }
        if (e.data.data.news && e.data.data.id !== this.state.newsId) {
          state.set({
            notification: {
              message: e.data.data.news,
              type: 'info'
            },
            newsId: e.data.data.id
          });
        }
      } else if (e.data.func === 'syncRemoteOwned') {
        each(e.data.results, (location, i) => {
          assignIn(location.data, {
            name: location.name,
            description: location.description,
            teleports: location.teleports,
            score: location.score,
            image: location.image
          });
          e.data.data.results[i] = location;
        });
        this.state.storedLocations = uniqBy(concat(this.state.storedLocations, map(e.data.data.results, res => res.data)), 'id');
        state.set({
          storedLocations: this.state.storedLocations,
          loading: 'Syncing locations...'
        }, () => {
          this.formatRemoteLocations(e.data, state.page, state.sort, state.init, false);
        });
      } else if (e.data.func === 'handleSync') {
        if (!e.data.params) {
          e.data.params = [state.page, state.sort, state.init, false];
        }
        this.fetchRemoteLocations(...e.data.params);
      } else if (e.data.func === 'fetchRemoteLocations') {
        this.formatRemoteLocations(e.data, ...e.data.params, () => {
          if (state.init) {
            state.set({init: false}, true);
            this.pollRemoteLocations(e.data.params[2]);
          }
        });
      } else if (e.data.func === 'pollRemoteLocations') {
        if (e.data.data.results.length > 0 && this.state.search.length === 0) {
          this.formatRemoteLocations(e.data, ...e.data.params, () => {
            this.timeout = setTimeout(()=>this.pollRemoteLocations(), this.state.pollRate);
          });
        } else {
          this.timeout = setTimeout(()=>this.pollRemoteLocations(), this.state.pollRate);
        }
      }
    }
    window.formatWorker.onmessage = (e) => {
      console.log('FORMAT WORKER: ', e.data);
      if (e.data.stateUpdate.pagination) {
        this.handlePagination();
      } else if (state.init) {
        this.handleSync(1, state.sort, state.init);
      }
      state.set(e.data.stateUpdate);
    };
  }
  syncRemoteOwned = () => {
    if (this.state.offline || this.state.closing) {
      return;
    }
    window.ajaxWorker.postMessage({
      method: 'get',
      func: 'syncRemoteOwned',
      url: '/nmslocationsync',
      obj: {
        params: {
          username: this.state.username,
          page_size: 9999
        }
      }
    });
  }
  handleSync = (page=1, sort=this.state.sort, init=false) => {
    if (this.state.offline || this.state.closing) {
      return;
    }

    if (!state.remoteLocations || !state.remoteLength === 0) {
      return;
    }
    let locations = [];
    each(state.storedLocations, (location) => {
      let existsInRemoteLocations = false;
      each(state.remoteLocations.results, (remoteLocation) => {
        if (remoteLocation.data.id === location.id) {
          existsInRemoteLocations = true;
          return false;
        };
      });
      if (!existsInRemoteLocations && location.username === this.state.username) {
        location.timeStamp = new Date(location.timeStamp);
        locations.push(location);
      }
    });
    utils.ajax.post('/nmslocationremotecheck/', {
        locations: map(locations, (location) => location.id),
        mode: state.mode,
        username: state.username,
    }).then((missing) => {
      missing = missing.data;
      let missingLocations = [];
      each(missing, (id) => {
        let location = find(locations, (location) => location.id === id);
        if (location) {
          missingLocations.push(location);
        }
      });
      window.ajaxWorker.postMessage({
        method: 'post',
        func: 'handleSync',
        url: '/nmslocationremotesync/',
        obj: {
          locations: missingLocations,
          mode: state.mode,
          username: state.username,
        },
        params: [page, sort, init, true, false]
      });
    }).catch((err) => log.error(err.message));
  }
  formatRemoteLocations = (res, page=1, sort, init, partial, pagination, cb=null) => {
    if (this.state.offline || this.state.closing) {
      return;
    }
    if (!this.state.remoteLocations || this.state.remoteLocations.length === 0) {
      this.state.remoteLocations = {
        results: []
      };
    }

    window.formatWorker.postMessage({
      res,
      page,
      sort,
      init,
      partial,
      pagination,
      state: {
        remoteLocations: this.state.remoteLocations,
        remoteLength: this.state.remoteLength,
        search: this.state.search,
        favorites: this.state.favorites,
        storedLocations: this.state.storedLocations,
        pageSize: this.state.pageSize,
        loading: 'Loading remote locations...'
      }
    });

    if (cb) {
      defer(cb);
    }
  }
  pollRemoteLocations = (init=false) => {
    if (this.timeout)  {
      clearTimeout(this.timeout);
    }

    if (this.state.offline || this.state.closing) {
      return;
    }

    if (this.state.sort !== '-created' || (this.state.remoteLocations.results && this.state.remoteLocations.results.length === 0) || init) {
      this.timeout = setTimeout(()=>this.pollRemoteLocations(), this.state.pollRate);
      return;
    }

    let lastRemoteLocation = first(orderBy(this.state.remoteLocations.results, 'created', 'desc'));

    let start = new Date(lastRemoteLocation.created);
    let end = new Date();

    window.ajaxWorker.postMessage({
      method: 'get',
      func: 'pollRemoteLocations',
      url: '/nmslocationpoll',
      obj: {
        params: {
          start: start,
          end: end,
          id: lastRemoteLocation.data.id
        }
      },
      params: [state.page ? state.page : 1, state.sort, false, true, state.pagination]
    });
  }
  fetchRemoteLocations = (page = this.state.page, sort = this.state.sort, init = false, pagination = false) => {
    if (this.state.offline || this.state.closing) {
      return;
    }
    if (!state.navLoad) {
      state.set({navLoad: true});
    }
    let q = state.search.length > 0 ? state.search : null;
    let path = q ? '/nmslocationsearch' : '/nmslocation';
    sort = sort === 'search' ? '-created' : sort;

    let params = {
      page: page ? page : 1,
      sort: sort,
      q: q
    };

    if (q) {
      params.page_size = q.substr(0, 5) === 'user:' ? 2000 : 200;
    }

    window.ajaxWorker.postMessage({
      method: 'get',
      func: 'fetchRemoteLocations',
      url: path,
      obj: {
        params
      },
      params: [page, sort, init, false, pagination]
    });
  }
  handleCheat = (id, n) => {
    let currentLocation = find(this.state.storedLocations, location => location.id === this.state.currentLocation);
    if (currentLocation) {
      this.handleTeleport(currentLocation, 0, id, n);
    }
  }
  handleSaveBase = (baseData=null) => {
    const {storedBases} = this.state;
    if (baseData) {
      storedBases.push(cloneDeep(baseData));
      state.set({storedBases});
      return;
    }
    utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      each(saveData.result.PlayerStateData.PersistentPlayerBases, (base, i) => {
        if (!base.GalacticAddress || !base.Name) {
          return;
        }
        base = utils.formatBase(saveData, state.knownProducts, i);
        let refBase = findIndex(storedBases, _base => _base.Name === base.Name);
        if (refBase === -1 && isArray(storedBases)) {
          storedBases.push(base);
        } else {
          storedBases[refBase] = base;
        }
        state.set({storedBases});
      });
    }).catch(baseError);
  }
  signSaveData = (slot) => {
    let absoluteSaveDir = this.state.saveFileName.split(utils.dirSep);
    pullAt(absoluteSaveDir, absoluteSaveDir.length - 1);
    absoluteSaveDir = absoluteSaveDir.join(utils.dirSep);
    let command = `${process.platform !== 'win32' ? 'wine ' : ''}${this.saveTool} encrypt -g ${slot} -f ${this.saveJSON} --save-dir "${absoluteSaveDir}"`;
    console.log(command);
    utils.exc(command, (res) => {
      console.log(res);
      console.log('sucess');
    }).catch((e) => {
      if (process.platform !== 'win32') {
        log.error('Unable to re-encrypt the metadata file with nmssavetool.exe. Do you have Wine with the Mono runtime installed?')
      }
      log.error(e.message);
    });
  }
  handleRestoreBase = (base, confirmed = false) => {
    console.log({base, confirmed})
    utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      const {PersistentPlayerBases} = saveData.result.PlayerStateData
      if (confirmed === false) {
        state.set({
          displayBaseRestoration: {
            savedBases: PersistentPlayerBases,
            restoreBase: base
          }
        });
        return;
      }
      if (PersistentPlayerBases.length === 0) {
        baseError();
        return;
      }
      if (!confirmed || typeof confirmed !== 'object') {
        log.error('Base restoration cancelled - unable to get index of base to be replaced.');
        return;
      }
      let refIndex = findIndex(PersistentPlayerBases, (base) => base.Name === confirmed.Name);
      let newBase = PersistentPlayerBases[refIndex];

      let storedBase = cloneDeep(base);

      // Base conversion algorithm by monkeyman192

      // 3-vector
      let fwdOriginal = storedBase.Forward;
      // 3-vector
      let upOriginal;
      if (storedBase.Objects.length > 0) {
        upOriginal = last(storedBase.Objects).Up;
      } else {
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Base Restore',
          message: 'In order to restore your base correctly, at least one base building object must be placed on the new base first.'
        });
        return;
      }
      // cross is defined in the math.js library.
      let perpOriginal = math.cross(fwdOriginal, upOriginal);

      // This creates  3rd vector orthogonal to the previous 2 to create a set of linearly independent basis vectors
      // this is a matrix made up from the other 3 vectors as columns
      let P = math.matrix([[fwdOriginal[0], upOriginal[0], perpOriginal[0]],
        [fwdOriginal[1], upOriginal[1], perpOriginal[1]],
        [fwdOriginal[2], upOriginal[2], perpOriginal[2]]]);

      // now read the new data, ensuring the user has created at least one Object to read data from (need that Up value!)
      // 3-vector
      let fwdNew = newBase.Forward;
      // 3-vector
      let upNew;
      if (newBase.Objects.length > 0) {
        upNew = last(newBase.Objects).Up;
      } else {
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Base Restore',
          message: 'In order to restore your base correctly, at least one base building object must be placed on the old base first.'
        });
        return;
      }
      let perpNew = math.cross(fwdNew, upNew);

      // again, we construct a matrix from the column vectors:
      let Q = math.matrix([[fwdNew[0], upNew[0], perpNew[0]],
              [fwdNew[1], upNew[1], perpNew[1]],
              [fwdNew[2], upNew[2], perpNew[2]]]);

      // our final transform matrix is now equal to:
      let M = math.multiply(Q, math.inv(P))

      each(storedBase.Objects, (object, i) => {
        storedBase.Objects[i].At = math.multiply(M, object.At)._data
        storedBase.Objects[i].Up = upNew;
        storedBase.Objects[i].Position = math.multiply(M, object.Position)._data;
      });

      saveData.result.PlayerStateData.PersistentPlayerBases[refIndex].Objects = storedBase.Objects;

      fs.writeFile(this.saveJSON, JSON.stringify(saveData.result), {flag : 'w'}, (err, data) => {
        if (err) {
          log.error(`Failed to restore base: ${err.message}`);
          return;
        }
        this.signSaveData(saveData.slot);
        state.set({displayBaseRestoration: null});
      });
    }).catch((err) => {
      log.error(`Failed to restore base: ${err.message}`);
    });
  }
  handleTeleport = (location, i, action = null, n = null, position = null) => {
    const _location = cloneDeep(location);
    state.set({installing: `t${i}`, navLoad: true});
    utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {

      if (location.data) {
        location = location.data;
      }

      if (action && typeof action === 'object' && action.playerPosition) {
        assignIn(_location, action);
      }

      if (location.manuallyEntered) {
        assignIn(_location, {
          playerPosition: [
            233.02163696289063,
            6774.24560546875,
            115.99118041992188,
            1
          ],
          playerTransform: [
            0.35815203189849854,
            0.82056683301925659,
            0.44541805982589722,
            1
          ],
          shipPosition: [
            234.85250854492188,
            6777.2685546875,
            121.86365509033203,
            1
          ],
          shipTransform: [
            -0.48167002201080322,
            -0.84464621543884277,
            -0.23359590768814087,
            1
          ],
        });
        saveData.result.SpawnStateData.LastKnownPlayerState = 'InShip';
      }

      assignIn(saveData.result.SpawnStateData, {
        PlayerPositionInSystem: _location.playerPosition,
        PlayerTransformAt: _location.playerTransform,
        ShipPositionInSystem: _location.shipPosition,
        ShipTransformAt: _location.shipTransform
      });

      assignIn(saveData.result.PlayerStateData.UniverseAddress.GalacticAddress, {
        PlanetIndex: _location.PlanetIndex,
        SolarSystemIndex: _location.SolarSystemIndex,
        VoxelX: _location.VoxelX,
        VoxelY: _location.VoxelY,
        VoxelZ: _location.VoxelZ
      });

      if (typeof action === 'string') {
        saveData.result = utils[action](saveData, n);
      }

      saveData.result.PlayerStateData.UniverseAddress.RealityIndex = _location.galaxy;

      fs.writeFile(this.saveJSON, JSON.stringify(saveData.result), {flag : 'w'}, (err, data) => {
        if (err) {
          log.error('Error occurred while attempting to write save file cache:');
          log.error(err);
        }
        this.signSaveData(saveData.slot);
        let refStoredLocation = findIndex(this.state.storedLocations, location => location.id === _location.id);
        if (refStoredLocation !== -1) {
          state.set({installing: false});
          return;
        }
        utils.ajax.post('/nmslocation/', {
          machineId: this.state.machineId,
          username: this.state.username,
          teleports: true,
          id: _location.id
        }).then((res) => {
          let refRemoteLocation = findIndex(this.state.remoteLocations.results, (remoteLocation) => {
            return remoteLocation.data.id === _location.id;
          });
          if (refRemoteLocation !== -1) {
            this.state.remoteLocations.results[refRemoteLocation] = res.data;
          }

          state.set({
            navLoad: false,
            installing: false,
            currentLocation: _location.id,
            remoteLocations: this.state.remoteLocations
          });
        }).catch((err) => {
          log.error(`Unable to send teleport stat to server: ${err}`);
          state.set({installing: false, navLoad: false});
        });
      });
    }).catch((err) => {
      log.error(err.message);
      log.error(`Unable to teleport to location: ${err}`);
    });
  }
  setWaypoint = (location) => {
    console.log('setWaypoint', location);
    state.set({navLoad: true});//.result.PlayerStateData.MarkerStack
    utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      let {PlanetIndex, SolarSystemIndex, VoxelX, VoxelY, VoxelZ} = location;
      let waypoint = {
        Address: {
          PlanetIndex,
          SolarSystemIndex,
          VoxelX,
          VoxelY,
          VoxelZ
        },
        EventId: '^',
        Type: {
          GalaxyWaypointType: 'User'
        }
      };
      let userWaypoint = findIndex(saveData.result.GameKnowledgeData.Waypoints, (wp) => {
        return wp.Type.GalaxyWaypointType === 'User';
      });
      if (userWaypoint > -1) {
        saveData.result.GameKnowledgeData.Waypoints[userWaypoint] = waypoint;
      } else {
        saveData.result.GameKnowledgeData.Waypoints.push(waypoint);
      }
      console.log('setWaypoint', saveData.result.GameKnowledgeData.Waypoints)

      fs.writeFile(this.saveJSON, JSON.stringify(saveData.result), {flag : 'w'}, (err, data) => {
        if (err) {
          log.error('Error occurred while attempting to write save file cache:');
          log.error(err);
        }
        this.signSaveData(saveData.slot);
        state.set({navLoad: false});
      });
    }).catch((err) => {
      log.error(err.message);
      log.error(`Unable to teleport to location: ${err}`);
    })
  }
  pollSaveData = (mode=this.state.mode, init=false, machineId=this.state.machineId) => {
    pollSaveData({mode, init, machineId, next: (error = false, ...args) => {
      if (error) {
        log.error(`getLastSave -> next -> ${error}`);
      }
      if (init) {
        handleWallpaper();
        if (!state.ps4User) {
          this.syncRemoteOwned();
          if (!this.monitor) {
            watch.createMonitor(state.saveDirectory, {
              ignoreDotFiles: true,
              ignoreNotPermitted: true,

            }, (monitor) => {
              this.monitor = monitor;
              this.pollSaveDataThrottled = throttle(this.pollSaveData, 15000, {leading: true});
              this.monitor.on('changed', (f, curr, prev) => {
                this.pollSaveDataThrottled();
              });
            });
          }
          if (state.username.toLowerCase() === 'explorer') {
            state.set({usernameOverride: true});
          }
        }
        return;
      }
      this.fetchRemoteLocations(1, state.sort, init);
    }});
  }
  handleRemoveStoredLocation = () => {
    if (this.state.selectedLocation.id === this.state.currentLocation) {
      log.error('Failed to remove stored location: cannot remove the player\'s current location.');
      return;
    }
    let refStoredLocation = findIndex(state.storedLocations, location => location.id === state.selectedLocation.id);
    let isOwnLocation = state.storedLocations[refStoredLocation].username === state.username;
    if (isOwnLocation) {
      state.storedLocations[refStoredLocation].isHidden = !state.storedLocations[refStoredLocation].isHidden;
      state.selectedLocation.isHidden = state.storedLocations[refStoredLocation].isHidden;
    } else {
      pullAt(state.storedLocations, refStoredLocation);
    }
    state.set({
      storedLocations: state.storedLocations,
      selectedLocation: state.selectedLocation.isHidden || !isOwnLocation ? null : state.selectedLocation
    });
  }
  stateChange = (e) => {
    this.setState(e);
  }
  onWindowResize = () => {
    state.set({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }
  handleSort = (e, sort) => {
    sort = typeof sort === 'string' ? sort : '-created';
    state.set({sort: sort, navLoad: true}, () => {
      this.fetchRemoteLocations(1, sort);
    });
  }
  handleSearch = () => {
    if (this.state.offline) {
      let searchCache = filter(this.state.remoteLocations.results, (location) => {
        return (location.data.id === this.state.search
          || location.data.translatedId === this.state.search
          || location.username === this.state.search
          || location.name.indexOf(this.state.search) > -1
          || location.description.indexOf(this.state.search) > -1)
      });
      state.set({
        searchInProgress: true,
        searchCache: {
          results: searchCache,
          count: searchCache.length,
          next: null,
          prev: null
        }
      });
    } else {
      this.fetchRemoteLocations(1);
    }
  }
  handleClearSearch = () => {
    if (!this.state.offline) {
      let diff = [];
      each(this.state.searchCache.results, (location) => {
        let refRemoteLocation = findIndex(this.state.remoteLocations.results, _location => _location.id === location.id);
        if (refRemoteLocation === -1) {
          diff.push(location);
        }
      });
      this.state.remoteLocations.results = concat(this.state.remoteLocations.results, uniqBy(diff, (location) => {
        return location.data.id;
      }));
    }

    state.set({
      search: '',
      searchCache: {
        results: [],
        count: 0,
        next: null,
        prev: null
      },
      remoteLocations: this.state.remoteLocations,
      searchInProgress: false,
      sort: '-created'
    });
  }
  handlePagination = () => {
    let page = state.page === 1 ? 2 : state.page + 1;
    state.set({page: page, navLoad: true}, () => {
      this.fetchRemoteLocations(state.page, state.sort, false, true);
    });
  }
  handleMaximize = () => {
    state.set({maximized: !this.state.maximized}, () => {
      if (this.state.maximized) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    });
  }
  handleMinimize = () => {
    win.minimize();
  }
  handleClose = () => {
    if (this.monitor) {
      this.monitor.stop();
    }
    state.set({closing: true});
    defer(() => {
      win.close();
    });
  }
  handleSearchIconClick = () => {
    if (this.state.searchInProgress) {
      this.handleClearSearch();
    } else {
      this.handleSearch();
    }
  }
  handleSetUsernameOverride = () => {
    state.set({usernameOverride: true});
  }
  handleLocationRegistrationToggle = () => {
    state.set({registerLocation: !this.state.registerLocation});
  }
  render() {
    var s = this.state;
    return (
      <div>
        <div className="ui top attached menu" style={this.topAttachedMenuStyle}>
          <h2 style={this.titleStyle}>{s.title}</h2>
          <div className="right menu">
            {!s.init && s.navLoad ? <Loader loading={null} /> : null}
            {!s.init && !s.offline ?
            <div
            style={this.noDragStyle}
            className={`${this.headerItemClasses}${s.sort === '-created' ? ' selected' : ''}${s.navLoad ? ' disabled' : ''}`}
            onClick={this.handleSort}>
              Recent
            </div> : null}
            {!s.init && !s.offline ?
            <div
            style={this.noDragStyle}
            className={`${this.headerItemClasses}${s.sort === '-teleports' ? ' selected' : ''}${s.navLoad ? ' disabled' : ''}`}
            onClick={(e)=>this.handleSort(e, '-teleports')}>
              Popular
            </div> : null}
            {!s.init  && !s.offline ?
            <div
            style={this.noDragStyle}
            className={`${this.headerItemClasses}${s.sort === '-score' ? ' selected' : ''}${s.navLoad ? ' disabled' : ''}`}
            onClick={(e)=>this.handleSort(e, '-score')}>
              Favorites
            </div> : null}
            {!s.init ?
            <Search
            onKeyDown={this.handleSearch}
            style={this.searchIconStyle}
            onClick={this.handleSearchIconClick}
            search={s.search}
            navLoad={s.navLoad} /> : null}
            {this.state.profile && this.state.profile.notifications && this.state.profile.notifications.length > 0 ?
            <NotificationDropdown
            machineId={this.state.profile.machine_id}
            username={this.state.username}
            options={this.state.profile.notifications}
            height={this.state.height} /> : null}
            {!s.ps4User ?
            <BaseDropdownMenu
            onSaveBase={this.handleSaveBase}
            onRestoreBase={this.handleRestoreBase}
            baseIcon={baseIcon}
            storedBases={this.state.storedBases}
            /> : null}
            {s.profile && !s.ps4User ?
            <SaveEditorDropdownMenu
            onSaveBase={this.handleSaveBase}
            onRestoreBase={this.handleRestoreBase}
            profile={s.profile}
            onCheat={this.handleCheat} /> : null}
            <a
            style={utils.css(this.noDragStyle, {cursor: 'default'})}
            className={`ui icon item`}
            onClick={this.handleLocationRegistrationToggle}
            data-place="bottom"
            data-tip={utils.tip('Manually Register Location')}>
              <i className="location arrow icon" />
            </a>
            <DropdownMenu
            s={s}
            onSync={this.handleSync}
            onUsernameOverride={this.handleSetUsernameOverride} />
          </div>
          <div
          style={this.titleBarControlsStyle}
          className={this.headerItemClasses}
          onClick={this.handleSort}>
            <div className="titlebar-controls">
              <div className="titlebar-minimize" onClick={this.handleMinimize}>
                <svg x="0px" y="0px" viewBox="0 0 10 1">
                  <rect fill="#FFFFFF" width="10" height="1" />
                </svg>
              </div>
              <div className="titlebar-resize" onClick={this.handleMaximize}>
                {s.maximized ?
                <svg className="fullscreen-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <path fill="#FFFFFF" d="M 0 0 L 0 10 L 10 10 L 10 0 L 0 0 z M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 z " />
                </svg>
                :
                <svg className="maximize-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <mask id="Mask">
                    <path fill="#FFFFFF" d="M 3 1 L 9 1 L 9 7 L 8 7 L 8 2 L 3 2 L 3 1 z" />
                    <path fill="#FFFFFF" d="M 1 3 L 7 3 L 7 9 L 1 9 L 1 3 z" />
                  </mask>
                  <path fill="#FFFFFF" d="M 2 0 L 10 0 L 10 8 L 8 8 L 8 10 L 0 10 L 0 2 L 2 2 L 2 0 z" mask="url(#Mask)" />
                </svg>}
              </div>
              <div className="titlebar-close" onClick={this.handleClose}>
                <svg x="0px" y="0px" viewBox="0 0 10 10">
                  <polygon fill="#FFFFFF" points="10,1 9,0 5,4 1,0 0,1 4,5 0,9 1,10 5,6 9,10 10,9 6,5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        {this.state.selectedImage ? <ImageModal image={this.state.selectedImage} width={this.state.width} /> : null}
        {this.state.usernameOverride ? <UsernameOverrideModal ps4User={this.state.ps4User} /> : null}
        {this.state.registerLocation ? <LocationRegistrationModal s={pick(this.state, ['machineId', 'username', 'height', 'storedLocations'])} /> : null}
        {this.state.setEmail ?
        <RecoveryModal
        type="setEmail"
        placeholder="Recovery Email Address"
        s={pick(this.state, ['machineId', 'username', 'profile'])} /> : null}
        {this.state.recoveryToken ?
        <RecoveryModal
        type="recoveryToken"
        placeholder="Recovery Token"
        s={pick(this.state, ['machineId', 'username', 'profile'])} /> : null}
        {s.init ?
        <Loader loading={this.state.loading} />
        :
        <Container
        s={s}
        onTeleport={this.handleTeleport}
        onPagination={this.handlePagination}
        onRemoveStoredLocation={this.handleRemoveStoredLocation}
        onSaveBase={this.handleSaveBase}
        onSearch={this.handleSearch} />}
        {this.state.displayProfile ?
        <ProfileModal
        profileId={this.state.displayProfile}
        profile={this.state.profile}
        height={this.state.height}
        favorites={this.state.favorites} /> : null}
        {this.state.displayFriendRequest ?
        <FriendRequestModal
        notification={this.state.displayFriendRequest}
        profile={this.state.profile}
        username={this.state.username}
        machineId={this.state.machineId} /> : null}
        {this.state.displayBaseRestoration ?
        <BaseRestorationModal
        baseData={this.state.displayBaseRestoration}
        height={this.state.height} /> : null}
        <ReactTooltip
        className="nmcTip"
        globalEventOff="click mouseleave"
        effect="solid"
        place="bottom"
        multiline={false}
        html={true}
        offset={{top: 0, left: 6}}  />
        {this.state.notification && this.state.notification.message ?
        <Notification notification={this.state.notification} /> : null}
      </div>
    );
  }
};

export default App;