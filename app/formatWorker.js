const {orderBy} = require('lodash');
const {each, findIndex} = require('./lang');

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
      return fav === remoteLocation.data.id;
    });
    let upvote = refFav !== -1;

    e.data.res.data.results[key].data.username = e.data.res.data.results[key].username;
    e.data.res.data.results[key].data.name = e.data.res.data.results[key].name;
    e.data.res.data.results[key].data.description = e.data.res.data.results[key].description;
    e.data.res.data.results[key].data.score = e.data.res.data.results[key].score;
    e.data.res.data.results[key].data.upvote = upvote;
    e.data.res.data.results[key].data.image = e.data.res.data.results[key].image;

    if (shouldMerge) {
      let refNewLocation = findIndex(e.data.state.remoteLocations.results, location => location.id === remoteLocation.id);
      if (refNewLocation !== -1) {
        if (isDifferent(e.data.state.remoteLocations.results[refNewLocation].data, e.data.res.data.results[key].data)) {
          changed = true;
          e.data.state.remoteLocations.results[refNewLocation] = e.data.res.data.results[key];
        }

      } else {
        e.data.state.remoteLocations.results.push(remoteLocation);
      }
    }
    let refStoredLocation = findIndex(e.data.state.storedLocations, location => location.id === remoteLocation.data.id);
    if (refStoredLocation !== -1 && isDifferent(e.data.state.storedLocations[refStoredLocation], e.data.res.data.results[key].data)) {
      changed = true;
      e.data.state.storedLocations[refStoredLocation].image = e.data.res.data.results[key].image;
      e.data.state.storedLocations[refStoredLocation].username = e.data.res.data.results[key].username;
      e.data.state.storedLocations[refStoredLocation].name = e.data.res.data.results[key].name;
      e.data.state.storedLocations[refStoredLocation].description = e.data.res.data.results[key].description;
      e.data.state.storedLocations[refStoredLocation].score = e.data.res.data.results[key].score;
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

  if (e.data.pagination) {
    stateUpdate.pagination = false;
  }

  if (isSearch) {
    stateUpdate.searchCache = e.data.res.data;
    delete stateUpdate.remoteLocations;
  } else {
    stateUpdate.remoteLocations.results = orderBy(stateUpdate.remoteLocations.results, order, 'desc');
    if (e.data.res.data.next) {
      stateUpdate.remoteLocations.count = e.data.res.data.count
    }
    stateUpdate.remoteLocations.next = e.data.res.data.next;
    stateUpdate.remoteLocations.prev = e.data.res.data.prev;
    if (!e.data.partial && e.data.page > stateUpdate.remoteLocations.page) {
      stateUpdate.remoteLocations.page = e.data.page;
    }
  }

  postMessage({
    stateUpdate: stateUpdate
  });
}