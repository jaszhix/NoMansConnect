import log from './log';
const ps = require('win-ps');
import {assignIn, uniqBy, isEqual} from 'lodash';
import tc from 'tinycolor2';
import {each, find, findIndex, tryFn} from '@jaszhix/utils';

import screenshot from './capture';
import state from './state';
import {
  exc,
  ajaxWorker,
  getLastGameModeSave,
  formatID,
  formatTranslatedID,
  formatBase,
  calculateDistanceToCenter,
  gaToObject,
  uaToObject
} from './utils';

import {handleSaveDataFailure, handleProtectedSession} from './dialog';
import {defaultPosition} from './constants';

const updateLocation = ({location, isLocationUpdate, image, stateUpdate = {}, next, errorHandler}: any): Promise<any> => {
  let route = '/nmslocation/';
  let method = 'post';

  if (isLocationUpdate) {
    method = 'put';
    route += `${location.dataId}/`;
  }

  return ajaxWorker[method](route, {
    machineId: state.machineId,
    username: state.username,
    mode: state.mode,
    image,
    ...location
  }).then((res) => {
    if (isLocationUpdate && res.data) {
      let {storedLocations, remoteLocations, selectedLocation} = state;
      let refRemote = findIndex(remoteLocations.results, (location) => location.dataId === res.data.dataId);
      let refStored = findIndex(storedLocations, (location) => location.dataId === res.data.dataId);
      let hasRemote = refRemote > -1;
      let hasStored = refStored > -1;
      let shouldUpdate = hasRemote || hasStored;

      if (refRemote > -1) {
        remoteLocations.results[refRemote] = res.data;
        stateUpdate.remoteLocations = remoteLocations;
      }

      if (refStored > -1) {
        storedLocations[refStored] = res.data;
        stateUpdate.storedLocations = storedLocations;
      }

      if (selectedLocation && selectedLocation.dataId === res.data.dataId) {
        stateUpdate.selectedLocation = res.data;
      }

      if (shouldUpdate) stateUpdate.remoteChanged = [res.data.dataId];

      if (Object.keys(stateUpdate).length > 0) state.set(stateUpdate, true);
    }
    if (next) next(false);
  }).catch(errorHandler);
}

const updateDiscoveries = ({saveData, profile, init = false, fullSync = false, next, errorHandler}: any): Promise<any> => {
  // Discoveries can change regardless if the location is known
  let {Record} = saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store;
  let newDiscoveries = [];

  each(Record, (discovery) => {
    let NMCUID = `${discovery.DD.VP.join('-')}-${discovery.DD.DT || ''}-${discovery.DD.UA || ''}-${discovery.OWS.TS}`;

    if (profile.discoveryIds && !find(profile.discoveryIds, (d) => d[0].includes(NMCUID))) { // TODO: use indexOf
      discovery.NMCID = uaToObject(discovery.DD.UA).dataId;
      newDiscoveries.push(discovery);
    }
  });

  // If a large set of discoveries are going to be uploaded, don't hold up the startup process.
  if (!fullSync && newDiscoveries.length > 500) {
    log.error(
      'Over 500 new discoveries were found in the save file, these will be incrementally synced ' +
      'over time instead, but can optionally be manually synced in Settings.'
    );
    init = false;
    next(false);

    newDiscoveries = newDiscoveries.slice(0, 500);
  }

  return ajaxWorker.put(`/nmsprofile/${profile.id}/`, {
    machineId: state.machineId,
    username: state.username,
    discoveries: newDiscoveries,
    apiVersion: 3
  }).then(() => {
    if (init || state.newUser) {
      next(false);
    }
  }).catch(errorHandler);
};

const syncDiscoveries = () => {
  state.set({navLoad: true});
  getLastGameModeSave(state.saveDirectory, state.ps4User).then((saveData: SaveDataMeta) => {
    updateDiscoveries({
      saveData,
      profile: state.profile,
      init: false,
      fullSync: true,
      next: () => state.set({navLoad: false}),
      errorHandler: (err) => {
        log.error('Failed to sync discoveries: ', err);
        state.set({navLoad: false})
      }
    })
  }).catch(() => state.set({navLoad: false}));
}

