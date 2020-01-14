import {uniqBy, uniq, assignIn, orderBy} from 'lodash';
import {each, findIndex, filter} from '@jaszhix/utils';

const buildGalaxyOptions = function(state) {
  let options = [];
  let ids = [];
  let selectedGalaxy = state.selectedGalaxy;
  if (state.remoteLocations) {
    each(state.remoteLocations, (location) => {
      if (!location) {
        return;
      }
      if (location.galaxy == null || location.galaxy < 0) {
        location.galaxy = 0;
      }
      ids.push(location.galaxy);
    });
  }
  if (state.selectedLocation && state.selectedLocation.galaxy) {
    ids.push(state.selectedLocation.galaxy);
  }
  each(uniq(ids), (id) => {
    options.push({
      id,
      label: state.galaxies[id]
    });
  });
  const stateUpdate: State = {
    galaxyOptions: orderBy(options, 'id', 'asc')
  };

  if (state.init) {
    stateUpdate.selectedGalaxy = state.ps4User ? 0 : selectedGalaxy;
  }
  // @ts-ignore
  postMessage({buildGalaxyOptions: stateUpdate, init: state.init});
};

const getLocationsByTranslatedId = function(locations: NMSLocation[]) {
  if (!locations || !locations[0]) return null;

  each(locations, (location) => {
    if (!location) return;
    location.xyz = `${location.translatedX}${location.translatedY}${location.translatedZ}`;
  })

  let systems = uniqBy(locations, 'xyz');

  each(systems, (location) => {
    if (!location) return;

    let planets = filter(locations, (planet) => {
      if (!planet) return false;
      return (location.translatedX === planet.translatedX
        && location.translatedY === planet.translatedY
        && location.translatedZ === planet.translatedZ);
    });
    let planetData = [];

    each(planets, (planet) => {
      planet = planet ? planet : {data: planet};

      if (!planetData[planet.username]) {
        planetData[planet.username] = [];
      }

      let label = planet.name ? planet.name : planet.dataId;
      let refPlanetData = findIndex(planetData, item => item && item.username === planet.username);

      if (refPlanetData > -1) {
        let refEntry = planetData[refPlanetData].entries.indexOf(label);

        if (refEntry === -1) {
          planetData[refPlanetData].entries.push(label);
        }
      } else {
        planetData.push({
          username: planet.username,
          entries: [label]
        });
      }
    });

    location.planetData = planetData;
  });
  return systems
}

onmessage = function(e) {
  if (e.data.buildGalaxyOptions) {
    buildGalaxyOptions(e.data.buildGalaxyOptions);
    return;
  }
  let stateUpdate: State = {};
  let center = e.data.p.show.Center.value ? [{
    x: 2048,
    y: 2048,
    z: 127
  }] : [];

  e.data.p.remoteLocations = getLocationsByTranslatedId(e.data.p.remoteLocations);

  if (e.data.opts.locations) {
    Object.assign(stateUpdate, {
      currentLocation: [],
      locations: [],
      remoteLocations: [],
      favLocations: [],
      baseLocations: [],
      ps4Locations: [],
      selectedLocation: []
    })

    let friendKeys = [];
    each(e.data.p.show, (legendItem, key) => {
      if (e.data.p.defaultLegendKeys.indexOf(key) === -1) {
        friendKeys.push(key);
      }
    });

    if (e.data.p.remoteLocations && e.data.p.remoteLocations) {
      each(e.data.p.remoteLocations, (location) => {
        if (!location || location.galaxy !== e.data.p.selectedGalaxy) {
          return;
        }

        let obj: any = {
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: `${location.translatedX}:${location.translatedY}:${location.translatedZ}`,
          planetData: location.planetData
        };

        let matchedFriendKey = false;

        each(friendKeys, (key, i) => {
          let listKey = `${key}Locations`;
          if (!stateUpdate[listKey]) {
            stateUpdate[listKey] = [];
          }
          if (location.username === key) {
            matchedFriendKey = true;
            if (e.data.p.show[key].value) {
              stateUpdate[listKey].push(obj);
            }
          }
        });

        if (matchedFriendKey) {
          return;
        }

        switch (true) {
          case (e.data.p.selectedLocation
            && location.translatedX === e.data.p.selectedLocation.translatedX
            && location.translatedY === e.data.p.selectedLocation.translatedY
            && location.translatedZ === e.data.p.selectedLocation.translatedZ):
            if (e.data.p.show.Selected.value) {
              obj.selected = true;
              stateUpdate.selectedLocation = [obj];
            }
            break;
          case (location.dataId === e.data.p.currentLocation):
            if (e.data.p.show.Current.value) {
              stateUpdate.currentLocation.push(obj);
            }
            break;
          case (location.upvote):
            if (e.data.p.show.Favorite.value) {
              stateUpdate.favLocations.push(obj);
            }
            break;
          case (location.base):
            if (e.data.p.show.Base.value) {
              stateUpdate.baseLocations.push(obj);
            }
            break;
          case (location.username === e.data.p.username):
            if (e.data.p.show.Explored.value) {
              stateUpdate.locations.push(obj);
            }
            break;
          case (location.username !== e.data.p.username
            && (location.playerPosition
              || (location.positions.length
                && location.positions[0].playerPosition)
                && !location.manuallyEntered)):
            if (e.data.p.show.Shared.value) {
              stateUpdate.remoteLocations.push(obj);
            }
            break;
          default:
            if (e.data.p.show.PS4.value) {
              stateUpdate.ps4Locations.push(obj);
            }
        }
      });
    }
  }

  if (e.data.opts.size) {
    let zRange = [14, 32];
    let remoteLocationsWidth;
    if (e.data.p.remoteLocationsColumns === 1) {
      remoteLocationsWidth = 441;
    } else if (e.data.p.remoteLocationsColumns === 2) {
      remoteLocationsWidth = 902;
    } else {
      remoteLocationsWidth = 1300;
    }

    let size = e.data.p.width - (remoteLocationsWidth + 438);
    let maxSize = e.data.p.height - 105;
    size = size > maxSize ? maxSize : size < 260 ? 260 : size;

    assignIn(stateUpdate, {
      size,
      center,
      zRange
    });
  }
  // @ts-ignore
  postMessage(stateUpdate);
}

export default {} as typeof Worker & {new (): Worker};