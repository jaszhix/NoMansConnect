const _ = require('lodash');
const each = require('./each');

onmessage = function(e) {
  if (e.data.state.search.length === 0 && e.data.page > 1 && e.data.sort === e.data.state.sort || e.data.partial && !e.data.sync) {
    let order = e.data.sort === '-created' ? 'created' : e.data.sort === '-score' ? 'score' : 'teleports';
    e.data.res.data.results = _.chain(e.data.state.remoteLocations.results).concat(e.data.res.data.results).uniqBy('id').orderBy(order, 'desc').value();
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

    // Sync remote locations to stored

    if (!e.data.init) {
      let remoteOwnedLocations = _.filter(e.data.res.data.results, (remoteOwnedLocation)=>{
        let refStoredLocation = _.findIndex(e.data.state.storedLocations, {id: remoteOwnedLocation.data.id});
        return remoteOwnedLocation.username === e.data.state.username && refStoredLocation === -1;
      });
      if (remoteOwnedLocations.length > 0) {
        e.data.state.storedLocations = _.chain(e.data.state.storedLocations).concat(_.map(remoteOwnedLocations, 'data')).uniqBy('id').orderBy('timeStamp', 'desc').value()
      }
    }
  });

  let stateUpdate = {
    storedLocations: e.data.state.storedLocations,
    remoteLocations: e.data.res.data,
    searchInProgress: e.data.state.search.length > 0,
    init: false
  };

  // Preserve pagination data from being overwritten on partials
  if (e.data.partial) {
    e.data.res.data.count = e.data.state.remoteLocations.count;
    e.data.res.data.next = e.data.state.remoteLocations.next;
  }

  if (!e.data.sync) {
    stateUpdate.page = e.data.init ? 1 : e.data.page;
  }

  postMessage({
    stateUpdate: stateUpdate,
    sync: e.data.sync
  });
}