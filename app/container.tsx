import React from 'react';
import {cloneDeep, orderBy, uniq, uniqBy} from 'lodash';
import {each, find, findIndex, filter} from '@jaszhix/utils';

import log from './log';
import state from './state';
import {ajaxWorker, copyMetadata} from './utils';
import {handleRestart} from './dialog';

import ErrorBoundary from './errorBoundary';
import GalacticMap from './map';
import LocationBox from './locationBox';
import StoredLocations from './storedLocations';
import RemoteLocations from './remoteLocations';

interface ContainerProps {
  s: GlobalState;
  onRemoveStoredLocation: () => void;
  onPagination: Function;
}

interface ContainerState {
  updating: boolean;
  edit: boolean;
  positionEdit: boolean;
  limit: boolean;
  mapRender: string;
}

class Container extends React.Component<ContainerProps, ContainerState> {
  connectId: number;
  willUnmount: boolean;
  screenshotRef: HTMLInputElement;

  constructor(props) {
    super(props);

    this.state = {
      updating: false,
      edit: false,
      positionEdit: false,
      limit: false,
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
      updateLocation: (location) => this.updateLocation(location),
      updateCachedLocation: (...args: [string, object, boolean]) => this.handleCachedLocationUpdate(...args)
    });
  }
  componentWillUnmount() {
    this.willUnmount = true;
    state.disconnect(this.connectId);
  }
  handleFavorite = (location) => {
    const {storedLocations, remoteLocations, machineId, username, favorites, offline} = this.props.s;
    const {updating} = this.state;
    let favIndex: number, upvote: boolean;

    if (offline) {
      state.set({error: `Unable to favorite location in offline mode.`});
      return;
    }

    if (!updating) {
      this.setState({updating: true}, () => this.handleFavorite(location));
      return;
    }

    favIndex = findIndex(favorites, (fav) => {
      return fav === location.dataId;
    });

    upvote = favIndex === -1;

    ajaxWorker.post('/nmslocation/', {
      machineId,
      username,
      score: location.score,
      upvote,
      dataId: location.dataId,
      action: 1
    }).then((res) => {
      const {modified, dataId} = res.data;

      let location = find(remoteLocations.results, (location) => {
        return location.dataId === dataId;
      });

      if (location) {
        location.upvote = upvote;
        location.modified = modified;
      }

      location = find(storedLocations, _location => _location.dataId === location.dataId);

      if (location) {
        location.upvote = upvote;
        location.modified = modified;
      } else {
        storedLocations.push(res.data);
      }

      if (upvote) {
        favorites.push(location.dataId);
      } else {
        favorites.splice(favIndex, 1);
      }

      state.set({
        storedLocations,
        remoteLocations,
        favorites: uniq(favorites)
      }, true);

      this.setState({updating: false});
    }).catch((err) => {
      log.error(`Failed to favorite remote location: ${err}`);
    });
  }
  handleCachedLocationUpdate = (dataId: string, location: any, remove = false) => {
    let {remoteLocations, storedLocations} = this.props.s;
    dataId = location ? location.dataId : dataId;
    let refIndex = findIndex(remoteLocations.results, (_location) => _location.dataId === location.dataId);

    if (refIndex === -1) {
      remoteLocations.results.push(location);
    } else {
      if (remove) {
        remoteLocations.results.splice(refIndex, 1);
      } else if (location) {
        remoteLocations.results[refIndex] = location;
      }
    }

    refIndex = findIndex(storedLocations, (_location) => _location.dataId === location.dataId);

    if (refIndex > -1) {
      storedLocations[refIndex] = location;

      window.settingsWorker.postMessage({
        method: 'set',
        key: 'storedLocations',
        value: storedLocations,
      });
    }

    window.jsonWorker.postMessage({
      method: 'set',
      key: 'remoteLocations',
      value: remoteLocations,
    });
  }
  handleLocationMetadataUpdate = (name, description, tags) => {
    const {storedLocations, remoteLocations, selectedLocation, offline, machineId, username} = this.props.s;

    this.setState({updating: true}, () => {
      if (description.length > 200) {
        this.setState({limit: true});
        return;
      }
      const update = () => {


        let refLocation = findIndex(storedLocations, location => location.dataId === selectedLocation.dataId);

        if (refLocation !== -1) {
          storedLocations[refLocation].name = name;
          storedLocations[refLocation].description = description;
          storedLocations[refLocation].tags = tags;
          storedLocations[refLocation].dirty = offline;
        }

        let refRemoteLocation = findIndex(remoteLocations.results, (location) => {
          return location.dataId === selectedLocation.dataId;
        });

        if (refRemoteLocation !== -1) {
          remoteLocations.results[refRemoteLocation].name = name;
          remoteLocations.results[refRemoteLocation].description = description;
          remoteLocations.results[refRemoteLocation].tags = tags;
        }

        selectedLocation.name = name;
        selectedLocation.description = description;
        selectedLocation.tags = tags;

        window.settingsWorker.postMessage({
          method: 'set',
          key: 'storedLocations',
          value: storedLocations,
        });

        window.jsonWorker.postMessage({
          method: 'set',
          key: 'remoteLocations',
          value: remoteLocations,
        });

        state.set({
          selectedLocation
        }, () => {
          if (this.willUnmount) return;

          this.setState({
            updating: false,
            edit: false
          });
        });
      };

      if (offline) {
        update();
        return;
      }

      ajaxWorker.post('/nmslocation/', {
        machineId,
        username,
        name,
        description,
        tags,
        dataId: selectedLocation.dataId,
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
      let stateUpdate: GlobalState = {};
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

      state.set(stateUpdate, true);
    })
  }
  handleUploadScreen = (e) => {
    e.persist();

    const {offline, machineId, username, selectedLocation, storedLocations, remoteLocations} = this.props.s;

    if (offline) {
      state.set({error: `Unable to upload screenshot in offline mode.`});
      return;
    }
    this.setState({updating: true}, () => {
      let reader = new FileReader();
      reader.onload = (e)=> {
        let sourceImage: HTMLImageElement = new Image();
        sourceImage.onload = ()=> {
          let imgWidth = sourceImage.width;
          let imgHeight = sourceImage.height;
          let canvas = document.createElement("canvas");
          canvas.width = imgWidth;
          canvas.height = imgHeight;
          canvas.getContext('2d').drawImage(sourceImage, 0, 0, imgWidth, imgHeight);
          let newDataUri = canvas.toDataURL('image/jpeg', 0.75);
          if (newDataUri) {
            ajaxWorker.post('/nmslocation/', {
              machineId,
              username,
              imageU: newDataUri,
              dataId: selectedLocation.dataId,
              action: 1
            }).then((res) => {
              let refLocation = findIndex(storedLocations, (location) => location.dataId === selectedLocation.dataId);
              if (refLocation !== -1) {
                storedLocations[refLocation].image = res.data.image;
              }
              let refRemoteLocation = findIndex(remoteLocations.results, (location) => {
                return location.dataId === selectedLocation.dataId;
              });
              if (refRemoteLocation !== -1) {
                remoteLocations.results[refRemoteLocation].image = res.data.image;
              }
              selectedLocation.image = res.data.image;
              state.set({
                storedLocations,
                remoteLocations,
                selectedLocation
              }, () => {
                if (this.willUnmount) return;
                this.setState({
                  updating: false,
                  edit: false
                });

                state.trigger('updateScreenshot', selectedLocation);
              }, true);
            }).catch((err) => {
              log.error(`Failed to upload screenshot: ${err}`);
            });
          }
        };
        // @ts-ignore
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
        }, () => setTimeout(() => state.trigger('markStoredLocationsDirty'), 25));
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

  handleVisibility = (location: NMSLocation) => {
    location.private = !location.private;
    this.updateLocation(location);
  }

  handleSelectLocation = (location: NMSLocation) => {
    let deselected = this.props.s.selectedLocation && this.props.s.selectedLocation.dataId === location.dataId;
    let _location: NMSLocation = null;
    let currentLocation: NMSLocation = null;

    if (!deselected) {
      let refRemoteLocation = find(this.props.s.remoteLocations.results, (remoteLocation) => {
        return remoteLocation && remoteLocation.dataId === location.dataId;
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
            let stateUpdate: GlobalState = {};

            if (res.data[0]) {
              _location = res.data[0];
              let {remoteLocations} = this.props.s;
              remoteLocations.results.push(_location);
              remoteLocations.results = uniqBy(remoteLocations.results, 'dataId');
              stateUpdate.remoteLocations = remoteLocations;
              stateUpdate.remoteLength = remoteLocations.results.length;
            } else {
              _location = location;
            }

            state.set(
              Object.assign(stateUpdate, {
                selectedLocation: _location,
                selectedGalaxy: _location.galaxy,
                multiSelectedLocation: false
              })
            );
          }).catch((err) => log.error('Container.handleSelectLocation: ', err));
          return;
        }

      }
    }
    location = undefined;

    if (state.searchInProgress) {
      state.trigger('handleClearSearch');
    }

    currentLocation = find(this.props.s.storedLocations, (location) => location.dataId === this.props.s.currentLocation);

    state.set({
      selectedLocation: deselected ? null : _location,
      selectedGalaxy: deselected ? currentLocation && currentLocation.galaxy || 0 : _location.galaxy,
      multiSelectedLocation: false
    });
  }
  toggleEdit = () => {
    this.setState({edit: !this.state.edit});
  }
  togglePositionEdit = (value?) => {
    this.setState({positionEdit: value != null ? value : !this.state.positionEdit});
  }
  screenshotRefClick = () => {
    this.screenshotRef.click();
  }
  getScreenshotRef = (ref) => {
    this.screenshotRef = ref;
  }
  resetLocationBox = () => state.set({selectedLocation: null})
  resetGalacticMap = () => state.set({showMap: false})
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
      username,
      profile,
      saveVersion,
      height,
      width,
      ps4User,
      map3d,
      mapDrawDistance,
      mapLODFar,
      mapSkyBox,
      mapLines,
      show,
      showMap,
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
        return location.username === username || location.dataId === currentLocation;
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
      // @ts-ignore
      storedLocations = orderBy(storedLocations, storedSortFunction, direction);
    } else {
      storedFavorites = orderBy(
        filter(storedLocations, (location) => {
          return favorites.indexOf(location.dataId) > -1;
        }),
        sortStoredByKey,
        // @ts-ignore
        direction
      );
      storedNonFavorites = orderBy(
        filter(storedLocations, (location) => {
          return favorites.indexOf(location.dataId) === -1;
        }),
        sortStoredByKey,
        // @ts-ignore
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

    let locations = filter(p.s.remoteLocations.results || [], (location) => location != null);
    if (showOnlyScreenshots) {
      locations = filter(locations, (location)=>{
        return location.image && location.image.length > 0;
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
        return !location.manuallyEntered;
      });
    }
    if (profile && showOnlyFriends) {
      locations = filter(locations, (location)=>{
        if (!location) return false;
        return (
          findIndex(profile.friends, (friend) => {
            return (location.profile && friend.username === location.profile.username) || friend.username === location.username;
          }) > -1
          || (location.profile && location.profile.username === profile.username)
        );
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
            <ErrorBoundary>
              <StoredLocations
              onSelect={this.handleSelectLocation}
              storedLocations={storedLocations}
              selectedLocationId={selectedLocation ? selectedLocation.dataId : null}
              selectedLocationEdit={this.state.edit}
              selectedLocationPositionEdit={this.state.positionEdit}
              multiSelectedLocation={multiSelectedLocation}
              currentLocation={currentLocation}
              favorites={favorites}
              height={height}
              filterOthers={filterOthers}
              showHidden={showHidden}
              sortStoredByTime={sortStoredByTime}
              sortStoredByKey={sortStoredByKey}
              filterStoredByBase={filterStoredByBase}
              filterStoredByScreenshot={filterStoredByScreenshot}
              useGAFormat={useGAFormat} />
            </ErrorBoundary>
            <div className="ui segments Container__mapAndSelected">
              {remoteLocationsLoaded && showMap ?
              <ErrorBoundary onError={this.resetGalacticMap}>
                <GalacticMap
                map3d={map3d}
                mapDrawDistance={mapDrawDistance}
                mapLODFar={mapLODFar}
                mapSkyBox={mapSkyBox}
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
                username={username}
                show={show}
                onRestart={handleRestart}
                searchCache={searchCache.results} />
              </ErrorBoundary> : null}
              {selectedLocation && !multiSelectedLocation ?
              <ErrorBoundary onError={this.resetLocationBox}>
                <LocationBox
                username={username}
                selectType={true}
                currentLocation={currentLocation}
                isOwnLocation={isOwnLocation}
                isVisible={true}
                location={selectedLocation}
                profile={selectedLocation.profile}
                navLoad={navLoad}
                updating={this.state.updating}
                edit={this.state.edit}
                positionEdit={this.state.positionEdit}
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
                onPositionEdit={this.togglePositionEdit}
                onMarkCompatible={this.handleCompatibility}
                onMarkPrivate={this.handleVisibility}
                onRemoveStoredLocation={p.onRemoveStoredLocation}
                onSubmit={this.handleLocationMetadataUpdate}
                ps4User={ps4User} />
              </ErrorBoundary> : null}
            </div>
          </div>
        </div>
        {remoteLocationsLoaded ?
        <ErrorBoundary>
          <RemoteLocations
          s={p.s}
          locations={locations}
          isOwnLocation={isOwnLocation}
          updating={this.state.updating}
          onPagination={p.onPagination}
          onFav={this.handleFavorite}
          ps4User={ps4User} />
        </ErrorBoundary> : null}
      </div>
    );
  }
};

export default Container;