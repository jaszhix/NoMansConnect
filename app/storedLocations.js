import state from './state';
import React from 'react';
import {truncate, delay} from 'lodash';
import {map, findIndex} from './lang';
import {whichToShow, cleanUp} from './utils';
import {sortStoredByKeyMap} from './constants';
import baseIcon from './assets/images/base_icon.png';
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';

class StoredLocationItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hover: false
    };
  }
  componentWillUnmount() {
    cleanUp(this);
  }
  handleClick = () => {
    this.props.onClick(this.props.location);
  }
  render() {
    let uiSegmentStyle = {
      fontSize: '16px',
      fontWeight: this.props.location.upvote ? '600' : '400',
      cursor: 'pointer',
      padding: '3px 12px 3px 3px',
      background: this.state.hover || this.props.isSelected ? 'rgba(255, 255, 255, 0.1)' : 'inherit',
      textAlign: 'right',
      minHeight: '29px',
      maxHeight: '29px',
      opacity: this.props.location.isHidden ? '0.5' : '1'
    };
    let usesName = this.props.location.name && this.props.location.name.length > 0;
    let idFormat = `${this.props.useGAFormat ? this.props.location.translatedId : this.props.location.dataId}${this.props.useGAFormat && this.props.location.PlanetIndex > 0 ? ' P' + this.props.location.PlanetIndex.toString() : ''}`
    let name = usesName ? this.props.location.name : idFormat;
    let isMarquee = (this.state.hover || this.props.isSelected) && name.length >= 25;
    name = isMarquee ? name : truncate(name, {length: 23});
    let isSpaceStation = this.props.location.dataId[this.props.location.dataId.length - 1] === '0';
    let iconShown = this.props.location.upvote || this.props.isCurrent || this.props.location.isHidden;
    return (
      <div
      className="ui segment"
      style={uiSegmentStyle}
      onMouseEnter={()=>this.setState({hover: true})}
      onMouseLeave={()=>this.setState({hover: false})}
      onClick={this.handleClick}>
        {this.props.location.base ?
        <span
        title={`${this.props.location.username === state.username ? 'Your' : this.props.location.username + '\'s'} Base`}
        style={{position: 'absolute', left: `${iconShown ? 31 : 4}px`, top: '4px'}}>
          <img style={{width: '21px', height: '21px'}} src={baseIcon} />
        </span> : null}
        {isSpaceStation ?
        <span title="Space Station" style={{position: 'absolute', left: `${iconShown ? 31 : 4}px`, top: '3px'}}>
          <img style={{width: '21px', height: '21px'}} src={spaceStationIcon} />
        </span> : null}
        {iconShown ?
        <i
        title={this.props.location.isHidden ? 'Hidden Location' : this.props.isCurrent ? 'Current Location' : 'Favorite Location'}
        style={{
          position: 'absolute',
          top: '2px',
          left: '6px',
          cursor: 'pointer'
        }}
        className={`${this.props.location.isHidden ? 'hide' : this.props.isCurrent ? 'marker' : 'star'} icon`} /> : null}
        <p
        className={isMarquee ? 'marquee' : ''}
        style={{
          color: (this.props.location.playerPosition
            || (this.props.location.positions && this.props.location.positions.length > 0 && this.props.location.positions[0].playerPosition))
            && !this.props.location.manuallyEntered ? 'inherit' : '#7fa0ff',
          maxWidth: `${isMarquee ? 200 : 177}px`,
          whiteSpace: 'nowrap',
          position: 'relative',
          left: `${isMarquee ? 33 : name.length >= 25 ? 76 : !usesName && this.props.useGAFormat ? 56 : 86}px`,
        }}>
          <span>{name}</span>
        </p>
      </div>
    );
  }
}

