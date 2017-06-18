const _ = require('lodash');

const each = require('./each');

onmessage = function(e) {
  let stateUpdate = {};
  let eData = JSON.parse(e.data);
  let center = eData.p.show.Center ? [{
    x: 2047,
    y: 2047,
    z: 127
  }] : [];

  if (eData.opts.selectedLocation) {
    let selectedLocation = [];
    each(eData.p.storedLocations, (location)=>{
      if (location.galaxy !== eData.p.selectedGalaxy) {
        return;
      }
      if (eData.p.selectedLocation && location.id === eData.p.selectedLocation.id && eData.p.show.Selected) {
        selectedLocation[0] = {
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          selected: true,
          id: location.id
        };
      }
    });
    if (eData.p.remoteLocations && eData.p.remoteLocations.results) {
      each(eData.p.remoteLocations.results, (location)=>{
        if (location.data.galaxy !== eData.p.selectedGalaxy) {
          return;
        }
        if (eData.p.selectedLocation && location.data.id === eData.p.selectedLocation.id && eData.p.show.Selected) {
          selectedLocation[0] = {
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            selected: true,
            id: location.data.id
          };
        }
      });
    }
    _.assignIn(stateUpdate, {
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

    each(eData.p.storedLocations, (location)=>{
      if (location.galaxy !== eData.p.selectedGalaxy) {
        return;
      }

      if (location.upvote && eData.p.show.Favorite) {
        favLocations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else if (location.id === eData.p.currentLocation && eData.p.show.Current) {
        currentLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else if (location.base && eData.p.show.Base) {
        baseLocations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      }
      if (eData.p.show.Explored) {
        locations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      }
    });
    if (eData.p.remoteLocations && eData.p.remoteLocations.results) {
      each(eData.p.remoteLocations.results, (location)=>{
        if (location.data.galaxy !== eData.p.selectedGalaxy) {
          return;
        }
        if (location.data.upvote && eData.p.show.Favorite) {
          favLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.data.id
          });
        } else if (location.data.id === eData.p.currentLocation && eData.p.show.Current) {
          currentLocation.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.data.base && eData.p.show.Base) {
          baseLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.username !== eData.p.username && !location.data.playerPosition && eData.p.show.PS4) {
          ps4Locations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            user: location.username,
            id: location.id
          });
        } else if (location.username !== eData.p.username && eData.p.show.Shared) {
          remoteLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            user: location.username,
            id: location.id
          });
        }
      });
    }

    _.assignIn(stateUpdate, {
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

    _.assignIn(stateUpdate, {
      size: size,
      center: center,
      zRange: zRange,
      ticks: ticks
    });
  }

  postMessage(JSON.stringify(stateUpdate));
}