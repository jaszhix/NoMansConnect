const _ = require('lodash');
const each = require('./each');

onmessage = function(e) {
  let order = e.data.sort === '-created' ? 'created' : e.data.sort === '-score' ? 'score' : 'teleports';
  if (e.data.state.search.length === 0 && e.data.sort === e.data.state.sort || e.data.sort === '-created' || e.data.partial) {
    console.log(e.data.sort, e.data.partial)
    e.data.res.data.results = _.chain(e.data.state.remoteLocations.results)
      .unionWith(e.data.res.data.results, (a, b)=>{
        return a.id === b.id;
      })
      .orderBy(order, 'desc')
      .value();
  }
  each(e.data.res.data.results, (remoteLocation, key)=>{
    let refFav = _.findIndex(e.data.state.favorites, (fav)=>{
      return fav === remoteLocation.data.id;
    });
    let upvote = refFav !== -1;

    e.data.res.data.results[key].data.username = remoteLocation.username;
    e.data.res.data.results[key].data.name = remoteLocation.name;
    e.data.res.data.results[key].data.description = remoteLocation.description;
    e.data.res.data.results[key].data.score = remoteLocation.score;
    e.data.res.data.results[key].data.upvote = upvote;
    // tbd
    try {
      e.data.res.data.results[key].data.image = remoteLocation.image
    } catch (e) {
      e.data.res.data.results[key].data.image = '';
    }
    let refStoredLocation = _.findIndex(e.data.state.storedLocations, {id: remoteLocation.data.id});
    if (refStoredLocation !== -1) {
      e.data.state.storedLocations[refStoredLocation].image = remoteLocation.image;
      e.data.state.storedLocations[refStoredLocation].username = remoteLocation.username;
      e.data.state.storedLocations[refStoredLocation].name = remoteLocation.name;
      e.data.state.storedLocations[refStoredLocation].description = remoteLocation.description;
      e.data.state.storedLocations[refStoredLocation].score = remoteLocation.score;
    }
  });

  let stateUpdate = {
    storedLocations: e.data.state.storedLocations,
    remoteLocations: e.data.res.data,
    searchInProgress: e.data.state.search.length > 0,
    init: false
  };

  if (e.data.sort === '-created') {
    if (e.data.state.remoteLocations.next) {
      stateUpdate.remoteLocations.next = e.data.state.remoteLocations.next;
    }

    if (e.data.state.remoteLocations.next) {
      stateUpdate.remoteLocations.next = e.data.state.remoteLocations.next;
    }
  }

  // Preserve pagination data from being overwritten on partials
  if (e.data.partial) {
    /*e.data.res.data.count = e.data.state.remoteLocations.count;
    e.data.res.data.next = e.data.state.remoteLocations.next;*/
    /*stateUpdate.remoteLocations.results = _.chain(e.data.state.remoteLocations.results)
      .concat(stateUpdate.remoteLocations.results)
      .uniqBy('id')
      .orderBy(order, 'desc')
      .value();*/
  }

  stateUpdate.page = e.data.init ? 1 : e.data.page;

  postMessage({
    stateUpdate: stateUpdate,
    sync: e.data.sync
  });
}