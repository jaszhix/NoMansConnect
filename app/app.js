import {remote} from 'electron';
const win = remote.getCurrentWindow();
import fs from 'graceful-fs';
import path from 'path';
import log from './log';
import watch from 'watch';
const ps = require('win-ps');
import {machineId} from 'node-machine-id';
import state from './state';
import React from 'react';
import ReactTooltip from 'react-tooltip';
import openExternal from 'open-external';
import {assignIn, cloneDeep, clone, orderBy, uniq, uniqBy, defer, delay, concat, first, last, isArray, isString, pullAt, throttle, pick} from 'lodash';
import v from 'vquery';
import math from 'mathjs';

import Loader from './loader';
const screenshot = require('./capture');
import * as utils from './utils';
window.utils = utils
import {each, find, findIndex, map, filter, tryFn} from './lang';

import defaultWallpaper from './assets/images/default_wallpaper.png';
import baseIcon from './assets/images/base_icon.png';

import {DropdownMenu, SaveEditorDropdownMenu, BaseDropdownMenu} from './dropdowns';
import {ImageModal, UsernameOverrideModal, LocationRegistrationModal, RecoveryModal} from './modals';
import GalacticMap from './map';
import LocationBox from './locationBox';
import StoredLocations from './storedLocations';
import RemoteLocations from './remoteLocations';

const {dialog} = remote;

const containerStyle = {
  paddingTop: '51px',
  float: 'left',
  position: 'absolute',
  margin: '0px auto',
  left: '0px',
  right: '0px'
};

const transparentIconInputStyle = {
  width: '250px',
  WebkitUserSelect: 'initial',
  WebkitAppRegion: 'no-drag',
  fontSize: '15px'
};
const searchIconStyle = {
  cursor: 'default',
  padding: '0px'
};
const letterSpacingStyle = {
  letterSpacing: '2px'
};

class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      search: ''
    }
  }
  setValue = (e) => {
    let search = e.target.value;
    this.setState({search}, () => {
      if (search.length === 0 && state.searchInProgress) {
        state.set({search}, () => this.props.onClick());
      }
    });
  }
  handleEnter = (e) => {
    if (e.keyCode === 13) {
      state.set({search: this.state.search}, () => this.props.onKeyDown(e));
    }
  }
  handleSearchIconClick = () => {
    state.set({search: this.state.search}, () => this.props.onClick());
  }
  render() {
    return (
      <div className="item">
        <div
        className={`ui transparent icon input${state.navLoad ? ' disabled' : ''}`}
        style={transparentIconInputStyle}>
          <input
          type="text"
          style={letterSpacingStyle}
          placeholder="Search..."
          value={this.state.search}
          onChange={this.setValue}
          onKeyDown={this.handleEnter} />
          <i
          className={state.searchInProgress ? 'remove link icon' : 'search link icon'}
          style={searchIconStyle}
          onClick={this.props.onClick} />
        </div>
      </div>
    );
  }
}