let processData = (opts, saveData, location, refLocation, username, profile=null) => {
  let {init, machineId, NMSRunning, next} = opts;
  let {storedLocations} = state;
  let stateUpdate: GlobalState = {};
  let favorites = profile && profile.data ? profile.data.favorites : state.favorites;

  if (state.ps4User) {
    state.set({
      machineId,
      favorites
    }, next);
    return;
  }

  console.log('SAVE DATA: ', saveData);
  log.error(`Finished reading No Man's Sky v${saveData.result.Version} save file.`);

  if (profile && profile.data && profile.data.favorites && state.favorites && state.favorites.length !== profile.data.favorites.length) {
    let {remoteLocations} = state;
    log.error('Favorites are out of sync, fixing.');
    state.set({loading: 'Syncing favorites...'});
    let remainingFavorites = profile.data.favorites.slice();
    each(storedLocations, (location: NMSLocation) => {
      if (favorites.indexOf(location.dataId) > -1) {
        location.upvote = true;
        if (location.username === username) {
          remainingFavorites.splice(remainingFavorites.indexOf(location.dataId), 1);
        }
      }
    });
    each(remoteLocations.results, (location: NMSLocation) => {
      if (favorites.indexOf(location.dataId) > -1) {
        location.upvote = true;
        let refStored = findIndex(storedLocations, (l) => l.dataId === location.dataId);
        if (refStored === -1) {
          storedLocations.push(location);
        } else {
          storedLocations[refStored] = location;
        }
        remainingFavorites.splice(remainingFavorites.indexOf(location.dataId), 1);
      }
    });

    let favoritesLen = remainingFavorites ? remainingFavorites.length : 0;

    if (favoritesLen > 0) {
      log.error(`Fetching ${favoritesLen} favorites from the server`);
      ajaxWorker.post('/nmsfavoritesync/', {
        machineId: state.machineId,
        username,
        locations: remainingFavorites
      }).then((res) => {
        remoteLocations = state.remoteLocations;
        storedLocations = state.storedLocations;
        let missingFromStored = [];
        let missingFromRemote = [];
        each(res.data, (location) => {
          location.score = res.data.score;
          location.upvote = true;
          if (!find(storedLocations, (l) => l.dataId === location.dataId)) {
            missingFromStored.push(location);
          }
          if (!find(remoteLocations.results, (l) => l.dataId === location.dataId)) {
            missingFromRemote.push(location);
          }
        });
        remoteLocations.results = uniqBy(remoteLocations.results.concat(missingFromRemote), 'dataId');
        storedLocations = uniqBy(storedLocations.concat(missingFromStored), 'dataId');
        state.set({remoteLocations, storedLocations});
      }).catch((err) => log.error(`Error syncing favorites: ${err.message}`));
    }
  }

  let refFav = findIndex(favorites || [], (fav) => {
    return fav === location.dataId;
  });
  let upvote = refFav !== -1;
  let {PlanetIndex} = saveData.result.PlayerStateData.UniverseAddress.GalacticAddress;

  screenshot(!init && NMSRunning && state.autoCapture && (state.autoCaptureSpaceStations || PlanetIndex > 0), (image) => {
    let currentPosition = {
      playerPosition: saveData.result.SpawnStateData.PlayerPositionInSystem,
      playerTransform: saveData.result.SpawnStateData.PlayerTransformAt,
      shipPosition: saveData.result.SpawnStateData.ShipPositionInSystem,
      shipTransform: saveData.result.SpawnStateData.ShipTransformAt,
    };
    let manuallyEntered = isEqual(defaultPosition, currentPosition);
    assignIn(currentPosition, {
      name: '',
      image: '',
    });
    let isLocationUpdate = false;

    if (refLocation === -1) {
      assignIn(location, {
        username,
        positions: [currentPosition],
        galaxy: saveData.result.PlayerStateData.UniverseAddress.RealityIndex,
        distanceToCenter: calculateDistanceToCenter(location.VoxelX, location.VoxelY, location.VoxelZ),
        base: false,
        baseData: null,
        upvote: upvote,
        image,
        mods: state.mods,
        manuallyEntered,
        created: Date.now(),
        version: saveData.result.Version,
        apiVersion: 3
      });

      location.jumps = Math.ceil(location.distanceToCenter / 400);
      location = formatTranslatedID(location);

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
        if (!existingLocation.image && image) {
          existingLocation.image = image;
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
      if (!base || !base.BaseType) return;

      let galacticAddress;

      if (!base.GalacticAddress || base.BaseType.PersistentBaseTypes !== 'HomePlanetBase') {
        return;
      }
      galacticAddress = gaToObject(base.GalacticAddress);

      let refStoredLocation = find(storedLocations, (storedLocation) => {
        return (
          storedLocation
          && galacticAddress.VoxelX === storedLocation.VoxelX
          && galacticAddress.VoxelY === storedLocation.VoxelY
          && galacticAddress.VoxelZ === storedLocation.VoxelZ
          && galacticAddress.SolarSystemIndex === storedLocation.SolarSystemIndex
          && galacticAddress.PlanetIndex === storedLocation.PlanetIndex
          && (!galacticAddress.RealityIndex || galacticAddress.RealityIndex === storedLocation.galaxy)
        );
      });

      if (refStoredLocation && (!refStoredLocation.base || !refStoredLocation.baseData)) {
        Object.assign(refStoredLocation, {
          base: true,
          baseData: formatBase(saveData.result.PlayerStateData.PersistentPlayerBases[i]),
        });

        updateLocation({
          location: refStoredLocation,
          isLocationUpdate: true,
          stateUpdate,
          errorHandler: () => log.error('Unable to update base data for location: ', refStoredLocation.dataId)
        });
      }
    });

    stateUpdate = Object.assign(stateUpdate, {
      storedLocations,
      currentLocation: location.dataId,
      selectedGalaxy: tryFn(() => parseInt(location.dataId.split(':')[3])),
      username,
      favorites,
      saveDirectory: state.saveDirectory,
      saveFileName: saveData.path,
      saveVersion: saveData.result.Version,
      machineId,
      loading: 'Syncing discoveries...',
    });

    if (profile) {
      stateUpdate.profile = profile.data;

      // Add friends to the map legend
      let {show} = state;

      each(profile.data.friends, (friend) => {
        if (show[friend.username]) {
          return;
        }

        let color;

        // Avoid dark colors for better contrast
        while (!color || tc(color).isDark()) {
          color = `#${(Math.random() * 0xFFFFFF << 0).toString(16)}`;
        }

        show[friend.username] = {
          color,
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

    if (state.offline) {
      state.set(stateUpdate);
      next();
      return;
    }

    state.set(stateUpdate, () => {
      let errorHandler = (err) => {
        if (err.response && err.response.data && err.response.data.status) {
          log.error('processData -> errorHandler:', err.stack, err.response.data.status);
        }
        next([err, err.message, err.stack]);
      };

      if (profile && !state.offline && (init || refLocation === -1 || isLocationUpdate)) {
        updateDiscoveries({
          saveData,
          profile: profile.data,
          init,
          next,
          errorHandler
        }).then(() => {
          if (!init || isLocationUpdate) {
            updateLocation({
              location,
              isLocationUpdate,
              image,
              stateUpdate,
              next,
              errorHandler
            });
          }
        }).catch(errorHandler);
        return;
      }
      next(false);
    });
  });
}

let pollSaveData: Function;
let getLastSave = (opts) => {
  let {mode, machineId} = opts;
  if (mode && mode !== state.mode) {
    state.mode = mode;
  }

  log.error('SAVE DIRECTORY: ', state.saveDirectory)

  getLastGameModeSave(state.saveDirectory, state.ps4User).then((saveData: SaveDataMeta) => {
    console.log('SAVE DATA: ', saveData)
    let refLocation: number, location, username;
    if (!state.ps4User) {
      location = formatID(saveData.result.PlayerStateData.UniverseAddress);
      delete location.RealityIndex;
      refLocation = findIndex(state.storedLocations, (item) => item && item.dataId === location.dataId);
      if (!state.username || state.username === 'Explorer') {
        username = saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record[0].OWS.USN;
      }
    }

    if (state.ps4User || !username) {
      username = state.username;
    }

    if (state.offline) {
      processData(opts, saveData, location, refLocation, username);
    } else {
      ajaxWorker.get('/nmsprofile', {
        params: {
          username,
          machineId
        }
      }).then((profile) => {
        if (typeof profile.data.username !== 'undefined') {
          username = profile.data.username;
        }
        processData(opts, saveData, location, refLocation, username, profile);
      }).catch((err) => {
        state.set({machineId, username}, () => {
          if (err.response && err.response.status === 403) {
            log.error(`Username protected: ${username}`);
            handleProtectedSession(username);
          } else {
            log.error('NMC couldn\'t fetch the profile: ', err);
            processData(opts, saveData, location, refLocation, username);
          }
        });
      });
    }

  }).catch((err) => {
    log.error(`Unable to retrieve NMS save file: `, err);
    log.error(`${state.saveDirectory}, ${state.saveFileName}`);
    handleSaveDataFailure();
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
  if (process.platform !== 'win32') {
    exc('pidof NMS.exe').then((res) => {
      opts.NMSRunning = true;
      getLastSave(opts);
    }).catch((e) => {
      getLastSave(opts);
    });
  } else if (parseFloat(state.winVersion) <= 6.1) {
    log.error(`Skipping process scan...`);
    getLastSave(opts);
  } else {
    ps.snapshot(['ProcessName']).then((list) => {
      opts.NMSRunning = findIndex(list, proc => proc.ProcessName === 'NMS.exe') > -1;
      getLastSave(opts);
    }).catch((err) => {
      log.error('Unable to use win-ps:', err);
      getLastSave(opts);
    });
  }
};

export {
  pollSaveData,
  syncDiscoveries
};
