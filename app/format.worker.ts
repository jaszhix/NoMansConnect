import {orderBy, uniqBy} from 'lodash';
import {each, findIndex, filter} from '@jaszhix/utils';

let lastSort = null;

onmessage = function(e) {
  const {sort, partial, page, pagination, init, state} = e.data;
  const {
    remoteLocations,
    storedLocations,
    search,
    favorites,
    remoteNext,
    sortByDistance,
    sortByModded,
    sortByFavorites,
    sortByTeleports,
    sortByModified,
  } = state;
  const {data} = e.data.res;
  const {next, prev, count, results} = data;
  const stateUpdate: State = {navLoad: false};
  const isSearch = search.length > 0;
  const shouldMerge = search.length === 0 && (lastSort === sort || sort === '-created' || partial);
  let order = sort === '-teleports' ? 'teleports' : sort === '-score' ? 'score' : 'created';
  let changed = false;

  each(results, (remoteLocation, key)=>{
    if (remoteLocation.image.indexOf('data:') !== -1) {
      remoteLocation.image = '';
    }

    let refFav = findIndex(favorites, (fav)=>{
      return fav === remoteLocation.dataId;
    });

    remoteLocation.upvote = refFav !== -1;

    if (shouldMerge) {
      let refNewLocation = findIndex(remoteLocations.results, (location) => location.id === remoteLocation.id);
      if (refNewLocation > -1) {
        if (remoteLocations.results[refNewLocation].modified !== remoteLocation.modified) {
          changed = true;
          remoteLocations.results[refNewLocation] = remoteLocation;
        }

      } else {
        remoteLocations.results.push(remoteLocation);
      }
    }
    let refStoredLocation = findIndex(storedLocations, (location) => location && location.dataId === remoteLocation.dataId);
    if (refStoredLocation !== -1 && storedLocations[refStoredLocation].modified !== remoteLocation.modified) {
      changed = true;
      // TODO: We need to checksum this or determine which one is newer, or centralize the functions for formatting the offline schema.
      storedLocations[refStoredLocation] = remoteLocation;
    }
  });

  let remoteLength = remoteLocations.results.length;

  if (remoteLength === state.remoteLength
    && (!changed || pagination)
    && lastSort === sort
    && !init
    && !isSearch) {
    if (pagination) {
      stateUpdate.pagination = true;
      delete stateUpdate.navLoad;
    }
    // @ts-ignore
    postMessage({stateUpdate});
    return;
  }

  lastSort = sort;

  Object.assign(stateUpdate, {
    storedLocations,
    remoteLocations,
    remoteLength,
    searchInProgress: search.length > 0
  });

  if (next && remoteNext !== next) {
    stateUpdate.remoteNext = next;
  }

  if (pagination) {
    stateUpdate.pagination = false;
  }

  if (isSearch) {
    stateUpdate.searchCache = data;
    delete stateUpdate.remoteLocations;
  } else {
    remoteLocations.results = uniqBy(
      filter(stateUpdate.remoteLocations.results, (location) => location.dataId != null)
      .concat(results),
      'dataId'
    )

    remoteLocations.results = orderBy(remoteLocations.results, (location)=>{
      let score = 0;

      if (!location.score) location.score = 0;
      if (!location.distanceToCenter) location.distanceToCenter = 400;

      if (!location || (sortByModded && !location.mods)) return score;

      if (sortByDistance || sortByModded || sortByTeleports || sortByFavorites || sortByModified) {
        if (sortByDistance) score -= location.distanceToCenter;
        if (sortByModded) score += location.mods.length;
        if (sortByTeleports) score += location.teleports;
        if (sortByFavorites) score += location.score;
        if (sortByModified) score += location.modified;
      } else {
        score = new Date(location.created).getTime();
      }

      return score;
    }, 'desc');

    if (next) {
      stateUpdate.remoteLocations.count = count
    }

    stateUpdate.remoteLocations.next = next;
    stateUpdate.remoteLocations.prev = prev;

    if (!partial && page > stateUpdate.remoteLocations.page) {
      stateUpdate.remoteLocations.page = page;
    }
  }
  // @ts-ignore
  postMessage({stateUpdate});
}

export default {} as typeof Worker & {new (): Worker};