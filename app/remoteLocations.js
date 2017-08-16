import state from './state';
import React from 'react';
import autoBind from 'react-autobind';
import _ from 'lodash';
import $ from 'jquery';

import * as utils from './utils';

import {BasicDropdown} from './dropdowns';
import LocationBox from './locationBox';

class RemoteLocations extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      init: true
    };
    autoBind(this);
    this.range = {start: 0, length: 0};
  }
  componentDidMount(){
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
        //$(this.recentExplorations).scrollEnd(this.scrollListener, 25);
        this.setState({init: false});
        this.setViewableRange(this.recentExplorations);
      } else {
        _.delay(()=>checkRemote(), 500);
      }
    };
    checkRemote();
    this.throttledPagination = _.throttle(this.props.onPagination, 1000, {leading: true});
  }
  shouldComponentUpdate(nextProps) {
    return (nextProps.s.remoteLocations.results !== this.props.s.remoteLocations.results
      || this.props.s.search.length > 0
      || nextProps.s.searchCache.results !== this.props.s.searchCache.results
      || nextProps.s.favorites !== this.props.s.favorites
      || nextProps.updating !== this.props.updating
      || nextProps.s.installing !== this.props.s.installing
      || nextProps.s.width !== this.props.s.width
      || nextProps.s.remoteLocationsColumns !== this.props.s.remoteLocationsColumns
      || nextProps.s.compactRemote !== this.props.compactRemote
      || nextProps.s.showOnlyScreenshots !== this.props.s.showOnlyScreenshots
      || nextProps.s.showOnlyNames !== this.props.s.showOnlyNames
      || nextProps.s.showOnlyDesc !== this.props.s.showOnlyDesc
      || nextProps.s.showOnlyGalaxy !== this.props.s.showOnlyGalaxy
      || nextProps.s.showOnlyBases !== this.props.s.showOnlyBases
      || nextProps.s.showOnlyPC !== this.props.s.showOnlyPC
      || nextProps.s.selectedGalaxy !== this.props.s.selectedGalaxy
      || nextProps.s.sortByDistance !== this.props.s.sortByDistance
      || nextProps.s.sortByModded !== this.props.s.sortByModded
      || this.state.init)
  }
  componentWillReceiveProps(nextProps){
    let searchChanged = nextProps.s.searchCache.results !== this.props.s.searchCache.results;
    if (nextProps.s.sort !== this.props.s.sort && this.recentExplorations || searchChanged) {
      this.recentExplorations.scrollTop = 0;
    }

    if (nextProps.s.remoteLocationsColumns !== this.props.s.remoteLocationsColumns) {
      this.setViewableRange(this.recentExplorations);
    }
  }
  componentWillUnmount(){
    if (this.recentExplorations) {
      this.recentExplorations.removeEventListener('scroll', this.scrollListener);
    }
  }
  setViewableRange(node){
    if (!node) {
      return;
    }
    let itemHeight = this.props.s.compactRemote ? 68 : 245;
    this.range = utils.whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: itemHeight + 26,
      columns: this.props.s.remoteLocationsColumns
    });
    this.forceUpdate();
  }
  handleScroll(){
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(this.scrollListener, 25);
  }
  scrollListener(){
    if (this.props.s.remoteLength >= this.props.s.remoteLocations.count - this.props.s.pageSize) {
      return;
    }

    let node = this.recentExplorations;

    this.setViewableRange(node);

    if (this.props.s.searchCache.results.length > 0) {
      return;
    }

    if (node.scrollTop + window.innerHeight >= node.scrollHeight + node.offsetTop - 180) {
      this.throttledPagination(this.props.s.page);
      _.delay(()=>{
        this.recentExplorations.scrollTop = Math.floor(node.scrollHeight - this.props.s.pageSize * 271);
      }, 1500);
    }
  }
  handleFavorite(location, upvote){
    this.props.onFav(location, upvote);
  }
  getRef(ref){
    this.recentExplorations = ref;
  }
  render(){
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
        onClick: ()=>state.set({remoteLocationsColumns: p.s.remoteLocationsColumns === 1 ? 2 : p.s.remoteLocationsColumns === 2 ? 3 : 1})
      },
      {
        id: 'compactRemote',
        label: `Compact View: ${p.s.compactRemote ? 'On' : 'Off'}`,
        onClick: ()=>state.set({compactRemote: !p.s.compactRemote})
      },
      {
        id: 'showOnlyGalaxy',
        label: this.props.s.showOnlyGalaxy ? 'Show Locations From All Galaxies' : `Show Only Locations From ${state.galaxies[p.s.selectedGalaxy]}`,
        onClick: ()=>state.set({showOnlyGalaxy: !this.props.s.showOnlyGalaxy})
      },
      {
        id: 'showOnlyPC',
        label: this.props.s.showOnlyPC ? 'Show Only PC Locations: On' : 'Show Only PC Locations: Off',
        onClick: ()=>state.set({showOnlyPC: !this.props.s.showOnlyPC})
      },
      {
        id: 'showOnlyScreenshots',
        label: this.props.s.showOnlyScreenshots ? 'Show Only Locations With Screenshots: On' : 'Show Only Locations With Screenshots: Off',
        onClick: ()=>state.set({showOnlyScreenshots: !this.props.s.showOnlyScreenshots})
      },
      {
        id: 'showOnlyNames',
        label: this.props.s.showOnlyNames ? 'Show Only Locations With Names: On' : 'Show Only Locations With Names: Off',
        onClick: ()=>state.set({showOnlyNames: !this.props.s.showOnlyNames})
      },
      {
        id: 'showOnlyDesc',
        label: this.props.s.showOnlyDesc ? 'Show Only Locations With Descriptions: On' : 'Show Only Locations With Descriptions: Off',
        onClick: ()=>state.set({showOnlyDesc: !this.props.s.showOnlyDesc})
      },
      {
        id: 'showOnlyBases',
        label: this.props.s.showOnlyBases ? 'Show Only Locations With Bases: On' : 'Show Only Locations With Bases: Off',
        onClick: ()=>state.set({showOnlyBases: !this.props.s.showOnlyBases})
      },
      {
        id: 'showOnlyCompatible',
        label: this.props.s.showOnlyCompatible ? 'Show Only Version Compatible Locations: On' : 'Show Only Version Compatible Locations: Off',
        onClick: ()=>state.set({showOnlyCompatible: !this.props.s.showOnlyCompatible})
      },
      {
        id: 'sortByDistance',
        label: this.props.s.sortByDistance ? 'Sort by Distance to Center: On' : 'Sort by Distance to Center: Off',
        onClick: ()=>state.set({sortByDistance: !this.props.s.sortByDistance})
      },
      {
        id: 'sortByModded',
        label: this.props.s.sortByModded ? 'Sort by Least Modded: On' : 'Sort by Least Modded: Off',
        onClick: ()=>state.set({sortByModded: !this.props.s.sortByModded})
      }
    ];
    if (p.s.remoteLocations && p.s.remoteLocations.results && p.s.searchCache.results.length === 0 && p.s.remoteLength < p.s.remoteLocations.count - p.s.pageSize) {
      leftOptions.push({
        id: 'loadMore',
        label: `Load ${p.s.pageSize} More Locations`,
        onClick: ()=>this.throttledPagination(p.s.page)
      });
    }
    let parenthesis = p.s.offline || p.s.remoteLength === 0 ? '' : `(${p.s.remoteLength})`;
    let criteria = p.s.offline ? 'Cached' : p.s.sort === '-created' ? 'Recent' : p.s.sort === '-score' ? 'Favorite' : 'Popular';
    let title = p.s.searchCache.results.length > 0 ? p.s.searchCache.count === 0 ? `No results for "${p.s.search}"` : `${p.s.search} (${p.s.searchCache.count})` : p.s.remoteLocations.count === 0 ? 'Loading...' : `${criteria} Explorations ${parenthesis}`
    let locations = p.s.searchCache.results.length > 0 ? p.s.searchCache.results : p.s.remoteLocations.results;
    if (this.props.s.showOnlyScreenshots) {
      locations = _.filter(locations, (location)=>{
        return location.image.length > 0;
      });
    }
    if (this.props.s.showOnlyNames) {
      locations = _.filter(locations, (location)=>{
        return location.data.name && location.data.name.length > 0;
      });
    }
    if (this.props.s.showOnlyDesc) {
      locations = _.filter(locations, (location)=>{
        return location.data.description && location.data.description.length > 0;
      });
    }
    if (this.props.s.showOnlyGalaxy) {
      locations = _.filter(locations, (location)=>{
        return location.data.galaxy === p.s.selectedGalaxy;
      });
    }
    if (this.props.s.showOnlyBases) {
      locations = _.filter(locations, (location)=>{
        return location.data.base;
      });
    }
    if (this.props.s.showOnlyCompatible && this.props.s.saveVersion) {
      locations = _.filter(locations, (location)=>{
        return location.version === this.props.s.saveVersion || location.data.version === this.props.s.saveVersion;
      });
    }
    if (this.props.s.showOnlyPC) {
      locations = _.filter(locations, (location)=>{
        return location.data.playerPosition && !location.data.manuallyEntered;
      });
    }
    if (this.props.s.sortByDistance || this.state.sortByModded) {
      locations = _.orderBy(locations, (location)=>{
        if (!location.data.mods) {
          location.data.mods = [];
        }
        if (this.props.s.sortByModded && this.props.s.sortByDistance) {
          return location.data.mods.length + location.data.distanceToCenter;
        } else if (this.props.s.sortByDistance) {
          return location.data.distanceToCenter;
        } else if (this.props.s.sortByModded) {
          return location.data.mods.length;
        }
      });
    }
    let invisibleStyle = {
      height: `${(p.s.compactRemote ? 68 : 245) + 26}px`
    };

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
              icon="ellipsis horizontal"
              showValue={null}
              persist={true}
              options={leftOptions} />
            </div>
            <div
            style={innerContainerStyle}
            ref={this.getRef}>
              {_.map(locations, (location, i)=>{
                location.data.teleports = location.teleports;
                location.upvote = location.data.upvote;
                let isVisible = i >= this.range.start && i <= this.range.start + this.range.length;
                if (isVisible) {
                  return (
                    <LocationBox
                    key={location.id}
                    i={i}
                    scrollTop={this.recentExplorations ? this.recentExplorations.scrollTop : 0}
                    isVisible={true}
                    name={location.name}
                    description={location.description}
                    username={p.s.username}
                    isOwnLocation={p.isOwnLocation}
                    location={location.data}
                    installing={p.s.installing}
                    updating={p.updating}
                    favorites={p.s.favorites}
                    image={location.image}
                    version={p.s.saveVersion ? location.version === p.s.saveVersion || location.data.version === p.s.saveVersion : null}
                    onFav={this.handleFavorite}
                    onTeleport={p.onTeleport}
                    onSaveBase={p.onSaveBase}
                    onCompactRemoteSwitch={this.setViewableRange}
                    ps4User={p.ps4User}
                    compactRemote={p.s.compactRemote}
                    configDir={p.s.configDir} />
                  );
                } else {
                  return (
                    <div
                    key={location.id}
                    style={invisibleStyle} />
                  );
                }
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default RemoteLocations;