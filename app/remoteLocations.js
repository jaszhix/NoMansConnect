import state from './state';
import React from 'react';
import {delay, throttle} from 'lodash';
import log from './log';
import {whichToShow} from './utils';
import {each, findIndex} from './lang';
import {BasicDropdown} from './dropdowns';
import LocationBox from './locationBox';

class RemoteLocations extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      init: true
    };
    this.range = {start: 0, length: 0};
  }
  componentDidMount() {
    this.connections = [
      state.connect(['searchCache', 'sort'], () => {
        if (!this.recentExplorations) {
          return;
        }
        this.recentExplorations.scrollTop = 0;
      }),
      state.connect(['remoteLocationsColumns', 'compactRemote'], () => setTimeout(() => this.setViewableRange(this.recentExplorations), 0)),
      state.connect({
        updateRemoteLocation: (...args) => this.handleUpdate(...args)
      })
    ];
    this.uiSegmentStyle = {
      background: 'rgba(23, 26, 22, 0.9)',
      display: 'inline-table',
      borderTop: '2px solid #95220E',
      textAlign: 'center',
      WebkitUserSelect: 'none',
      paddingRight: '0px'
    };
    let checkRemote = ()=>{
      if (this.props.s.remoteLocations && this.props.s.remoteLocations.results) {
        this.recentExplorations.addEventListener('scroll', this.handleScroll);
        this.setState({init: false});
        this.setViewableRange(this.recentExplorations);
      } else {
        delay(()=>checkRemote(), 500);
      }
    };
    checkRemote();
    this.throttledPagination = throttle(this.props.onPagination, 1000, {leading: true});
  }
  componentWillUnmount() {
    if (this.recentExplorations) {
      this.recentExplorations.removeEventListener('scroll', this.handleScroll);
    }
    each(this.connections, (id) => state.disconnect(id));
  }
  setViewableRange = (node) => {
    if (!node) {
      return;
    }
    let itemHeight = this.props.s.compactRemote ? 68 : 245;
    this.range = whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: itemHeight + 26,
      columns: this.props.s.remoteLocationsColumns
    });
    this.forceUpdate();
  }
  handleScroll = () => {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(this.scrollListener, 25);
  }
  scrollListener = () => {
    if (!this.recentExplorations) {
      return;
    }
    this.setViewableRange(this.recentExplorations);

    if (this.props.s.searchCache.results.length > 0) {
      return;
    }

    if (this.props.s.remoteLength >= (this.props.s.remoteLocations.count - this.props.s.pageSize)) {
      return;
    }

    if (this.props.s.remoteNext
      && this.recentExplorations.scrollTop + window.innerHeight >= this.recentExplorations.scrollHeight + this.recentExplorations.offsetTop - 180) {
      this.throttledPagination(this.props.s.page);
      delay(()=>{
        this.recentExplorations.scrollTop = Math.floor(this.recentExplorations.scrollHeight - this.props.s.pageSize * 271);
      }, 1500);
    }
  }
  handleFavorite = (location, upvote) => {
    this.props.onFav(location, upvote);
  }
  handleUpdate = (dataId, location, remove = false) => {
    let {remoteLocations} = this.props.s;
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
    window.jsonWorker.postMessage({
      method: 'set',
      key: 'remoteLocations',
      value: remoteLocations,
    });
  }
  getRef = (ref) => {
    this.recentExplorations = ref;
  }
  render() {
    let p = this.props;
    let remoteLocationsWidth;
    if (p.s.remoteLocationsColumns === 1) {
      remoteLocationsWidth = '441px';
    } else if (p.s.remoteLocationsColumns === 2) {
      remoteLocationsWidth = '902px';
    } else {
      remoteLocationsWidth = '1300px';
    }
    let containerStyle = {
      position: 'absolute',
      right: '54px',
      zIndex: '91',
      maxWidth: remoteLocationsWidth,
    };
    let uiSegmentsStyle = {
      display: 'inline-flex',
      paddingTop: '14px',
      width: '400px !important'
    };
    let innerContainerStyle = {
      maxHeight: `${p.s.height - 125}px`,
      width: remoteLocationsWidth,
      minWidth: '400px',
      maxWidth: remoteLocationsWidth,
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'relative'
    };

    let leftOptions = [
      {
        id: 'remoteLocationsColumns',
        label: `Max Columns: ${p.s.remoteLocationsColumns}`,
        onClick: () => state.set({remoteLocationsColumns: p.s.remoteLocationsColumns === 1 ? 2 : p.s.remoteLocationsColumns === 2 ? 3 : 1})
      },
      {
        id: 'compactRemote',
        label: 'Compact View',
        toggle: this.props.s.compactRemote,
        onClick: () => state.set({compactRemote: !p.s.compactRemote})
      },
      {
        id: 'showOnlyGalaxy',
        label: `Filter by Locations From ${state.galaxies[p.s.selectedGalaxy]}`,
        toggle: this.props.s.showOnlyGalaxy,
        onClick: () => state.set({showOnlyGalaxy: !this.props.s.showOnlyGalaxy})
      },
      {
        id: 'showOnlyPC',
        label: 'Filter by PC Locations',
        toggle: this.props.s.showOnlyPC,
        onClick: () => state.set({showOnlyPC: !this.props.s.showOnlyPC})
      },
      {
        id: 'showOnlyScreenshots',
        label: 'Filter by Screenshots',
        toggle: this.props.s.showOnlyScreenshots,
        onClick: () => state.set({showOnlyScreenshots: !this.props.s.showOnlyScreenshots})
      },
      {
        id: 'showOnlyNames',
        label: 'Filter by Names',
        toggle: this.props.s.showOnlyNames,
        onClick: () => state.set({showOnlyNames: !this.props.s.showOnlyNames})
      },
      {
        id: 'showOnlyDesc',
        label: 'Filter by Descriptions',
        toggle: this.props.s.showOnlyDesc,
        onClick: () => state.set({showOnlyDesc: !this.props.s.showOnlyDesc})
      },
      {
        id: 'showOnlyBases',
        label: 'Filter by Bases',
        toggle: this.props.s.showOnlyBases,
        onClick: () => state.set({showOnlyBases: !this.props.s.showOnlyBases})
      },
      {
        id: 'showOnlyCompatible',
        label: 'Filter by Version Compatible Locations',
        toggle: this.props.s.showOnlyCompatible,
        onClick: () => state.set({showOnlyCompatible: !this.props.s.showOnlyCompatible})
      },
      {
        id: 'showOnlyFriends',
        label: 'Filter by Friends',
        toggle: this.props.s.showOnlyFriends,
        onClick: () => state.set({showOnlyFriends: !this.props.s.showOnlyFriends})
      },
      {
        id: 'sortByDistance',
        label: 'Sort by Distance to Center',
        toggle: this.props.s.sortByDistance,
        onClick: () => state.set({sortByDistance: !this.props.s.sortByDistance})
      },
      {
        id: 'sortByModded',
        label: 'Sort by Least Modded',
        toggle: this.props.s.sortByModded,
        onClick: () => state.set({sortByModded: !this.props.s.sortByModded})
      }
    ];
    if (p.s.remoteLocations
      && !p.s.searchInProgress
      && p.s.remoteNext) {
      leftOptions.push({
        id: 'loadMore',
        disabled: p.s.navLoad,
        label: 'Load More Locations',
        onClick: () => this.throttledPagination(p.s.page)
      });
    }
    let locations = p.s.searchCache.results.length > 0 ? p.s.searchCache.results : p.locations;
    let parenthesis = `(${locations.length})`;
    let criteria = p.s.offline ? 'Cached' : p.s.sort === '-created' ? 'Recent' : p.s.sort === '-score' ? 'Favorite' : 'Popular';
    let title = p.s.searchCache.results.length > 0 ? p.s.searchCache.count === 0 ? `No results for "${p.s.search}"` : `${p.s.search} (${p.s.searchCache.count > 2000 ? 2000 : p.s.searchCache.count})` : p.s.remoteLocations.count === 0 ? 'Loading...' : `${criteria} Explorations ${parenthesis}`
    if (title.substr(0, 5) === 'user:') {
      title = title.split('user:')[1];
    }

    let invisibleStyle = {
      height: `${(p.s.compactRemote ? 68 : 245) + 26}px`
    };
    let _locations = Array(locations.length);
    each(locations, (location, i)=>{
      if (!location) return null;
      let isVisible = i >= this.range.start && i <= this.range.start + this.range.length;
      if (isVisible) {
        _locations[i] = (
          <LocationBox
          key={location.id}
          i={i}
          scrollTop={this.recentExplorations ? this.recentExplorations.scrollTop : 0}
          isVisible={true}
          name={location.name}
          profile={location.profile}
          description={location.description}
          username={p.s.username}
          isOwnLocation={p.isOwnLocation}
          location={location}
          navLoad={p.s.navLoad}
          updating={p.updating}
          favorites={p.s.favorites}
          image={location.image}
          version={p.s.saveVersion ? location.version === p.s.saveVersion : null}
          onFav={this.handleFavorite}
          onSaveBase={p.onSaveBase}
          onCompactRemoteSwitch={this.setViewableRange}
          onSearch={p.onSearch}
          onUpdate={this.handleUpdate}
          ps4User={p.ps4User}
          compactRemote={p.s.compactRemote}
          offline={p.s.offline}
          configDir={p.s.configDir} />
        );
      } else {
        _locations[i] = (
          <div
          key={location.dataId}
          style={invisibleStyle} />
        );
      }
    });
    locations = undefined;

    return (
      <div className="columns" style={containerStyle}>
        <div className="ui segments" style={uiSegmentsStyle}>
          <div className="ui segment" style={this.uiSegmentStyle}>
            <h3>{title}</h3>
            <div style={{
              position: 'absolute',
              left: '17px',
              top: '16px'
            }}>
              <BasicDropdown
              width={350}
              icon="ellipsis horizontal"
              showValue={null}
              persist={true}
              options={leftOptions} />
            </div>
            <div
            style={innerContainerStyle}
            ref={this.getRef}>
              {_locations}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default RemoteLocations;