class StoredLocations extends React.Component {
  constructor(props) {
    super(props);
    this.uiSegmentStyle = {
      background: 'rgba(23, 26, 22, 0.9)',
      display: 'inline-table',
      borderTop: '2px solid #95220E',
      minWidth: '285px',
      maxWidth: '285px',
      textAlign: 'center',
      paddingLeft: '0px',
      paddingRight: '0px',
      zIndex: '90'
    };
    this.range = {start: 0, length: 0};
  }
  componentDidMount() {
    this.connectId = state.connect({
      selectedLocation: ({selectedLocation}) => {
        if (!this.storedLocations || !selectedLocation) {
          if (this.storedLocations) this.handleScroll();
          return;
        }
        let refIndex = findIndex(this.props.storedLocations, (location) => {
          return location.dataId === selectedLocation.dataId;
        });
        if (!this.selecting && refIndex > -1) {
          this.storedLocations.scrollTop = refIndex * 29;
        }
        this.selecting = false;
        if (state.multiSelectedLocation) {
          this.handleScroll();
        } else {
          this.setViewableRange(this.storedLocations);
        }
      }
    });
    let checkStored = () => {
      if (this.storedLocations) {
        this.storedLocations.addEventListener('scroll', this.handleScroll);
        this.setViewableRange(this.storedLocations);
      } else {
        delay(() => checkStored(), 500);
      }
    };
    checkStored();
  }
  shouldComponentUpdate(nextProps) {
    return (nextProps.storedLocations !== this.props.storedLocations
      || nextProps.selectedLocationId !== this.props.selectedLocationId
      || nextProps.height !== this.props.height
      || nextProps.filterOthers !== this.props.filterOthers
      || nextProps.useGAFormat !== this.props.useGAFormat)
  }
  componentWillUnmount() {
    if (this.storedLocations) {
      this.storedLocations.removeEventListener('scroll', this.handleScroll);
    }
    state.disconnect(this.connectId);
  }
  setViewableRange = (node) => {
    if (!node) {
      return;
    }
    this.range = whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: 29,
      columns: 1
    });
    this.forceUpdate();
  }
  handleScroll = (timeout = 25) => {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(this.scrollListener, timeout);
  }
  scrollListener = () => {
    this.setViewableRange(this.storedLocations);
  }
  handleSelect = (location) => {
    this.selecting = true;
    this.props.onSelect(location);
  }
  getRef = (ref) => {
    this.storedLocations = ref;
  }
  render() {
    let {
      storedLocations,
      selectedLocationId,
      multiSelectedLocation,
      currentLocation,
      height,
      filterOthers,
      showHidden,
      sortStoredByTime,
      sortStoredByKey,
      filterStoredByBase,
      filterStoredByScreenshot,
      useGAFormat
    } = this.props;
    let leftOptions = [
      {
        id: 'hideOthers',
        label: `Show ${filterOthers ? 'My' : 'All'} Locations`,
        toggle: true,
        onClick: () => state.set({filterOthers: !filterOthers})
      },
      {
        id: 'showHidden',
        label: 'Show Hidden Locations',
        toggle: showHidden,
        onClick: () => state.set({showHidden: !showHidden})
      },
      {
        id: 'filterStoredByBase',
        label: 'Filter by Bases',
        toggle: filterStoredByBase,
        onClick: () => state.set({filterStoredByBase: !filterStoredByBase})
      },
      {
        id: 'filterStoredByScreenshot',
        label: 'Filter by Screenshots',
        toggle: filterStoredByScreenshot,
        onClick: () => state.set({filterStoredByScreenshot: !filterStoredByScreenshot})
      },
      {
        id: 'sortTime',
        label: 'Sort by Favorites',
        toggle: !sortStoredByTime,
        onClick: () => state.set({sortStoredByTime: !sortStoredByTime})
      },
      {
        id: 'sortName',
        label: `Sort by ${sortStoredByKeyMap[sortStoredByKey]}`,
        toggle: sortStoredByKey,
        onClick: () => state.set({
          sortStoredByKey: sortStoredByKey === 'created' ? 'name'
            : sortStoredByKey === 'name' ? 'description'
            : sortStoredByKey === 'distanceToCenter' ? 'created'
            : sortStoredByKey === 'galaxy' ? 'distanceToCenter'
            : sortStoredByKey === 'teleports' ? 'galaxy'
            : 'teleports'
        })
      },
      {
        id: 'useGAFormat',
        label: 'Show Universe Addresses',
        toggle: !useGAFormat,
        onClick: () => state.set({useGAFormat: !useGAFormat})
      }
    ];
    return (
      <div
      className="ui segment"
      style={{display: 'inline-flex', background: 'transparent', WebkitUserSelect: 'none'}}>
        <div className="ui segment" style={this.uiSegmentStyle}>
          <h3>{`Stored Locations (${storedLocations.length})`}</h3>
          <div style={{
            position: 'absolute',
            left: '17px',
            top: '16px'
          }}>
            <BasicDropdown
            width={250}
            icon="ellipsis horizontal"
            showValue={null}
            persist={true}
            options={leftOptions} />
          </div>
          <div
          ref={this.getRef}
          className="ui segments"
          style={{
            maxHeight: `${height - (selectedLocationId && !multiSelectedLocation ? 404 : 125)}px`,
            WebkitTransition: 'max-height 0.1s',
            overflowY: 'auto',
            overflowX: 'hidden'}}>
            {map(storedLocations, (location, i) => {
              let isVisible = i >= this.range.start && i <= this.range.start + this.range.length;
              if (isVisible) {
                return (
                  <StoredLocationItem
                  key={location.dataId}
                  ref={location.dataId}
                  i={i}
                  onClick={this.handleSelect}
                  isSelected={selectedLocationId === location.dataId}
                  isCurrent={currentLocation === location.dataId}
                  location={location}
                  useGAFormat={useGAFormat} />
                );
              } else {
                return (
                  <div
                  key={location.dataId}
                  className="StoredLocations__spacer" />
                );
              }
            })}
          </div>
        </div>
      </div>
    );
  }
}

export default StoredLocations;