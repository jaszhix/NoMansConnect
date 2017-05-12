const _ = require('lodash');

const each = require('./each');

onmessage = function(e) {
  let stateUpdate = {};

  let center = e.data.p.show.Center ? [{
    x: 2047,
    y: 2047,
    z: 127
  }] : [];

  if (e.data.opts.selectedLocation) {
    let selectedLocation = [];
    each(e.data.p.storedLocations, (location)=>{
      if (location.galaxy !== e.data.p.selectedGalaxy) {
        return;
      }
      if (e.data.p.selectedLocation && location.id === e.data.p.selectedLocation.id && e.data.p.show.Selected) {
        selectedLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          selected: true,
          id: location.id
        });
      }
    });
    if (!e.data.p.remoteLocations) {
      return;
    }
    each(e.data.p.remoteLocations.results, (location)=>{
      if (location.data.galaxy !== e.data.p.selectedGalaxy) {
        return;
      }
      if (e.data.p.selectedLocation && location.data.id === e.data.p.selectedLocation.id && e.data.p.show.Selected) {
        selectedLocation.push({
          x: location.data.translatedX,
          y: (0, 4096) - location.data.translatedZ,
          z: location.data.translatedY,
          selected: true,
          id: location.data.id
        });
      }
    });
    _.assignIn(stateUpdate, {
      selectedLocation: selectedLocation
    });
  }

  if (e.data.opts.locations) {
    let currentLocation = [];
    let locations = [];
    let remoteLocations = [];
    let favLocations = [];
    let baseLocations = [];
    each(e.data.p.storedLocations, (location)=>{
      if (location.galaxy !== e.data.p.selectedGalaxy) {
        return;
      }

      if (location.upvote && e.data.p.show.Favorite) {
        favLocations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else if (location.id === e.data.p.currentLocation && e.data.p.show.Current) {
        currentLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else if (location.base && e.data.p.show.Base) {
        baseLocations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      }
      if (e.data.p.show.Explored) {
        locations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      }
    });
    if (e.data.p.remoteLocations && e.data.p.remoteLocations.results) {
      each(e.data.p.remoteLocations.results, (location)=>{
        if (location.data.galaxy !== e.data.p.selectedGalaxy) {
          return;
        }
        if (location.data.upvote && e.data.p.show.Favorite) {
          favLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.data.id
          });
        } else if (location.data.id === e.data.p.currentLocation && e.data.p.show.Current) {
          currentLocation.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.data.base && e.data.p.show.Base) {
          baseLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.username !== e.data.p.username && e.data.p.show.Shared) {
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
      baseLocations: baseLocations
    });
  }

  if (e.data.opts.size) {
    let zRange = e.data.p.mapZoom ? [14, 64] : [22, 64];
    let ticks = e.data.p.mapZoom ? [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096] : [0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4096]

    let size = 480;
    if (e.data.p.width >= 1349 && e.data.p.height >= 1004) {
      size = 512;
    } else if (e.data.p.width <= 1152 || e.data.p.height <= 790) {
      size = 260;
    } else if (e.data.p.width <= 1212 || e.data.p.height <= 850) {
      size = 300;
    } else if (e.data.p.width <= 1254 || e.data.p.height <= 890) {
      size = 360;
    } else if (e.data.p.width <= 1290 || e.data.p.height <= 930) {
      size = 400;
    } else if (e.data.p.width <= 1328 || e.data.p.height <= 970) {
      size = 440;
    }

    size = e.data.p.mapZoom ? e.data.p.height - 105 : size;

    _.assignIn(stateUpdate, {
      size: size,
      center: center,
      zRange: zRange,
      ticks: ticks
    });
  }

  postMessage(stateUpdate);
}