class Container extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      updating: false,
      edit: false,
      mapRender: '<div />'
    };
    state.connect({selectedLocation: () => this.setState({edit: false})})
  }
  handleFavorite = (location) => {
    if (this.props.s.offline) {
      state.set({error: `Unable to favorite location in offline mode.`});
      return;
    }
    let refFav = findIndex(this.props.s.favorites, (fav) => {
      return fav === location.id;
    });
    let upvote = refFav === -1;

    utils.ajax.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      score: location.score,
      upvote: upvote,
      id: location.id
    }).then((res) => {
      let refLocation = findIndex(this.props.s.storedLocations, _location => _location.id === location.id);
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].score = res.data.score;
        this.props.s.storedLocations[refLocation].upvote = upvote;
      }
      let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
        return location.data.id === location.id;
      });
      if (refRemoteLocation !== -1) {
        assignIn(this.props.s.remoteLocations.results[refRemoteLocation].data, {
          score: res.data.score,
          upvote: upvote,
        });
      }
      if (upvote) {
        this.props.s.favorites.push(location.id);
      } else {
        pullAt(this.props.s.favorites, refFav);
      }
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        favorites: uniq(this.props.s.favorites)
      });
    }).catch((err) => {
      log.error(`Failed to favorite remote location: ${err}`);
    });
  }
  handleUpdate = (name, description) => {
    this.setState({updating: true}, () => {
      if (description.length > 200) {
        this.setState({limit: true});
        return;
      }
      const update = () => {
        let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
        if (refLocation !== -1) {
          this.props.s.storedLocations[refLocation].name = name;
          this.props.s.storedLocations[refLocation].description = description;
        }
        let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
          return location.data.id === this.props.s.selectedLocation.id;
        });
        if (refRemoteLocation !== -1) {
          this.props.s.remoteLocations.results[refRemoteLocation].name = name;
          this.props.s.remoteLocations.results[refRemoteLocation].data.description = description;
          this.props.s.remoteLocations.results[refRemoteLocation].description = description;
        }
        this.props.s.selectedLocation.name = name;
        this.props.s.selectedLocation.description = description;
        state.set({
          storedLocations: this.props.s.storedLocations,
          remoteLocations: this.props.s.remoteLocations,
          selectedLocation: this.props.s.selectedLocation
        }, () => {
          this.setState({
            updating: false,
            edit: false
          });
        });
      };

      if (this.props.s.offline) {
        update();
        return;
      }

      utils.ajax.post('/nmslocation/', {
        machineId: this.props.s.machineId,
        username: this.props.s.username,
        name: name,
        description: description,
        id: this.props.s.selectedLocation.id
      }).then((res) => {
        update();
      }).catch((err) => {
        log.error(`Failed to update remote location: ${err}`);
      });
    });
  }
  handleUploadScreen = (e) => {
    e.persist();
    if (this.props.s.offline) {
      state.set({error: `Unable to upload screenshot in offline mode.`});
      return;
    }
    this.setState({updating: true}, () => {
      var reader = new FileReader();
      reader.onload = (e)=> {
        var sourceImage = new Image();
        sourceImage.onload = ()=> {
          var imgWidth = sourceImage.width;
          var imgHeight = sourceImage.height;
          var canvas = document.createElement("canvas");
          canvas.width = imgWidth;
          canvas.height = imgHeight;
          canvas.getContext('2d').drawImage(sourceImage, 0, 0, imgWidth, imgHeight);
          var newDataUri = canvas.toDataURL('image/jpeg', 0.75);
          if (newDataUri) {
            utils.ajax.post('/nmslocation/', {
              machineId: this.props.s.machineId,
              username: this.props.s.username,
              imageU: newDataUri,
              id: this.props.s.selectedLocation.id
            }).then((res) => {
              let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
              if (refLocation !== -1) {
                this.props.s.storedLocations[refLocation].image = res.data.image;
              }
              let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
                return location.data.id === this.props.s.selectedLocation.id;
              });
              if (refRemoteLocation !== -1) {
                this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
              }
              this.props.s.selectedLocation.image = res.data.image;
              state.set({
                storedLocations: this.props.s.storedLocations,
                remoteLocations: this.props.s.remoteLocations,
                selectedLocation: this.props.s.selectedLocation
              }, () => {
                this.setState({
                  updating: false,
                  edit: false
                });
              });
            }).catch((err) => {
              log.error(`Failed to upload screenshot: ${err}`);
            });
          }
        };
        sourceImage.src = reader.result;
        this.screenshotRef.value = '';
      };
      reader.readAsDataURL(e.target.files[0]);
    });
  }
  handleDeleteScreen = () => {
    if (this.props.s.offline) {
      state.set({error: `Unable to delete screenshot in offline mode.`});
      return;
    }
    utils.ajax.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      imageD: true,
      id: this.props.s.selectedLocation.id
    }).then((res) => {
      let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].image = res.data.image;
      }
      let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
        return location.data.id === this.props.s.selectedLocation.id;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
      }
      this.props.s.selectedLocation.image = '';
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        selectedLocation: this.props.s.selectedLocation
      }, () => {
        this.setState({
          updating: false,
          edit: false
        });
      });
    });
  }
  handleCompatibility = () => {
    if (this.props.s.offline) {
      state.set({error: `Unable to mark compatibility in offline mode.`});
      return;
    }
    utils.ajax.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      version: this.props.s.saveVersion,
      id: this.props.s.selectedLocation.id
    }).then((res) => {
      let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].version = res.data.version;
      }
      let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
        return location.data.id === this.props.s.selectedLocation.id;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].version = res.data.version;
        this.props.s.remoteLocations.results[refRemoteLocation].data.version = res.data.version;
      }
      this.props.s.selectedLocation.version = res.data.version;
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        selectedLocation: this.props.s.selectedLocation
      }, () => {
        this.setState({
          updating: false,
          edit: false
        });
      });
    });
  }
  handleSelectLocation = (location) => {
    location = cloneDeep(location);
    let deselected = this.props.s.selectedLocation && this.props.s.selectedLocation.id === location.id;
    let _location = null;
    if (!deselected) {
      let refRemoteLocation = find(this.props.s.remoteLocations.results, (remoteLocation) => {
        return remoteLocation.data.id === location.id;
      });
      console.log('SELECTED: ', location.id, refRemoteLocation.data.id);
      if (refRemoteLocation !== undefined && refRemoteLocation) {
        refRemoteLocation.data.image = refRemoteLocation.image;
        refRemoteLocation.data.name = refRemoteLocation.name;
        refRemoteLocation.data.description = refRemoteLocation.description;
        refRemoteLocation.data.isHidden = location.isHidden;
        _location = refRemoteLocation.data;
      } else {
        _location = location;
      }
    }
    location = undefined;
    state.set({
      selectedLocation: deselected ? null : _location,
      selectedGalaxy: deselected ? 0 : _location.galaxy
    });
  }
  toggleEdit = () => {
    this.setState({edit: !this.state.edit});
  }
  screenshotRefClick = () => {
    this.screenshotRef.click();
  }
  getScreenshotRef = (ref) => {
    this.screenshotRef = ref;
  }
  render() {
    let p = this.props;
    let isOwnLocation = findIndex(p.s.storedLocations, location => location.id === (p.s.selectedLocation ? p.s.selectedLocation.id : null)) > -1;
    let remoteLocationsLoaded = p.s.remoteLocations && p.s.remoteLocations.results || p.s.searchCache.results.length > 0;
    let storedLocations = orderBy(p.s.storedLocations, (location) => {
      return location.upvote !== undefined && location.upvote;
    }, 'desc');
    if (p.s.filterOthers) {
      storedLocations = filter(storedLocations, (location) => {
        return location.username === p.s.username;
      });
    }
    if (!p.s.showHidden) {
      storedLocations = filter(storedLocations, (location) => {
        return !location.isHidden;
      });
    }
    if (p.s.sortStoredByTime) {
      storedLocations = orderBy(storedLocations, 'timeStamp', 'desc');
    }
    let isSelectedLocationRemovable = false;
    if (p.s.selectedLocation) {
      let refLocation = findIndex(p.s.storedLocations, location => location.id === p.s.selectedLocation.id);
      isSelectedLocationRemovable = refLocation !== -1;
    }
    return (
      <div className="ui grid row" style={containerStyle}>
        <input ref={this.getScreenshotRef} onChange={this.handleUploadScreen} style={{display: 'none'}} type="file" accept="image/*" multiple={false} />
        <div className="columns">
          <div className="ui segments stackable grid container" style={{maxWidth: '800px !important'}}>
            <StoredLocations
            onSelect={this.handleSelectLocation}
            storedLocations={storedLocations}
            selectedLocationId={p.s.selectedLocation ? p.s.selectedLocation.id : null}
            currentLocation={p.s.currentLocation}
            height={p.s.height}
            filterOthers={p.s.filterOthers}
            showHidden={p.s.showHidden}
            sortStoredByTime={p.s.sortStoredByTime}
            useGAFormat={p.s.useGAFormat}
            username={p.s.username} />
            <div className="ui segments" style={{display: 'inline-flex', paddingTop: '14px', marginLeft: '0px'}}>
              {remoteLocationsLoaded ?
              <GalacticMap
              mapLoading={p.s.mapLoading}
              map3d={p.s.map3d}
              mapDrawDistance={p.s.mapDrawDistance}
              mapLines={p.s.mapLines}
              galaxyOptions={p.s.galaxyOptions}
              selectedGalaxy={p.s.selectedGalaxy}
              storedLocations={p.s.storedLocations}
              width={p.s.width}
              height={p.s.height}
              remoteLocationsColumns={p.s.remoteLocationsColumns}
              remoteLocations={p.s.remoteLocations}
              selectedLocation={p.s.selectedLocation}
              currentLocation={p.s.currentLocation}
              username={p.s.username}
              show={p.s.show}
              onRestart={p.onRestart}
              onSearch={p.onSearch}
              searchCache={p.s.searchCache.results} /> : null}
              {p.s.selectedLocation ?
              <LocationBox
              name={p.s.selectedLocation.name}
              description={p.s.selectedLocation.description}
              username={p.s.username}
              selectType={true}
              currentLocation={p.s.currentLocation}
              isOwnLocation={isOwnLocation}
              isVisible={true}
              location={p.s.selectedLocation}
              installing={p.s.installing}
              updating={this.state.updating}
              edit={this.state.edit}
              favorites={p.s.favorites}
              image={p.s.selectedLocation.image}
              version={p.s.selectedLocation.version === p.s.saveVersion}
              width={p.s.width}
              height={p.s.height}
              isSelectedLocationRemovable={isSelectedLocationRemovable}
              onUploadScreen={this.screenshotRefClick}
              onDeleteScreen={this.handleDeleteScreen}
              onFav={this.handleFavorite}
              onEdit={this.toggleEdit}
              onMarkCompatible={this.handleCompatibility}
              onRemoveStoredLocation={p.onRemoveStoredLocation}
              onTeleport={p.onTeleport}
              onSubmit={this.handleUpdate}
              onSaveBase={p.onSaveBase}
              ps4User={p.s.ps4User}
              configDir={p.s.configDir} /> : null}
            </div>
          </div>
        </div>
        {remoteLocationsLoaded ?
        <RemoteLocations
        s={p.s}
        currentLocation={p.s.currentLocation}
        isOwnLocation={isOwnLocation}
        updating={this.state.updating}
        onPagination={p.onPagination}
        onTeleport={p.onTeleport}
        onFav={this.handleFavorite}
        onSaveBase={p.onSaveBase}
        ps4User={p.s.ps4User} /> : null}
      </div>
    );
  }
};

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
    window.handleWallpaper = this.handleWallpaper;
    this.saveJSON = process.env.NODE_ENV === 'production' ? `.${utils.dirSep}nmssavetool${utils.dirSep}saveCache.json` : `.${utils.dirSep}app${utils.dirSep}nmssavetool${utils.dirSep}saveCache.json`;
    this.saveTool = process.env.NODE_ENV === 'production' ? `${utils.dirSep}nmssavetool${utils.dirSep}nmssavetool.exe` : `${utils.dirSep}app${utils.dirSep}nmssavetool${utils.dirSep}nmssavetool.exe`;

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
          this.handleUpgrade(e.data.data.version);
        }
      } else if (e.data.func === 'syncRemoteOwned') {
        each(e.data.results, (location, i) => {
          assignIn(location.data, {
            name: location.name,
            description: location.description,
            teleports: location.teleports,
            score: location.score,
            image: location.image
          })
          e.data.data.results[i] = location;
        });
        this.state.storedLocations = orderBy(uniqBy(concat(this.state.storedLocations, map(e.data.data.results, res => res.data)), 'id'), 'timeStamp', 'desc');
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
      if (!existsInRemoteLocations) {
        location = cloneDeep(location);
        location.timeStamp = new Date(location.timeStamp);
        locations.push(location);
      }
    });
    window.ajaxWorker.postMessage({
      method: 'post',
      func: 'handleSync',
      url: '/nmslocationremotesync/',
      obj: {
        locations: locations,
        mode: state.mode,
        username: state.username,
      },
      params: [page, sort, init, true, false]
    });
  }
  formatRemoteLocations = (res, page, sort, init, partial, pagination, cb=null) => {
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
      params: [state.page, state.sort, false, true, state.pagination]
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
      page: page,
      sort: sort,
      q: q
    };

    if (q) {
      params.page_size = 200;
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
  baseError = () => {
    dialog.showMessageBox({
      type: 'info',
      buttons: [],
      title: 'Base Save',
      message: 'Unable to save your base. Have you claimed a base yet?'
    });
  }
  handleSaveBase = (baseData=null) => {
    if (baseData) {
      this.state.storedBases.push(cloneDeep(baseData));
      state.set({storedBases: this.state.storedBases});
      return;
    }
    utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      let base = utils.formatBase(saveData, state.knownProducts);
      let refBase = findIndex(this.state.storedBases, _base => _base.Name === base.Name);
      if (refBase === -1 && isArray(this.state.storedBases)) { // Sentry error, cause TBD
        this.state.storedBases.push(base);
      }
      state.set({storedBases: this.state.storedBases});
    }).catch(() => {
      this.baseError();
    });
  }
  signSaveData = (slot) => {
    let absoluteSaveDir = this.state.saveFileName.split(utils.dirSep);
    pullAt(absoluteSaveDir, absoluteSaveDir.length - 1);
    absoluteSaveDir = absoluteSaveDir.join(utils.dirSep);
    let command = `${process.platform !== 'win32' ? 'wine ' : ''}.${this.saveTool} encrypt -g ${slot} -f ${this.saveJSON} --save-dir "${absoluteSaveDir}"`;
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
  handleRestoreBase = (base) => {
    utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
      if (saveData.result.PlayerStateData.PersistentPlayerBases.length === 0) {
        this.baseError();
        return;
      }
      let newBase = saveData.result.PlayerStateData.PersistentPlayerBases[0];
      let storedBase = cloneDeep(base);

      // Base conversion algorithm by monkeyman192

      // 3-vector
      let fwdOriginal = storedBase.Forward;
      // 3-vector
      let upOriginal = storedBase.Objects[0].Up;
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
        upNew = newBase.Objects[0].Up;
      } else {
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Base Restore',
          message: 'In order to restore your base correctly, at least one base building object must be placed on the new base first.'
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

      saveData.result.PlayerStateData.PersistentPlayerBases[0].Objects = storedBase.Objects;

      fs.writeFile(this.saveJSON, JSON.stringify(saveData.result), {flag : 'w'}, (err, data) => {
        if (err) {
          log.error(err);
          return;
        }
        this.signSaveData(saveData.slot);
      });
    }).catch((err) => {
      log.error(err);
    });
  }
  handleTeleport = (location, i, action=null, n=null) => {
    const _location = cloneDeep(location);
    state.set({installing: `t${i}`}, () => {
      utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {

        if (location.data) {
          location = location.data;
        }

        if (location.manuallyEntered || !location.playerPosition) {
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

        if (action) {
          saveData.result = utils[action](saveData, n);
        }

        saveData.result.PlayerStateData.UniverseAddress.RealityIndex = _location.galaxy;

        fs.writeFile(this.saveJSON, JSON.stringify(saveData.result), {flag : 'w'}, (err, data) => {
          if (err) {
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
              installing: false,
              currentLocation: _location.id,
              remoteLocations: this.state.remoteLocations
            });
          }).catch((err) => {
            log.error(`Unable to send teleport stat to server: ${err}`);
            state.set({installing: false});
          });
        });
      }).catch((err) => {
        log.error(err.message);
        log.error(`Unable to teleport to location: ${err}`);
      });
    });
  }
  pollSaveData = (mode=this.state.mode, init=false, machineId=this.state.machineId) => {
    if (this.state.closing) {
      return;
    }
    if (this.state.ps4User && this.state.username === 'Explorer') {
      state.set({usernameOverride: true});
      return;
    }
    let getLastSave = (NMSRunning=false) => {
      let next = (error=false) => {
        if (init && !this.state.ps4User) {
          this.handleWallpaper();
          this.syncRemoteOwned();
          watch.createMonitor(this.state.saveDirectory, {
            ignoreDotFiles: true,
            ignoreNotPermitted: true,

          }, (monitor) => {
            this.monitor = monitor;
            this.pollSaveDataThrottled = throttle(this.pollSaveData, 15000, {leading: true});
            this.monitor.on('changed', (f, curr, prev) => {
              this.pollSaveDataThrottled();
            });
          });
          if (this.state.username.toLowerCase() === 'explorer') {
            state.set({usernameOverride: true});
          }
        } else {
          if (init) {
            this.handleWallpaper();
          }
          this.fetchRemoteLocations(1, this.state.sort, init);
        }
      };

      if (mode && mode !== this.state.mode) {
        this.state.mode = mode;
      }

      let processData = (saveData, location, refLocation, username, profile=null) => {
        if (this.state.ps4User) {
          state.set({
            machineId: machineId,
          }, next);
          return;
        }
        console.log('SAVE DATA: ', saveData);
        log.error(`Finished reading No Man's Sky v${saveData.result.Version} save file.`);
        /*let uniquePlayers = [];
        each(saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record, (record) => {
          uniquePlayers.push(record.OWS.USN);
        });
        console.log(uniq(uniquePlayers))*/

        //username = isString(username) && username.length > 0 ? username : this.state.username ? this.state.username : '';

        let refFav = findIndex(this.state.favorites, (fav) => {
          return fav === location.id;
        });
        let upvote = refFav !== -1;

        screenshot(!init && NMSRunning && this.state.autoCapture, (image) => {
          if (refLocation === -1) {
            assignIn(location, {
              username: username,
              playerPosition: clone(saveData.result.SpawnStateData.PlayerPositionInSystem),
              playerTransform: clone(saveData.result.SpawnStateData.PlayerTransformAt),
              shipPosition: clone(saveData.result.SpawnStateData.ShipPositionInSystem),
              shipTransform: clone(saveData.result.SpawnStateData.ShipTransformAt),
              galaxy: clone(saveData.result.PlayerStateData.UniverseAddress.RealityIndex),
              distanceToCenter: Math.sqrt(Math.pow(location.VoxelX, 2) + Math.pow(location.VoxelY, 2) + Math.pow(location.VoxelZ, 2)) * 100,
              translatedX: utils.convertInteger(location.VoxelX, 'x'),
              translatedZ: utils.convertInteger(location.VoxelZ, 'z'),
              translatedY: utils.convertInteger(location.VoxelY, 'y'),
              base: false,
              baseData: null,
              upvote: upvote,
              image: image,
              mods: this.state.mods,
              manuallyEntered: false,
              timeStamp: Date.now(),
              version: saveData.result.Version
            });

            location.jumps = Math.ceil(location.distanceToCenter / 400);

            location.translatedId = `${utils.toHex(location.translatedX, 4)}:${utils.toHex(location.translatedY, 4)}:${utils.toHex(location.translatedZ, 4)}:${utils.toHex(location.SolarSystemIndex, 4)}`;

            if (location.translatedId.toLowerCase().indexOf('nan') !== -1) {
              log.error(`translatedId formatting is NaN: ${location}`);
              state.set({username: location.username}, () => {
                next();
              });
              return;
            }
            if (!location.playerPosition) {
              location.manuallyEntered = true;
            }
            this.state.storedLocations.push(location);
          }

          // Detect player base

          let base = null;
          let refBase = find(saveData.result.PlayerStateData.TeleportEndpoints, item => item.TeleporterType === 'Base');
          let baseFound = refBase !== undefined && refBase
          if (baseFound) {
            base = utils.formatID(refBase.UniverseAddress);
          }

          each(this.state.storedLocations, (storedLocation, i) => {
            if (isString(storedLocation.timeStamp)) {
              this.state.storedLocations[i].timeStamp = new Date(storedLocation.timeStamp).getTime()
            }
            if (storedLocation.manuallyEntered === undefined && !storedLocation.playerPosition) { // For old locations
              storedLocation.manuallyEntered = true;
            }
            if (baseFound) {
              let hasBase = (base.VoxelX === storedLocation.VoxelX
                && base.VoxelY === storedLocation.VoxelY
                && base.VoxelZ === storedLocation.VoxelZ
                && base.SolarSystemIndex === storedLocation.SolarSystemIndex
                && base.PlanetIndex === storedLocation.PlanetIndex
                && refBase.UniverseAddress.RealityIndex === storedLocation.galaxy);
              this.state.storedLocations[i].base = hasBase;
              if (hasBase) {
                this.state.storedLocations[i].baseData = utils.formatBase(saveData, state.knownProducts);
              }
            }
          });
          this.state.storedLocations = orderBy(this.state.storedLocations, 'timeStamp', 'desc');

          let stateUpdate = {
            storedLocations: this.state.storedLocations,
            currentLocation: location.id,
            selectedGalaxy: tryFn(() => parseInt(location.id.split(':')[3])),
            username: username,
            saveDirectory: this.state.saveDirectory,
            saveFileName: saveData.path,
            saveVersion: saveData.result.Version,
            machineId: machineId,
            loading: 'Loading save data...'
          };

          if (profile) {
            stateUpdate.profile = profile.data;
          }

          if (init) {
            log.error(`Username: ${stateUpdate.username}`);
            log.error(`Active save file: ${stateUpdate.saveFileName}`);
            log.error(`Current location: ${stateUpdate.currentLocation}`);
          }

          state.set(stateUpdate, () => {
            if (refLocation === -1) {
              utils.ajax.post('/nmslocation/', {
                machineId: this.state.machineId,
                username: location.username,
                mode: this.state.mode,
                image: image,
                version: location.version,
                data: location
              }).then((res) => {
                next(false);
              }).catch((err) => {
                next([err, err.message, err.stack]);
              });
            } else {
              next('exists');
            }
          });
        });
      }

      console.log('SAVE DIRECTORY: ', this.state.saveDirectory)

      utils.getLastGameModeSave(this.state.saveDirectory, this.state.ps4User, log).then((saveData) => {
        let refLocation, location, username;
        if (!this.state.ps4User) {
          location = utils.formatID(saveData.result.PlayerStateData.UniverseAddress);
          refLocation = findIndex(this.state.storedLocations, _location => _location.id === location.id);
          username = saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record[0].OWS.USN;
        }

        if (this.state.ps4User || !username) {
          username = this.state.username;
        }

        console.log('USERNAME: ', username)

        if (this.state.offline) {
          processData(saveData, location, refLocation, username);
        } else {
          utils.ajax.get('/nmsprofile', {
            params: {
              username: username,
              machineId: machineId
            }
          }).then((profile) => {
            if (typeof profile.data.username !== 'undefined') {
              username = profile.data.username;
            }
            processData(saveData, location, refLocation, username, profile);
          }).catch((err) => {
            log.error(err)
            if (err.response && err.response.status === 403) {
              log.error(`Username protected: ${username}`);
              this.handleProtectedSession(username);
            } else {
              processData(saveData, location, refLocation, username);
            }
          });
        }

      }).catch((err) => {
        log.error(err);
        log.error(`Unable to retrieve NMS save file: ${err}`)
        log.error(`${this.state.saveDirectory}, ${this.state.saveFileName}`);
        tryFn(() => log.error(err.stack));

        this.handleSaveDataFailure(mode, init, () => {
          this.pollSaveData(mode, init);
        });
      });
    };

    if (process.platform !== 'win32' || parseFloat(this.state.winVersion) <= 6.1) {
      log.error(`Skipping process scan...`)
      getLastSave(false);
    } else {
      ps.snapshot(['ProcessName']).then((list) => {
        let NMSRunning = findIndex(list, proc => proc.ProcessName === 'NMS.exe') > -1;
        getLastSave(NMSRunning);
      }).catch((err) => {
        log.error(`Unable to use win-ps: ${err}`);
        getLastSave(false);
      });
    }
  }
  handleProtectedSession = (username='Explorer') => {
    dialog.showMessageBox({
      title: `Protection Enabled For ${username}`,
      message: 'This username was protected by another user. When you protect your username, the app will associate your computer with your username to prevent impersonation. If this is in error, please open an issue on the Github repository.',
      buttons: ['OK', 'Send Recovery Email', 'Enter Recovery Token']
    }, result=>{
      if (result === 1) {
        utils.ajax.post('/nmsrequestrecovery/', {
          machineId: this.state.machineId,
          username: this.state.username
        }).then(() => {
          this.handleProtectedSession(username);
        }).catch((err) => {
          if (err.response && err.response.status === 400) {
            dialog.showMessageBox({
              type: 'info',
              buttons: [],
              title: 'Email Not Found',
              message: 'An email address associated with your profile could not be found.'
            });
          }
        });
      } else if (result === 2) {
        state.set({recoveryToken: true});
      }
    });
  }
  handleUsernameOverride = (username) => {
    if (username.length === 0) {
      dialog.showMessageBox({
        type: 'info',
        buttons: [],
        title: 'Username Override',
        message: 'Username field cannot be blank.'
      });
      return;
    }
    utils.ajax.post('/nmsoverride/', {
      username: this.state.username,
      override: username,
      machineId: this.state.machineId,
      ps4User: this.state.ps4User
    }).then((res) => {
      window.jsonWorker.postMessage({
        method: 'remove',
        key: 'remoteLocations'
      });
      each(this.state.storedLocations, (location, i) => {
        if (this.state.storedLocations[i].username === this.state.username) {
          this.state.storedLocations[i].username = username;
        }
      });
      state.set({
        storedLocations: this.state.storedLocations,
        username: username
      }, this.handleRestart);

    }).catch((err) => {
      if (typeof err.response.data.status !== 'undefined' && err.response.data.status === 'protected') {
        dialog.showMessageBox({
          type: 'info',
          buttons: [],
          title: 'Username Protected',
          message: 'You must disable username protection before changing your username.'
        });
      }
    });
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
  handleSaveDataFailure = (mode=this.state.mode, init=false, cb) => {
    dialog.showMessageBox({
      title: 'Which platform do you use?',
      message: 'Save data not found. Select PS4 to skip this step, and disable PC specific features.',
      buttons: ['PC', 'PS4']
    }, result=>{
      state.set({ps4User: result === 1}, () => {
        if (result === 0) {
          this.handleSelectSaveDirectory();
        } else {
          this.handleRestart();
        }
      });
    });
  }
  handleUpgrade = (nextVersion) => {
    state.set({updateAvailable: true, title: `OLD MAN'S ${state.offline ? 'DIS' : ''}CONNECT`});
    let upgradeMessage = `No Man's Connect v${nextVersion} is available.`;
    log.error(upgradeMessage);
    var infoUrl = 'https://github.com/jaszhix/NoMansConnect/releases';

    defer(() => {
      dialog.showMessageBox({
        title: 'No Man\'s Connect Upgrade',
        message: upgradeMessage,
        buttons: ['OK', 'Teleport to the Github releases page']
      }, result=>{
        if (result === 1) {
          openExternal(infoUrl);
        } else {
          return;
        }
      });
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
  handleWallpaper = () => {
    let wallpaper = defaultWallpaper;
    if (this.state.wallpaper) {
      tryFn(
        () => wallpaper = `data:${last(this.state.wallpaper.split('.'))};base64,${fs.readFileSync(this.state.wallpaper).toString('base64')}`,
        () => log.error(`Unable to set wallpaper: ${err}`)
      );
    }
    v(document.body).css({
      backgroundImage: `url(${wallpaper})`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    });
  }
  handleSetWallpaper = () => {
    if (this.state.wallpaper) {
      state.set({wallpaper: null}, () => {
        this.handleWallpaper();
      });
      return;
    }
    dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif']},],
    }, (cb) => {
      if (cb && cb[0]) {
        state.set({
          wallpaper: cb[0]
        }, () => {
          this.handleWallpaper();
        });
      }
    });
  }
  handleSelectInstallDirectory = () => {
    dialog.showOpenDialog({properties: ['openDirectory']}, (cb) => {
      if (cb && cb[0]) {
        state.set({
          installDirectory: cb[0]
        }, this.handleRestart);
      }
    });
  }
  handleSelectSaveDirectory = () => {
    dialog.showOpenDialog({properties: ['openDirectory']}, (cb) => {
      if (cb && cb[0]) {
        state.set({
          saveDirectory: cb[0],
          title: 'No Man\'s Connect'
        }, this.handleRestart);
      }
    });
  }
  handleRestart = () => {
    state.set({closing: true});
    delay(() => {
      if (process.env.NODE_ENV === 'production') {
        remote.app.relaunch();
        if (process.platform === 'darwin') {
          remote.app.quit();
        } else {
          window.close();
        }
      } else {
        if (this.monitor) {
          this.monitor.stop();
        }
        window.location.reload();
      }
    }, 1000);
  }
  handleMaximize = () => {
    state.set({maximized: !this.state.maximized}, () => {
      if (this.state.maximized) {
        win.unmaximize();
        let bounds = {
          height: 1040,
          width: 1421,
          x: 600,
          y: 5
        };
        win.setBounds(bounds);
      } else {
        win.maximize();
      }
    });
  }
  handleMinimize = () => {
    win.minimize();
  }
  handleClose = () => {
    this.monitor.stop();
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
    state.set({usernameOverride: true})
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
            <Search onKeyDown={this.handleSearch} style={this.searchIconStyle} onClick={this.handleSearchIconClick} /> : null}
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
            onCheat={this.handleCheat}
            /> : null}
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
            onSelectSaveDirectory={this.handleSelectSaveDirectory}
            onSelectInstallDirectory={this.handleSelectInstallDirectory}
            onRestart={this.handleRestart}
            onSync={this.handleSync}
            onSetWallpaper={this.handleSetWallpaper}
            onUsernameOverride={this.handleSetUsernameOverride} />
          </div>
          {process.platform === 'win32' ?
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
          </div> : null}
        </div>
        {this.state.selectedImage ? <ImageModal image={this.state.selectedImage} width={this.state.width} /> : null}
        {this.state.usernameOverride ? <UsernameOverrideModal ps4User={this.state.ps4User} onSave={this.handleUsernameOverride} onRestart={this.handleRestart} /> : null}
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
        onSuccess={this.handleRestart}
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
        onRestart={this.handleRestart}
        onSearch={this.handleSearch} />}
        <ReactTooltip
        className="nmcTip"
        globalEventOff="click mouseleave"
        effect="solid"
        place="bottom"
        multiline={false}
        html={true}
        offset={{top: 0, left: 6}}  />
      </div>
    );
  }
};

export default App;