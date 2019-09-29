import state from './state';
import React from 'react';
import {truncate, delay} from 'lodash';
import {map, findIndex} from '@jaszhix/utils';
import {whichToShow, cleanUp} from './utils';
import {sortStoredByKeyMap} from './constants';
// @ts-ignore
import baseIcon from './assets/images/base_icon.png';
// @ts-ignore
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';

interface StoredLocationItemProps {
  onClick: Function;
  location: any;
  isSelected: boolean;
  useGAFormat: boolean;
  isCurrent: boolean;
  upvote: boolean;
  i: number;
}

interface StoredLocationItemState {
  hover: boolean;
}

class StoredLocationItem extends React.Component<StoredLocationItemProps, StoredLocationItemState> {
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
    if (!this.props.location || !this.props.location.dataId) return null;
    let uiSegmentStyle: CSSProperties = {
      fontSize: '16px',
      fontWeight: this.props.upvote ? 600 : 400,
      cursor: 'pointer',
      padding: '3px 12px 3px 3px',
      background: this.state.hover || this.props.isSelected ? 'rgba(255, 255, 255, 0.1)' : 'inherit',
      textAlign: 'right',
      minHeight: '29px',
      maxHeight: '29px',
      opacity: this.props.location.isHidden ? 0.5 : 1
    };
    let usesName = this.props.location.name && this.props.location.name.length > 0;
    let idFormat = `${this.props.useGAFormat ? this.props.location.translatedId : this.props.location.dataId}${this.props.useGAFormat && this.props.location.PlanetIndex > 0 ? ' P' + this.props.location.PlanetIndex.toString() : ''}`
    let name = usesName ? this.props.location.name : idFormat;
    let isMarquee = (this.state.hover || this.props.isSelected) && name.length >= 25;
    name = isMarquee ? name : truncate(name, {length: 23});
    let isSpaceStation = this.props.location.dataId[this.props.location.dataId.length - 1] === '0';
    let iconShown = this.props.upvote || this.props.isCurrent || this.props.location.isHidden;
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
        className="StoredLocationItem__iconSpan"
        style={{left: `${iconShown ? 31 : 4}px`}}>
          <img className="StoredLocationItem__icon" src={baseIcon} />
        </span> : null}
        {isSpaceStation ?
        <span title="Space Station" style={{position: 'absolute', left: `${iconShown ? 31 : 4}px`, top: '3px'}}>
          <img className="StoredLocationItem__icon" src={spaceStationIcon} />
        </span> : null}
        {iconShown ?
        <i
        title={this.props.location.isHidden ? 'Hidden Location' : this.props.isCurrent ? 'Current Location' : 'Favorite Location'}
        className={`StoredLocationItem__marker ${this.props.location.isHidden ? 'hide' : this.props.isCurrent ? 'marker' : 'star'} icon`} /> : null}
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

interface StoredLocationsProps {
  storedLocations: any[];
  selectedLocationId: string;
  selectedLocationEdit: boolean;
  selectedLocationPositionEdit: boolean;
  height: number;
  filterOthers: boolean;
  useGAFormat: boolean;
  multiSelectedLocation: boolean;
  showHidden: boolean;
  sortStoredByTime: boolean;
  sortStoredByKey: string;
  filterStoredByBase: boolean;
  filterStoredByScreenshot: boolean;
  currentLocation: any;
  favorites: string[];
  onSelect: Function;
}

interface StoredLocationsState {}

