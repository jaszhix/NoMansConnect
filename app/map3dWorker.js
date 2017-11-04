const {uniq, uniqBy, concat} = require('lodash');
const {each, filter} = require('./lang');

const updateLocations = function(props) {
  let storedLocations = [];
  each(props.storedLocations, (location)=>{
    storedLocations.push({data: location});
  });

  let locations = props.remoteLocations.results.concat(storedLocations).concat(props.searchCache.results);

  let systems = uniqBy(locations, (location)=>{
    return location.data && location.data.translatedId;
  });
  each(systems, (location)=>{
    let planets = filter(locations, (planet)=>{
      return planet.data.translatedId === location.data.translatedId;
    });
    let planetData = {};
    each(planets, (planet)=>{
      if (!planetData[planet.data.username]) {
        planetData[planet.data.username] = [];
      }
      let label = planet.data.name ? planet.data.name : planet.data.id;
      planetData[planet.data.username] = uniq(concat(planetData[planet.data.username], [label]));
    });
    location.data.planetData = planetData;
  });
  return locations;
};

onmessage = function(e) {
  if (e.data.props) {
    postMessage({locations: updateLocations(e.data.props)});
  }
};