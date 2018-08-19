const {orderBy, uniqBy} = require('lodash');
const {each, findIndex, filter} = require('./lang');

const isDifferent = function(objA, objB, keys = ['username', 'name', 'description', 'score', 'upvote', 'image']) {
  for (let i = 0, len = keys.length; i < len; i++) {
    if (objA[keys[i]] !== objB[keys[i]]) {
      return true;
    }
  }
  return false;
};
let lastSort = null;
onmessage = function(e) {
  let stateUpdate = {navLoad: false};
  let order = e.data.sort === '-teleports' ? 'teleports' : e.data.sort === '-score' ? 'score' : 'created';
  let shouldMerge = e.data.state.search.length === 0 && (lastSort === e.data.sort || e.data.sort === '-created' || e.data.partial);
  let changed = false;
  let isSearch = e.data.state.search.length > 0;
  each(e.data.res.data.results, (remoteLocation, key)=>{
    if (remoteLocation.image.indexOf('data:') !== -1) {
      e.data.res.data.results[key].image = '';
    }

    let refFav = findIndex(e.data.state.favorites, (fav)=>{
      return fav === remoteLocation.dataId;
    });

    e.data.res.data.results[key].upvote = refFav !== -1;

    if (shouldMerge) {
      let refNewLocation = findIndex(e.data.state.remoteLocations.results, location => location.id === remoteLocation.id);
      if (refNewLocation > -1) {
        if (isDifferent(e.data.state.remoteLocations.results[refNewLocation], e.data.res.data.results[key])) {
          changed = true;
          e.data.state.remoteLocations.results[refNewLocation] = e.data.res.data.results[key];
        }

      } else {
        e.data.state.remoteLocations.results.push(remoteLocation);
      }
    }
    let refStoredLocation = findIndex(e.data.state.storedLocations, location => location && location.dataId === remoteLocation.dataId);
    if (refStoredLocation !== -1 && isDifferent(e.data.state.storedLocations[refStoredLocation], e.data.res.data.results[key])) {
      changed = true;
      // TODO: We need to checksum this or determine which one is newer, or centralize the functions for formatting the offline schema.
      e.data.state.storedLocations[refStoredLocation] = e.data.res.data.results[key];
    }
  });
  let remoteLength = e.data.state.remoteLocations.results.length;
  if (remoteLength === e.data.state.remoteLength
    && (!changed || e.data.pagination)
    && lastSort === e.data.sort
    && !e.data.init
    && !isSearch) {
    if (e.data.pagination) {
      stateUpdate.pagination = true;
      delete stateUpdate.navLoad;
    }
    postMessage({stateUpdate});
    return;
  }

  lastSort = e.data.sort;

  Object.assign(stateUpdate, {
    storedLocations: e.data.state.storedLocations,
    remoteLocations: e.data.state.remoteLocations,
    remoteLength,
    searchInProgress: e.data.state.search.length > 0
  });

  if (e.data.state.remoteNext !== e.data.res.data.next && e.data.res.data.next) {
    stateUpdate.remoteNext = e.data.res.data.next;
  }

  if (e.data.pagination) {
    stateUpdate.pagination = false;
  }

  if (isSearch) {
    stateUpdate.searchCache = e.data.res.data;
    delete stateUpdate.remoteLocations;
  } else {
    if (order === 'created') {
      each(stateUpdate.remoteLocations.results, (location) => {
        if (!location) return;
        location.intCreated = new Date(location.created).getTime();
      });
      order = 'intCreated';
    }
    stateUpdate.remoteLocations.results = orderBy(
      uniqBy(
        filter(stateUpdate.remoteLocations.results, (location) => location.dataId != null),
        'dataId'
      ),
      order,
      'desc'
    );
    if (e.data.res.data.next) {
      stateUpdate.remoteLocations.count = e.data.res.data.count
    }
    stateUpdate.remoteLocations.next = e.data.res.data.next;
    stateUpdate.remoteLocations.prev = e.data.res.data.prev;
    if (!e.data.partial && e.data.page > stateUpdate.remoteLocations.page) {
      stateUpdate.remoteLocations.page = e.data.page;
    }
  }

  postMessage({stateUpdate});
}