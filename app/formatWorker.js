const _ = require('lodash');
const each = require('./each');

onmessage = function(e) {
  let stateUpdate = {};
  let order = e.data.sort === '-teleports' ? 'teleports' : e.data.sort === '-score' ? 'score' : 'created';
  let shouldMerge = e.data.state.search.length === 0 && (e.data.sort === e.data.state.sort || e.data.sort === '-created' || e.data.partial);

  each(e.data.res.data.results, (remoteLocation, key)=>{
    if (remoteLocation.image.indexOf('data:') !== -1) {
      e.data.res.data.results[key].image = '';
    }

    let refFav = _.findIndex(e.data.state.favorites, (fav)=>{
      return fav === remoteLocation.data.id;
    });
    let upvote = refFav !== -1;

    e.data.res.data.results[key].data.username = e.data.res.data.results[key].username;
    e.data.res.data.results[key].data.name = e.data.res.data.results[key].name;
    e.data.res.data.results[key].data.description = e.data.res.data.results[key].description;
    e.data.res.data.results[key].data.score = e.data.res.data.results[key].score;
    e.data.res.data.results[key].data.upvote = upvote;

    try {
      e.data.res.data.results[key].data.image = e.data.res.data.results[key].image
    } catch (e) {
      console.error(e, e.stack)
    }
    if (shouldMerge) {
      let refNewLocation = _.findIndex(e.data.state.remoteLocations.results, {id: remoteLocation.id});
      if (refNewLocation !== -1) {
        e.data.state.remoteLocations.results[refNewLocation] = e.data.res.data.results[key];
      } else {
        e.data.state.remoteLocations.results.push(remoteLocation);
      }
    }
    let refStoredLocation = _.findIndex(e.data.state.storedLocations, {id: remoteLocation.data.id});
    if (refStoredLocation !== -1) {
      e.data.state.storedLocations[refStoredLocation].image = e.data.res.data.results[key].image;
      e.data.state.storedLocations[refStoredLocation].username = e.data.res.data.results[key].username;
      e.data.state.storedLocations[refStoredLocation].name = e.data.res.data.results[key].name;
      e.data.state.storedLocations[refStoredLocation].description = e.data.res.data.results[key].description;
      e.data.state.storedLocations[refStoredLocation].score = e.data.res.data.results[key].score;
    }
  });

  stateUpdate = {
    storedLocations: e.data.state.storedLocations,
    remoteLocations: e.data.state.remoteLocations,
    searchInProgress: e.data.state.search.length > 0,
    init: false
  };

  if (e.data.state.search.length > 0) {
    stateUpdate.searchCache = e.data.res.data;
    delete stateUpdate.remoteLocations;
  } else {
    stateUpdate.remoteLocations.results = _.orderBy(stateUpdate.remoteLocations.results, order, 'desc');
    if (e.data.res.data.count >= 60) {
      stateUpdate.remoteLocations.count = e.data.res.data.count;
      stateUpdate.remoteLocations.next = e.data.res.data.next;
      stateUpdate.remoteLocations.prev = e.data.res.data.prev;
    }
  }

  postMessage({
    stateUpdate: stateUpdate
  });
}