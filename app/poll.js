import log from './log';
const ps = require('win-ps');
import state from './state';
import {assignIn, uniqBy, isEqual} from 'lodash';

import screenshot from 'capture';
import * as utils from './utils';
import {each, find, findIndex, tryFn} from './lang';
import {handleSaveDataFailure, handleProtectedSession} from './dialog';


let processData = (opts, saveData, location, refLocation, username, profile=null) => {
  let {init, machineId, NMSRunning, next} = opts;
  let {storedLocations} = state;
  let stateUpdate = {};

  let favorites = profile ? profile.data.favorites : state.favorites;
  if (state.ps4User) {
    state.set({
      machineId,
      favorites
    }, next);
    return;
  }
  console.log('SAVE DATA: ', saveData);
  log.error(`Finished reading No Man's Sky v${saveData.result.Version} save file.`);

  if (profile && state.favorites.length !== profile.data.favorites.length) {
    let {remoteLocations} = state;
    log.error('Favorites are out of sync, fixing.');
    state.set({loading: 'Syncing favorites...'});
    let remainingFavorites = profile.data.favorites.slice();
    each(storedLocations, (location) => {
      if (favorites.indexOf(location.id) > -1) {
        location.upvote = true;
        if (location.username === username) {
          remainingFavorites.splice(remainingFavorites.indexOf(location.id), 1);
        }
      }
    });
    each(remoteLocations.results, (location) => {
      if (favorites.indexOf(location.data.id) > -1) {
        location.data.score = location.score;
        location.data.upvote = true;
        let refStored = findIndex(storedLocations, (l) => l.id === location.data.id) === -1;
        if (refStored === -1) {
          storedLocations.push(location.data);
        } else {
          storedLocations[refStored] = location.data;
        }
        remainingFavorites.splice(remainingFavorites.indexOf(location.data.id), 1);
      }
    });

    if (remainingFavorites.length > 0) {
      console.log('REMAINING FAVORITES: ', remainingFavorites)
      utils.ajax.post('/nmsfavoritesync/', {
        machineId: state.machineId,
        username,
        locations: remainingFavorites
      }).then((res) => {
        remoteLocations = state.remoteLocations;
        storedLocations = state.storedLocations;
        let missingFromStored = [];
        let missingFromRemote = [];
        each(res.data, (location) => {
          location.data.score = res.data.score;
          location.data.upvote = true;
          if (!find(storedLocations, (l) => l.id === location.data.id)) {
            missingFromStored.push(location.data);
          }
          if (!find(remoteLocations.results, (l) => l.id === location.data.id)) {
            missingFromRemote.push(location);
          }
        });
        remoteLocations.results = uniqBy(remoteLocations.results.concat(missingFromRemote), 'id');
        storedLocations = uniqBy(storedLocations.concat(missingFromStored), 'id');
        state.set({remoteLocations, storedLocations});
      }).catch((err) => log.error(`Error syncing favorites: ${err.message}`));
    }
  }

  let refFav = findIndex(favorites, (fav) => {
    return fav === location.id;
  });
  let upvote = refFav !== -1;

  screenshot(!init && NMSRunning && state.autoCapture, (image) => {
    let currentPosition = {
      name: '',
      image: '',
      playerPosition: saveData.result.SpawnStateData.PlayerPositionInSystem,
      playerTransform: saveData.result.SpawnStateData.PlayerTransformAt,
      shipPosition: saveData.result.SpawnStateData.ShipPositionInSystem,
      shipTransform: saveData.result.SpawnStateData.ShipTransformAt,
    };
    let isLocationUpdate = false;
    if (refLocation === -1) {
      assignIn(location, {
        username,
        positions: [currentPosition],
        galaxy: saveData.result.PlayerStateData.UniverseAddress.RealityIndex,
        distanceToCenter: Math.sqrt(Math.pow(location.VoxelX, 2) + Math.pow(location.VoxelY, 2) + Math.pow(location.VoxelZ, 2)) * 100,
        translatedX: utils.convertInteger(location.VoxelX, 'x'),
        translatedZ: utils.convertInteger(location.VoxelZ, 'z'),
        translatedY: utils.convertInteger(location.VoxelY, 'y'),
        base: false,
        baseData: null,
        upvote: upvote,
        image: image,
        mods: state.mods,
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
      if (!location.positions[0].playerPosition) {
        location.manuallyEntered = true;
      }
      storedLocations.push(location);
    } else {
      let existingLocation = storedLocations[refLocation];
      if (existingLocation.positions) {
        let refPosition = find(existingLocation.positions, (position) => {
          return (
            isEqual(position.playerPosition, currentPosition.playerPosition) &&
            isEqual(position.playerTransform, currentPosition.playerTransform) &&
            isEqual(position.shipPosition, currentPosition.shipPosition) &&
            isEqual(position.shipTransform, currentPosition.shipTransform)
          );
        });
        if (!refPosition) {
          existingLocation.positions.push(currentPosition);
          isLocationUpdate = true;
        }
      } else if (existingLocation.playerPosition) {
        existingLocation.positions = [
          {
            name: '',
            image: '',
            playerPosition: existingLocation.playerPosition,
            playerTransform: existingLocation.playerTransform,
            shipPosition: existingLocation.shipPosition,
            shipTransform: existingLocation.shipTransform
          }
        ];
        delete existingLocation.playerPosition;
        delete existingLocation.playerTransform;
        delete existingLocation.shipPosition;
        delete existingLocation.shipTransform;
        isLocationUpdate = true;
      }
      if (isLocationUpdate) {
        location = storedLocations[refLocation] = existingLocation;
      }
    }

    // Detect player bases
    each(saveData.result.PlayerStateData.PersistentPlayerBases, (base, i) => {
      let galacticAddress;
      if (!base.GalacticAddress || base.BaseType.PersistentBaseTypes !== 'HomePlanetBase') {
        return;
      }
      galacticAddress = utils.gaToObject(base.GalacticAddress);
      let refStoredLocation = findIndex(storedLocations, (storedLocation) => {
        return (
          galacticAddress.VoxelX === storedLocation.VoxelX
          && galacticAddress.VoxelY === storedLocation.VoxelY
          && galacticAddress.VoxelZ === storedLocation.VoxelZ
          && galacticAddress.SolarSystemIndex === storedLocation.SolarSystemIndex
          && galacticAddress.PlanetIndex === storedLocation.PlanetIndex
          && (!galacticAddress.RealityIndex || galacticAddress.RealityIndex === storedLocation.galaxy)
        );
      });
      if (refStoredLocation > -1) {
        storedLocations[refStoredLocation] = Object.assign(
          storedLocations[refStoredLocation],
          {
            base: true,
            baseData: utils.formatBase(saveData, state.knownProducts, i)
          }
        );
      }
    });

    stateUpdate = Object.assign(stateUpdate, {
      storedLocations,
      currentLocation: location.id,
      selectedGalaxy: tryFn(() => parseInt(location.id.split(':')[3])),
      username,
      favorites,
      saveDirectory: state.saveDirectory,
      saveFileName: saveData.path,
      saveVersion: saveData.result.Version,
      machineId,
      loading: 'Syncing discoveries...'
    });

    if (profile) {
      stateUpdate.profile = profile.data;
      // Add friends to the map legend
      let {show} = state;
      each(profile.data.friends, (friend) => {
        if (show[friend.username]) {
          return;
        }
        show[friend.username] = {
          color: `#${(Math.random()*0xFFFFFF<<0).toString(16)}`,
          value: true,
          listKey: `${friend.username}Locations`
        };
      });
      // Make sure stale/removed friends get removed from the legend
      each(show, (val, key) => {
        if (state.defaultLegendKeys.indexOf(key) > -1) {
          return;
        }
        let refIndex = findIndex(profile.data.friends, (friend) => friend.username === key);
        if (refIndex === -1) {
          delete show[key];
        }
      });
      stateUpdate.show = show;
    }

    if (init) {
      log.error(`Username: ${stateUpdate.username}`);
      log.error(`Active save file: ${stateUpdate.saveFileName}`);
      log.error(`Current location: ${stateUpdate.currentLocation}`);
    }

    state.set(stateUpdate, () => {
      let errorHandler = (err) => {
        if (err.response && err.response.data && err.response.data.status) {
          log.error(err.response.data.status);
        }
        next([err, err.message, err.stack]);
      };
      let {Record} = saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store;
      each(Record, (discovery, i) => {
        discovery.NMCID = utils.uaToObject(discovery.DD.UA).id;
      });
      if (init || refLocation === -1 || isLocationUpdate) {
        // Discoveries can change regardless if the location is known
        utils.ajax.put(`/nmsprofile/${profile.data.id}/`, {
          machineId: state.machineId,
          username: state.username,
          discoveries: Record
        }).then(() => {
          if (init) {
            next(false);
          }
        }).catch(errorHandler);
        if (!init || isLocationUpdate) {
          let route = '/nmslocation/';
          let method = 'post';
          if (isLocationUpdate) {
            method = 'put';
            route += `${location.id}/`;
          }
          utils.ajax[method](route, {
            machineId: state.machineId,
            username: state.username,
            mode: state.mode,
            image: image,
            version: location.version,
            data: location
          }).then((res) => {
            if (isLocationUpdate) {
              let {remoteLocations} = state;
              let refRemote = findIndex(remoteLocations.results, (location) => location.id === res.data.id);
              if (refRemote > -1) {
                remoteLocations.results[refRemote].data = res.data.data;
                state.set({remoteLocations}, () => next(false));
                return;
              }
            }
            next(false);
          }).catch(errorHandler);
        }
        return;
      }
      next(false);
    });
  });
}

let pollSaveData;
let getLastSave = (opts) => {
  let {mode, init, machineId} = opts;
  if (mode && mode !== state.mode) {
    state.mode = mode;
  }

  console.log('SAVE DIRECTORY: ', state.saveDirectory)

  utils.getLastGameModeSave(state.saveDirectory, state.ps4User, log).then((saveData) => {
    let refLocation, location, username;
    if (!state.ps4User) {
      location = utils.formatID(saveData.result.PlayerStateData.UniverseAddress);
      refLocation = findIndex(state.storedLocations, _location => _location.id === location.id);
      if (!state.username || state.username === 'Explorer') {
        username = saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record[0].OWS.USN;
      }
    }

    if (state.ps4User || !username) {
      username = state.username;
    }

    console.log('USERNAME: ', username)

    if (state.offline) {
      processData(opts, saveData, location, refLocation, username);
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
        processData(opts, saveData, location, refLocation, username, profile);
      }).catch((err) => {
        log.error(err.message)
        state.set({machineId, username}, () => {
          if (err.response && err.response.status === 403) {
            log.error(`Username protected: ${username}`);
            handleProtectedSession(username);
          } else {
            log.error(`NMC couldn't fetch the profile: ${err.message}`);
            processData(opts, saveData, location, refLocation, username);
          }
        });
      });
    }

  }).catch((err) => {
    log.error(err);
    log.error(`Unable to retrieve NMS save file: ${err}`)
    log.error(`${state.saveDirectory}, ${state.saveFileName}`);
    tryFn(() => log.error(err.stack));
    handleSaveDataFailure(mode, init, () => pollSaveData({mode, init}));
  });
};

pollSaveData = (opts = {mode: state.mode, init: false, machineId: state.machineId}) => {
  if (state.closing) {
    return;
  }
  if (state.ps4User && state.username === 'Explorer') {
    state.set({usernameOverride: true});
    return;
  }
  opts.NMSRunning = false;
  if (process.platform !== 'win32' || parseFloat(state.winVersion) <= 6.1) {
    log.error(`Skipping process scan...`);
    getLastSave(opts);
  } else {
    ps.snapshot(['ProcessName']).then((list) => {
      opts.NMSRunning = findIndex(list, proc => proc.ProcessName === 'NMS.exe') > -1;
      getLastSave(opts);
    }).catch((err) => {
      log.error(`Unable to use win-ps: ${err}`);
      getLastSave(opts);
    });
  }
};

export default pollSaveData;