import log from './log';
import state from './state';
import React from 'react';
import {cloneDeep, orderBy, uniq, uniqBy} from 'lodash';

import {ajaxWorker, copyMetadata} from './utils';
import {handleRestart} from './dialog';
import {each, find, findIndex, filter} from './lang';

import GalacticMap from './map';
import LocationBox from './locationBox';
import StoredLocations from './storedLocations';
import RemoteLocations from './remoteLocations';

const empty = []

class Container extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      updating: false,
      edit: false,
      mapRender: '<div />'
    };
    this.connectId = state.connect({
      selectedLocation: () => {
        if (this.willUnmount || !this.state.edit) {
          return;
        }
        this.setState({edit: false})
      },
      handleFavorite: (location) => this.handleFavorite(location),
      updateLocation: (location) => this.updateLocation(location)
    })
  }
  componentWillUnmount() {
    this.willUnmount = true;
    state.disconnect(this.connectId);
  }
  handleFavorite = (location) => {
    if (this.props.s.offline) {
      state.set({error: `Unable to favorite location in offline mode.`});
      return;
    }
    let refFav = findIndex(this.props.s.favorites, (fav) => {
      return fav === location.dataId;
    });
    let upvote = refFav === -1;
    let {storedLocations, remoteLocations, machineId, username, favorites} = this.props.s;

    ajaxWorker.post('/nmslocation/', {
      machineId: machineId,
      username: username,
      score: location.score,
      upvote: upvote,
      dataId: location.dataId,
      action: 1
    }).then((res) => {
      res.data.upvote = upvote;

      let refRemoteLocation = findIndex(remoteLocations.results, (location) => {
        return location.dataId === res.data.dataId;
      });
      if (refRemoteLocation > -1) {
        remoteLocations.results[refRemoteLocation] = res.data;
      }
      let refLocation = findIndex(storedLocations, _location => _location.dataId === location.dataId);
      if (upvote) {
        if (refLocation > -1) {
          storedLocations[refLocation] = res.data;
        } else {
          storedLocations.push(res.data);
        }
        favorites.push(location.dataId);
      } else {
        favorites.splice(refFav, 1);
        if (refLocation > -1) {
          storedLocations.splice(refLocation, 1);
        }
      }
      state.set({
        storedLocations,
        remoteLocations,
        favorites: uniq(favorites)
      });
    }).catch((err) => {
      log.error(`Failed to favorite remote location: ${err}`);
    });
  }
  handleUpdate = (name, description) => {
    this.setState({updating: true}, () => {
      if (description.length > 200) {
        this.setState({limit: true});
        return;
      }
      const update = () => {
        let refLocation = findIndex(this.props.s.storedLocations, location => location.dataId === this.props.s.selectedLocation.dataId);
        if (refLocation !== -1) {
          this.props.s.storedLocations[refLocation].name = name;
          this.props.s.storedLocations[refLocation].description = description;
        }
        let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
          return location.dataId === this.props.s.selectedLocation.dataId;
        });
        if (refRemoteLocation !== -1) {
          this.props.s.remoteLocations.results[refRemoteLocation].name = name;
          this.props.s.remoteLocations.results[refRemoteLocation].description = description;
        }
        this.props.s.selectedLocation.name = name;
        this.props.s.selectedLocation.description = description;
        state.set({
          storedLocations: this.props.s.storedLocations,
          remoteLocations: this.props.s.remoteLocations,
          selectedLocation: this.props.s.selectedLocation
        }, () => {
          if (this.willUnmount) return;
          this.setState({
            updating: false,
            edit: false
          });
        });
      };

      if (this.props.s.offline) {
        update();
        return;
      }

      ajaxWorker.post('/nmslocation/', {
        machineId: this.props.s.machineId,
        username: this.props.s.username,
        name,
        description,
        dataId: this.props.s.selectedLocation.dataId,
        action: 1
      }).then((res) => {
        update();
      }).catch((err) => {
        log.error(`Failed to update remote location: ${err}`);
      });
    });
  }
  updateLocation = (location) => {
    ajaxWorker.put(`/nmslocation/${location.dataId}/`, {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      ...location
    }).then((res) => {
      let {remoteLocations, storedLocations} = this.props.s;
      let stateUpdate = {};
      let refRemote = findIndex(remoteLocations.results, (location) => location.dataId === res.data.dataId);
      let refStored = findIndex(storedLocations, (location) => location.dataId === res.data.dataId);
      if (refRemote > -1) {
        remoteLocations.results[refRemote] = res.data;
        stateUpdate.remoteLocations = remoteLocations;
      }
      if (refStored > -1) {
        storedLocations[refStored] = res.data;
        stateUpdate.storedLocations = storedLocations;
      }
      state.set(stateUpdate);
    })
  }
  handleUploadScreen = (e) => {
    e.persist();
    if (this.props.s.offline) {
      state.set({error: `Unable to upload screenshot in offline mode.`});
      return;
    }
    this.setState({updating: true}, () => {
      var reader = new FileReader();
      reader.onload = (e)=> {
        var sourceImage = new Image();
        sourceImage.onload = ()=> {
          var imgWidth = sourceImage.width;
          var imgHeight = sourceImage.height;
          var canvas = document.createElement("canvas");
          canvas.width = imgWidth;
          canvas.height = imgHeight;
          canvas.getContext('2d').drawImage(sourceImage, 0, 0, imgWidth, imgHeight);
          var newDataUri = canvas.toDataURL('image/jpeg', 0.75);
          if (newDataUri) {
            ajaxWorker.post('/nmslocation/', {
              machineId: this.props.s.machineId,
              username: this.props.s.username,
              imageU: newDataUri,
              dataId: this.props.s.selectedLocation.dataId,
              action: 1
            }).then((res) => {
              let refLocation = findIndex(this.props.s.storedLocations, location => location.dataId === this.props.s.selectedLocation.dataId);
              if (refLocation !== -1) {
                this.props.s.storedLocations[refLocation].image = res.data.image;
              }
              let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
                return location.dataId === this.props.s.selectedLocation.dataId;
              });
              if (refRemoteLocation !== -1) {
                this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
              }
              this.props.s.selectedLocation.image = res.data.image;
              state.set({
                storedLocations: this.props.s.storedLocations,
                remoteLocations: this.props.s.remoteLocations,
                selectedLocation: this.props.s.selectedLocation
              }, () => {
                if (this.willUnmount) return;
                this.setState({
                  updating: false,
                  edit: false
                });
              });
            }).catch((err) => {
              log.error(`Failed to upload screenshot: ${err}`);
            });
          }
        };
        sourceImage.src = reader.result;
        this.screenshotRef.value = '';
      };
      reader.readAsDataURL(e.target.files[0]);
    });
  }
  handleDeleteScreen = () => {
    if (this.props.s.offline) {
      state.set({error: `Unable to delete screenshot in offline mode.`});
      return;
    }
    ajaxWorker.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      imageD: true,
      dataId: this.props.s.selectedLocation.dataId,
      action: 1
    }).then((res) => {
      let refLocation = findIndex(this.props.s.storedLocations, location => location.dataId === this.props.s.selectedLocation.dataId);
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].image = res.data.image;
      }
      let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
        return location.dataId === this.props.s.selectedLocation.dataId;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
      }
      this.props.s.selectedLocation.image = '';
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        selectedLocation: this.props.s.selectedLocation
      }, () => {
        if (this.willUnmount) return;
        this.setState({
          updating: false,
          edit: false
        });
      });
    });
  }
  handleCompatibility = () => {
    if (this.props.s.offline) {
      state.set({error: 'Unable to mark compatibility in offline mode.'});
      return;
    }
    if (!this.props.s.saveVersion) {
      state.set({error: 'No save version metadata found. Do you have a save directory recognized by NMC in settings?'});
      return;
    }
    ajaxWorker.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      version: this.props.s.saveVersion,
      dataId: this.props.s.selectedLocation.dataId,
      action: 1
    }).then((res) => {
      let refLocation = findIndex(this.props.s.storedLocations, location => location.dataId === this.props.s.selectedLocation.dataId);
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].version = res.data.version;
      }
      let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
        return location.dataId === this.props.s.selectedLocation.dataId;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].version = res.data.version;
      }
      this.props.s.selectedLocation.version = res.data.version;
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        selectedLocation: this.props.s.selectedLocation
      }, () => {
        if (this.willUnmount) return;
        this.setState({
          updating: false,
          edit: false
        });
      });
    });
  }
  handleSelectLocation = (location) => {
    let deselected = this.props.s.selectedLocation && this.props.s.selectedLocation.dataId === location.dataId;
    let _location = null;
    if (!deselected) {
      let refRemoteLocation = find(this.props.s.remoteLocations.results, (remoteLocation) => {
        return remoteLocation.dataId === location.dataId;
      });
      if (refRemoteLocation) {
        _location = copyMetadata(refRemoteLocation, location, ['isHidden', 'positions', 'version']);
      } else {
        log.error(`Unable to find reference remote location from stored locations cache: ${location.dataId} (fetching)`);
        if (this.props.s.offline) {
          _location = location;
        } else {
          ajaxWorker.post('/nmsfavoritesync/', {
            machineId: state.machineId,
            username: state.username,
            locations: [location.dataId]
          }).then((res) => {
            _location = res.data[0];
            let {remoteLocations} = this.props.s;
            remoteLocations.results.push(res.data[0]);
            remoteLocations.results = uniqBy(remoteLocations.results, 'dataId');
            state.set({
              remoteLocations,
              remoteLength: remoteLocations.results.length,
              selectedLocation: deselected ? null : _location,
              selectedGalaxy: deselected ? 0 : _location.galaxy,
              multiSelectedLocation: false
            });
          }).catch((err) => log.error(err));
          return;
        }

      }
    }
    location = undefined;

    if (state.searchInProgress) {
      state.trigger('handleClearSearch');
    }

    state.set({
      selectedLocation: deselected ? null : _location,
      selectedGalaxy: deselected ? 0 : _location.galaxy,
      multiSelectedLocation: false
    });
  }
  toggleEdit = () => {
    this.setState({edit: !this.state.edit});
  }
  screenshotRefClick = () => {
    this.screenshotRef.click();
  }
  getScreenshotRef = (ref) => {
    this.screenshotRef = ref;
  }
  render() {
    let p = this.props;
    let {
      storedLocations,
      favorites,
      remoteLocations,
      remoteLocationsColumns,
      multiSelectedLocation,
      selectedLocation,
      selectedGalaxy,
      galaxyOptions,
      currentLocation,
      searchCache,
      sortStoredByKey,
      sortStoredByTime,
      filterOthers,
      showHidden,
      filterStoredByBase,
      filterStoredByScreenshot,
      useGAFormat,
      showOnlyBases,
      showOnlyCompatible,
      showOnlyDesc,
      showOnlyFriends,
      showOnlyGalaxy,
      showOnlyNames,
      showOnlyPC,
      showOnlyScreenshots,
      sortByDistance,
      sortByModded,
      username,
      profile,
      saveVersion,
      height,
      width,
      ps4User,
      configDir,
      mapLoading,
      map3d,
      mapDrawDistance,
      mapLines,
      show,
      navLoad
    } = p.s;

    let isOwnLocation = findIndex(storedLocations, (location) => location && location.dataId === (selectedLocation ? selectedLocation.dataId : null)) > -1;
    let remoteLocationsLoaded = remoteLocations && remoteLocations.results || searchCache.results.length > 0;

    let direction = sortStoredByKey === 'created' || sortStoredByKey === 'description' ? 'desc' : 'asc';
    let storedFavorites = [];
    let storedNonFavorites = [];

    let validLocations = [];
    each(storedLocations, (location) => {
      if (!location) return;
      location.created = new Date(location.created).getTime();
      location.description = location.description ? location.description.trim() : '';
      validLocations.push(location);
    });
    storedLocations = validLocations; // Temporary migration workaround

    let storedSortFunction = (location) => {
      if (sortStoredByKey === 'name') {
        return location.name || useGAFormat ? location.translatedId : location.dataId;
      } else {
        return location[sortStoredByKey];
      }
    };

    if (filterOthers) {
      storedLocations = filter(storedLocations, (location) => {
        return location.username === username;
      });
    }
    if (!showHidden) {
      storedLocations = filter(storedLocations, (location) => {
        return !location.isHidden;
      });
    }
    if (filterStoredByBase) {
      storedLocations = filter(storedLocations, (location) => {
        return location.base && location.baseData;
      });
    }
    if (filterStoredByScreenshot) {
      storedLocations = filter(storedLocations, (location) => {
        return location.image;
      });
    }
    if (sortStoredByTime) {
      storedLocations = orderBy(storedLocations, storedSortFunction, direction);
    } else {
      storedFavorites = orderBy(
        filter(storedLocations, (location) => {
          return favorites.indexOf(location.dataId) > -1;
        }),
        sortStoredByKey,
        direction
      );
      storedNonFavorites = orderBy(
        filter(storedLocations, (location) => {
          return favorites.indexOf(location.dataId) === -1;
        }),
        sortStoredByKey,
        direction
      );
      storedLocations = storedFavorites.concat(storedNonFavorites);
    }

    let storedCurrentLocation = findIndex(storedLocations, (location) => location.dataId === currentLocation);
    if (storedCurrentLocation > -1) {
      let current = cloneDeep(storedLocations[storedCurrentLocation]);
      storedLocations.splice(storedCurrentLocation, 1);
      storedLocations = [current].concat(storedLocations);
    }

    let isSelectedLocationRemovable = false;
    if (p.s.selectedLocation) {
      let refLocation = findIndex(storedLocations, location => location.dataId === selectedLocation.dataId);
      isSelectedLocationRemovable = refLocation !== -1;
    }

    let locations = p.s.remoteLocations.results;
    if (showOnlyScreenshots) {
      locations = filter(locations, (location)=>{
        return location.image.length > 0;
      });
    }
    if (showOnlyNames) {
      locations = filter(locations, (location)=>{
        return location.name && location.name.length > 0;
      });
    }
    if (showOnlyDesc) {
      locations = filter(locations, (location)=>{
        return location.description && location.description.length > 0;
      });
    }
    if (showOnlyGalaxy) {
      locations = filter(locations, (location)=>{
        return location.galaxy === p.s.selectedGalaxy;
      });
    }
    if (showOnlyBases) {
      locations = filter(locations, (location)=>{
        return location.base;
      });
    }
    if (showOnlyCompatible && saveVersion) {
      locations = filter(locations, (location)=>{
        return location.version === saveVersion || location.version === saveVersion;
      });
    }
    if (showOnlyPC) {
      locations = filter(locations, (location)=>{
        return location.playerPosition && !location.manuallyEntered;
      });
    }
    if (profile && showOnlyFriends) {
      locations = filter(locations, (location)=>{
        return (
          findIndex(profile.friends, (friend) => {
            return (location.profile && friend.username === location.profile.username) || friend.username === location.username;
          }) > -1
          || (location.profile && location.profile.username === profile.username)
        );
      });
    }
    if (sortByDistance || sortByModded) {
      locations = orderBy(locations, (location)=>{
        if (!location.mods) {
          location.mods = [];
        }
        if (sortByModded && sortByDistance) {
          return location.mods.length + location.distanceToCenter;
        } else if (sortByDistance) {
          return location.distanceToCenter;
        } else if (sortByModded) {
          return location.mods.length;
        }
      });
    }
    return (
      <div className="ui grid row Container__root">
        <input
        className="hide"
        ref={this.getScreenshotRef}
        onChange={this.handleUploadScreen}
        type="file"
        accept="image/*"
        multiple={false} />
        <div className="columns">
          <div className="ui segments stackable grid container Container__left">
            <StoredLocations
            onSelect={this.handleSelectLocation}
            storedLocations={storedLocations}
            selectedLocationId={selectedLocation ? selectedLocation.dataId : null}
            multiSelectedLocation={multiSelectedLocation}
            currentLocation={currentLocation}
            height={height}
            filterOthers={filterOthers}
            showHidden={showHidden}
            sortStoredByTime={sortStoredByTime}
            sortStoredByKey={sortStoredByKey}
            filterStoredByBase={filterStoredByBase}
            filterStoredByScreenshot={filterStoredByScreenshot}
            useGAFormat={useGAFormat}
            username={username} />
            <div className="ui segments Container__mapAndSelected">
              {remoteLocationsLoaded ?
              <GalacticMap
              mapLoading={mapLoading}
              map3d={map3d}
              mapDrawDistance={mapDrawDistance}
              mapLines={mapLines}
              galaxyOptions={galaxyOptions}
              selectedGalaxy={selectedGalaxy}
              storedLocations={storedLocations}
              width={width}
              height={height}
              remoteLocationsColumns={remoteLocationsColumns}
              remoteLocations={locations}
              selectedLocation={selectedLocation}
              currentLocation={currentLocation}
              username={p.s.username}
              show={show}
              onRestart={handleRestart}
              onSearch={p.onSearch}
              searchCache={searchCache.results}
              friends={profile ? profile.friends : empty} /> : null}
              {selectedLocation && !multiSelectedLocation ?
              <LocationBox
              name={selectedLocation.name}
              description={selectedLocation.description}
              username={username}
              selectType={true}
              currentLocation={currentLocation}
              isOwnLocation={isOwnLocation}
              isVisible={true}
              location={selectedLocation}
              navLoad={navLoad}
              updating={this.state.updating}
              edit={this.state.edit}
              favorites={favorites}
              image={selectedLocation.image}
              version={selectedLocation.version === saveVersion}
              width={width}
              height={height}
              isSelectedLocationRemovable={isSelectedLocationRemovable}
              onUploadScreen={this.screenshotRefClick}
              onDeleteScreen={this.handleDeleteScreen}
              onFav={this.handleFavorite}
              onEdit={this.toggleEdit}
              onMarkCompatible={this.handleCompatibility}
              onRemoveStoredLocation={p.onRemoveStoredLocation}
              onSubmit={this.handleUpdate}
              onSaveBase={p.onSaveBase}
              ps4User={ps4User}
              configDir={configDir} /> : null}
            </div>
          </div>
        </div>
        {remoteLocationsLoaded ?
        <RemoteLocations
        s={p.s}
        onSearch={p.onSearch}
        locations={locations}
        currentLocation={currentLocation}
        isOwnLocation={isOwnLocation}
        updating={this.state.updating}
        onPagination={p.onPagination}
        onFav={this.handleFavorite}
        onSaveBase={p.onSaveBase}
        ps4User={ps4User} /> : null}
      </div>
    );
  }
};

export default Container;