class StoredLocations extends React.Component<StoredLocationsProps, StoredLocationsState> {
  uiSegmentStyle: CSSProperties;
  range: VisibleRange;
  lastRange: VisibleRange;
  connectId: number;
  storedLocationsRef: HTMLElement;
  selecting: boolean;
  needsUpdate: boolean;
  scrollTimeout: NodeJS.Timeout;

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
      zIndex: 90
    };
    this.range = {start: 0, length: 0};
    this.lastRange = {...this.range};
    this.needsUpdate = false;
  }
  componentDidMount() {
    this.connectId = state.connect({
      selectedLocation: ({selectedLocation}) => {
        if (!this.storedLocationsRef || !selectedLocation) {
          if (this.storedLocationsRef) this.handleScroll(null);
          return;
        }
        let refIndex = findIndex(this.props.storedLocations, (location) => {
          return location.dataId === selectedLocation.dataId;
        });
        if (!this.selecting && refIndex > -1) {
          this.storedLocationsRef.scrollTop = refIndex * 29;
        }
        this.selecting = false;
        if (state.multiSelectedLocation || !selectedLocation) {
          this.handleScroll(null);
        } else {
          this.setViewableRange(this.storedLocationsRef);
        }
      },
      markStoredLocationsDirty: () => {
        this.needsUpdate = true
        setTimeout(() => this.setViewableRange(this.storedLocationsRef), 0);
      },
      favorites: () => this.needsUpdate = true,
    });
  }
  componentDidUpdate(prevProps: StoredLocationsProps) {
    if (prevProps.selectedLocationId !== this.props.selectedLocationId
      && state.selectedLocation
      && !state.selectedLocation.image) {
      this.handleScroll(null);
    }
  }
  shouldComponentUpdate(nextProps: StoredLocationsProps) {
    let shouldUpdate = (nextProps.storedLocations !== this.props.storedLocations
      || nextProps.selectedLocationId !== this.props.selectedLocationId
      || nextProps.height !== this.props.height
      || nextProps.filterOthers !== this.props.filterOthers
      || nextProps.useGAFormat !== this.props.useGAFormat
      || this.range.start !== this.lastRange.start
      || this.range.length !== this.lastRange.length);

    if (this.needsUpdate) {
      this.needsUpdate = false;
      shouldUpdate = true;
    }

    return shouldUpdate;
  }
  componentWillUnmount() {
    if (this.storedLocationsRef) {
      this.storedLocationsRef.removeEventListener('scroll', this.handleScroll);
      this.storedLocationsRef.removeEventListener('resize', this.handleScroll);
    }

    state.disconnect(this.connectId);
    cleanUp(this);
  }
  setViewableRange = (node) => {
    if (!node) return;

    this.range = whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: 29,
      columns: 1
    });

    setTimeout(() => this.forceUpdate(), 25);
  }
  handleScroll: EventListener = (e, timeout = 25) => {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(this.scrollListener, timeout);
  }
  scrollListener = () => {
    this.setViewableRange(this.storedLocationsRef);
  }
  handleSelect = (location) => {
    this.selecting = true;
    this.props.onSelect(location);
  }
  getRef = (ref) => {
    if (ref && !this.storedLocationsRef) {
      ref.addEventListener('scroll', this.handleScroll);
      ref.addEventListener('resize', this.handleScroll);
      this.setViewableRange(ref);
    }

    this.storedLocationsRef = ref;
  }
  render() {
    const {
      storedLocations,
      selectedLocationId,
      selectedLocationEdit,
      selectedLocationPositionEdit,
      multiSelectedLocation,
      currentLocation,
      favorites,
      height,
      filterOthers,
      showHidden,
      sortStoredByTime,
      sortStoredByKey,
      filterStoredByBase,
      filterStoredByScreenshot,
      useGAFormat
    } = this.props;
    this.lastRange = {...this.range};
    const needsExpand = (state.selectedLocation && state.selectedLocation.image) || selectedLocationEdit || selectedLocationPositionEdit;

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
      <div className="ui segment StoredLocations__container">
        <div
        className="ui segment"
        style={this.uiSegmentStyle}>
          <h3>{`Stored Locations (${storedLocations.length})`}</h3>
          <div style={{
            position: 'absolute',
            left: '17px',
            top: '16px'
          }}>
            <BasicDropdown
            height={height}
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
            maxHeight: `${height - (selectedLocationId && !multiSelectedLocation ? needsExpand ? 565 : 404 : 125)}px`,
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
                  upvote={favorites.indexOf(location.dataId) > -1}
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