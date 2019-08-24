import state from './state';
import React from 'react';
import {delay, throttle} from 'lodash';
import {each} from '@jaszhix/utils';

import {whichToShow, cleanUp} from './utils';
import {BasicDropdown} from './dropdowns';
import LocationBox from './locationBox';

interface RemoteLocationsProps {
  s: GlobalState;
  onPagination: Function;
  onFav: Function;
  onSaveBase: Function;
  ps4User: boolean;
  isOwnLocation: boolean;
  updating: boolean;
  locations: any[];
}

interface RemoteLocationsState {
  init: boolean;
}

interface MenuOption {
  id: string,
  label: string,
  toggle?: boolean,
  disabled?: boolean
  onClick?: Function;
}

class RemoteLocations extends React.Component<RemoteLocationsProps, RemoteLocationsState> {
  range: VisibleRange;
  connections: any[];
  recentExplorations: HTMLElement;
  uiSegmentStyle: CSSProperties;
  throttledPagination: Function;
  scrollTimeout: NodeJS.Timeout;

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
    ];
    this.uiSegmentStyle = {
      background: 'rgba(23, 26, 22, 0.9)',
      display: 'inline-table',
      borderTop: '2px solid #95220E',
      textAlign: 'center',
      WebkitUserSelect: 'none',
      paddingRight: '0px'
    };
    let checkRemote = () => {
      if (this.props.s.remoteLocations && this.props.s.remoteLocations.results) {
        this.recentExplorations.addEventListener('scroll', this.handleScroll);
        this.setState({init: false});
        this.setViewableRange(this.recentExplorations);
      } else {
        delay(()=>checkRemote(), 500);
      }
    };
    checkRemote();
    // @ts-ignore
    this.throttledPagination = throttle(this.props.onPagination, 1000, {leading: true});
  }
  componentWillUnmount() {
    if (this.recentExplorations) {
      this.recentExplorations.removeEventListener('scroll', this.handleScroll);
    }
    each(this.connections, (id) => state.disconnect(id));

    cleanUp(this);
  }
  setViewableRange = (node?) => {
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
      setTimeout(() => {
        if (!this.recentExplorations) return;
        this.recentExplorations.scrollTop = Math.floor(this.recentExplorations.scrollHeight - this.props.s.pageSize * 271);
      }, 1500);
    }
  }
  handleFavorite = (location, upvote?) => {
    this.props.onFav(location, upvote);
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
    let containerStyle: CSSProperties = {
      position: 'absolute',
      right: '54px',
      zIndex: 91,
      maxWidth: remoteLocationsWidth,
    };
    let uiSegmentsStyle: CSSProperties = {
      display: 'inline-flex',
      paddingTop: '14px',
      width: '400px !important'
    };
    let innerContainerStyle: CSSProperties = {
      maxHeight: `${p.s.height - 125}px`,
      width: remoteLocationsWidth,
      minWidth: '400px',
      maxWidth: remoteLocationsWidth,
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'relative'
    };

    let leftOptions: MenuOption[] = [
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
        id: 'sortByModified',
        label: 'Sort by Last Updated',
        toggle: this.props.s.sortByModified,
        onClick: () => state.set({sortByModified: !this.props.s.sortByModified})
      },
      {
        id: 'sortByFavorites',
        label: 'Sort by Favorites',
        toggle: this.props.s.sortByFavorites,
        onClick: () => state.set({sortByFavorites: !this.props.s.sortByFavorites})
      },
      {
        id: 'sortByTeleports',
        label: 'Sort by Teleports',
        toggle: this.props.s.sortByTeleports,
        onClick: () => state.set({sortByTeleports: !this.props.s.sortByTeleports})
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
    let criteria = p.s.offline ? 'Cached' : 'Registered';
    let title = p.s.searchInProgress && p.s.searchCache.results.length > 0 ?
      p.s.searchCache.count === 0 ? `No results for "${p.s.search}"`
      : `${p.s.search} (${p.s.searchCache.count > 2000 ? 2000
      : p.s.searchCache.count})`
      : p.s.remoteLocations.count === 0 ? 'Loading...'
      : `${criteria} Locations ${parenthesis}`;

    if (title.substr(0, 5) === 'user:') {
      title = title.split('user:')[1];
    }

    let invisibleStyle = {
      height: `${(p.s.compactRemote ? 68 : 245) + 26}px`
    };
    let _locations = Array(locations.length);
    each(locations, (location, i) => {
      if (!location) return null;
      let isVisible = i >= this.range.start && i <= this.range.start + this.range.length;
      if (isVisible) {
        _locations[i] = (
          <LocationBox
          key={location.id}
          i={i}
          scrollTop={this.recentExplorations ? this.recentExplorations.scrollTop : 0}
          isVisible={true}
          profile={location.profile}
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
            <div className="RemoteLocations__dropdownContainer">
              <BasicDropdown
              height={p.s.height}
              width={350}
              icon="sliders horizontal"
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