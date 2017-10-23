const {isArray, uniqBy, assignIn} = require('lodash');
const {each, findIndex, filter} = require('./lang');

const getLocationsByTranslatedId = (locations)=>{
  if (!locations) {
    return null;
  }
  if (isArray(locations)) {
    locations = {results: locations}
  }
  let systems = uniqBy(locations.results, (location)=>{
    location = location.data ? location : {data: location};
    return location.data.translatedX && location.data.translatedY && location.data.translatedZ;
  });
  each(systems, (location, i)=>{
    systems[i] = location.data ? location : {data: location};
    location = systems[i];
    let planets = filter(locations.results, (planet)=>{
      planet = planet.data ? planet : {data: planet};
      return (location.data.translatedX === planet.data.translatedX
        && location.data.translatedY === planet.data.translatedY
        && location.data.translatedZ === planet.data.translatedZ);
    });
    let planetData = [];
    each(planets, (planet)=>{
      planet = planet.data ? planet : {data: planet};
      if (!planetData[planet.data.username]) {
        planetData[planet.data.username] = [];
      }
      let label = planet.data.name ? planet.data.name : planet.data.id;
      let refPlanetData = findIndex(planetData, item => item.username === planet.data.username);
      if (refPlanetData > -1) {
        let refEntry = planetData[refPlanetData].entries.indexOf(label);
        if (refEntry === -1) {
          planetData[refPlanetData].entries.push(label);
        }
      } else {
        planetData.push({
          username: planet.data.username,
          entries: [label]
        });
      }
    });
    location.data.planetData = planetData;
  });
  locations.results = systems;
  return locations;
}

onmessage = function(e) {
  let stateUpdate = {};
  let eData = JSON.parse(e.data);
  let center = eData.p.show.Center ? [{
    x: 2047,
    y: 2047,
    z: 127
  }] : [];

  eData.p.storedLocations = getLocationsByTranslatedId(eData.p.storedLocations);
  eData.p.remoteLocations = getLocationsByTranslatedId(eData.p.remoteLocations);

  if (eData.opts.selectedLocation) {
    let selectedLocation = [];
    each(eData.p.storedLocations.results, (location)=>{
      if (location.galaxy !== eData.p.selectedGalaxy) {
        return;
      }
      if (eData.p.selectedLocation && location.id === eData.p.selectedLocation.id && eData.p.show.Selected) {
        selectedLocation[0] = {
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          selected: true,
          id: `${location.data.translatedZ}:${location.data.translatedY}:${location.data.translatedX}`,
          planetData: location.data.planetData,
        };
      }
    });
    if (eData.p.remoteLocations && eData.p.remoteLocations.results) {
      each(eData.p.remoteLocations.results, (location)=>{
        if (location.data.galaxy !== eData.p.selectedGalaxy) {
          return;
        }
        if (eData.p.selectedLocation && eData.p.show.Selected
          && location.data.translatedX === eData.p.selectedLocation.translatedX
          && location.data.translatedY === eData.p.selectedLocation.translatedY
          && location.data.translatedZ === eData.p.selectedLocation.translatedZ) {
          selectedLocation[0] = {
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            selected: true,
            id: `${location.data.translatedX}:${location.data.translatedY}:${location.data.translatedZ}`,
            planetData: location.data.planetData
          };
        }
      });
    }
    assignIn(stateUpdate, {
      selectedLocation: selectedLocation
    });
  }

  if (eData.opts.locations) {
    let currentLocation = [];
    let locations = [];
    let remoteLocations = [];
    let favLocations = [];
    let baseLocations = [];
    let ps4Locations = []

    each(eData.p.storedLocations.results, (location)=>{
      if (location.data.galaxy !== eData.p.selectedGalaxy) {
        return;
      }
      let obj = {
        x: location.data.translatedX,
        y: (0, 4096) - location.data.translatedZ,
        z: location.data.translatedY,
        id: `${location.data.translatedZ}:${location.data.translatedY}:${location.data.translatedX}`,
        planetData: location.data.planetData,
        stored: true
      };
      if (location.data.upvote && eData.p.show.Favorite) {
        favLocations.push(obj);
      } else if (location.data.id === eData.p.currentLocation && eData.p.show.Current) {
        currentLocation.push(obj);
      } else if (location.locationbase && eData.p.show.Base) {
        baseLocations.push(obj);
      }
      if (eData.p.show.Explored) {
        locations.push(obj);
      }
    });
    if (eData.p.remoteLocations && eData.p.remoteLocations.results) {
      each(eData.p.remoteLocations.results, (location)=>{
        if (location.data.galaxy !== eData.p.selectedGalaxy) {
          return;
        }
        let obj = {
          x: location.data.translatedX,
          y: (0, 4096) - location.data.translatedZ,
          z: location.data.translatedY,
          id: `${location.data.translatedZ}:${location.data.translatedY}:${location.data.translatedX}`,
          planetData: location.data.planetData
        };
        if (location.data.upvote && eData.p.show.Favorite) {
          favLocations.push(obj);
        } else if (location.data.id === eData.p.currentLocation && eData.p.show.Current) {
          currentLocation.push(obj);
        } else if (location.data.base && eData.p.show.Base) {
          baseLocations.push(obj);
        } else if (location.username !== eData.p.username && (!location.data.playerPosition || location.data.manuallyEntered) && eData.p.show.PS4) {
          ps4Locations.push(obj);
        } else if (location.username !== eData.p.username && eData.p.show.Shared) {
          remoteLocations.push(obj);
        }
      });
    }

    assignIn(stateUpdate, {
      currentLocation: currentLocation,
      locations: locations,
      remoteLocations: remoteLocations,
      favLocations: favLocations,
      baseLocations: baseLocations,
      ps4Locations: ps4Locations
    });
  }

  if (eData.opts.size) {
    let zRange = [14, 64];
    let ticks = [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096];

    let remoteLocationsWidth;
    if (eData.p.remoteLocationsColumns === 1) {
      remoteLocationsWidth = 441;
    } else if (eData.p.remoteLocationsColumns === 2) {
      remoteLocationsWidth = 902;
    } else {
      remoteLocationsWidth = 1300;
    }

    let size = eData.p.width - (remoteLocationsWidth + 438);
    let maxSize = eData.p.height - 105;
    size = size > maxSize ? maxSize : size < 260 ? 260 : size;

    assignIn(stateUpdate, {
      size: size,
      center: center,
      zRange: zRange,
      ticks: ticks
    });
  }

  postMessage(JSON.stringify(stateUpdate));
}