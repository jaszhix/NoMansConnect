const {uniq, uniqBy, concat} = require('lodash');
const {each, filter} = require('./lang');

const updateLocations = function(props) {
  let storedLocations = [];
  each(props.storedLocations, (location)=>{
    storedLocations.push(location); // TBD
  });

  let locations = props.remoteLocations.results.concat(storedLocations).concat(props.searchCache.results);

  let systems = uniqBy(locations, (location)=>{
    return location && location.translatedId;
  });
  each(systems, (location)=>{
    let planets = filter(locations, (planet)=>{
      return planet.translatedId === location.translatedId;
    });
    let planetData = {};
    each(planets, (planet)=>{
      if (!planetData[planet.username]) {
        planetData[planet.username] = [];
      }
      let label = planet.name ? planet.name : planet.dataId;
      planetData[planet.username] = uniq(concat(planetData[planet.username], [label]));
    });
    location.planetData = planetData;
  });
  return locations;
};

onmessage = function(e) {
  if (e.data.props) {
    postMessage({locations: updateLocations(e.data.props)});
  }
};