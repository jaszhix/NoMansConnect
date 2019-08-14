import {uniq, uniqBy, concat} from 'lodash';
import {each, filter} from '@jaszhix/utils';

const updateLocations = function(props) {
  let storedLocations = [];
  each(props.storedLocations, (location: NMSLocation) => {
    storedLocations.push(location); // TBD
  });

  let locations = props.remoteLocations.results.concat(storedLocations).concat(props.searchCache.results);

  let systems = uniqBy(locations, (location: NMSLocation) => {
    return location && location.translatedId;
  });
  each(systems, (location: NMSLocation) => {
    let planets = filter(locations, (planet: NMSLocation) => {
      return planet.translatedId === location.translatedId;
    });
    let planetData = {};
    each(planets, (planet: any) => {
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
    // @ts-ignore
    postMessage({locations: updateLocations(e.data.props)});
  }
};

export default {} as typeof Worker & {new (): Worker};