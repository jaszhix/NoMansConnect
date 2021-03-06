import state from './state';
import React from 'react';
import {truncate} from 'lodash';
import {map, findIndex} from '@jaszhix/utils';
import {whichToShow, cleanUp} from './utils';
import {sortStoredByKeyMap} from './constants';
// @ts-ignore
import baseIcon from './assets/images/base_icon.png';
// @ts-ignore
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';

interface StoredLocationItemProps {
  onClick: (location: NMSLocation) => void;
  location: NMSLocation;
  isSelected: boolean;
  useGAFormat: boolean;
  isCurrent: boolean;
  upvote: boolean;
}

class StoredLocationItem extends React.Component<StoredLocationItemProps> {
  componentWillUnmount() {
    cleanUp(this);
  }
  handleClick = () => {
    this.props.onClick(this.props.location);
  }
  render() {
    const {
      location,
      upvote,
      isSelected,
      useGAFormat,
      isCurrent
    } = this.props;

    if (!location || !location.dataId) return null;

    let rootClasses = 'ui segment cursorPointer StoredLocationItem__root';
    let pClasses = '';

    if (upvote) rootClasses += ' upvote';
    if (isSelected) rootClasses += ' selected';
    if (location.isHidden) rootClasses += ' hidden';

    let usesName = location.name && location.name.length > 0;
    let idFormat = `${useGAFormat ? location.translatedId : location.dataId}${useGAFormat && location.PlanetIndex > 0 ? ' P' + location.PlanetIndex.toString() : ''}`
    let name = usesName ? location.name : idFormat;
    let isMarquee = (isSelected && name.length >= 25);
    name = isMarquee ? name : truncate(name, {length: 23});
    let isSpaceStation = location.dataId[location.dataId.length - 1] === '0';
    let isValid = (location.playerPosition
      || (location.positions && location.positions.length > 0 && location.positions[0].playerPosition))
      && !location.manuallyEntered;
    let icons = [];
    let lastIcon;
    let left = 4;

    if (isCurrent) {
      icons.push({
        title: 'Current Location',
        className: 'marker icon',
      });
    }

    if (location.base) {
      icons.push({
        title: `${location.username === state.username ? 'Your' : location.username + '\'s'} Base`,
        className: 'iconContainer',
        src: baseIcon,
      });
    }

    if (isSpaceStation) {
      icons.push({
        title: 'Space Station',
        className: 'iconContainer spaceStation',
        src: spaceStationIcon,
      });
    }

    if (upvote) {
      icons.push({
        title: 'Favorite Location',
        className: 'star icon',
      });
    }

    if (location.isHidden) {
      icons.push({
        title: 'Hidden Location',
        className: 'hide icon',
      });
    }

    if (location.private) {
      icons.push({
        title: 'Private Location',
        className: 'lock icon',
      });
    }

    switch (true) {
      case (isMarquee):
        pClasses = 'marquee';
        break;
      case (name.length >= 25):
        pClasses = 'longName';
        break;
      case (!usesName && useGAFormat):
        pClasses = 'gaFormat';
        break;
    }

    if (!isValid) {
      if (pClasses.length) pClasses += ' ';
      pClasses += 'manual';
    }

    return (
      <div
      className={rootClasses}
      onClick={this.handleClick}>
        {map(icons, (item, i) => {
          let {title, className, src} = item;
          let style;

          if (i > 1 && !location.name && useGAFormat) return null;

          if (i > 0) left += 27;
          if (i > 2) left -= 5;

          if (lastIcon && lastIcon.src) left += 5;

          style = {left: `${left}px`};

          lastIcon = item;

          if (src) {
            return (
              <span
              key={i}
              title={title}
              className={className}
              style={style}>
                <img src={src} />
              </span>
            );
          }

          return (
            <i
            key={i}
            title={title}
            className={className}
            style={style} />
          );
        })}
        <p
        className={pClasses}
        style={isMarquee ? {left: `${left}px`} : null}>
          <span>{name}</span>
        </p>
      </div>
    );
  }
}

interface StoredLocationsProps {
  storedLocations: NMSLocation[];
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
  currentLocation: string;
  favorites: string[];
  onSelect: (location: NMSLocation) => void;
}

interface StoredLocationsState {}

class StoredLocations extends React.Component<StoredLocationsProps, StoredLocationsState> {
  range: VisibleRange;
  lastRange: VisibleRange;
  connectId: number;
  storedLocationsRef: HTMLElement;
  selecting: boolean;
  needsUpdate: boolean;
  scrollTimeout: NodeJS.Timeout;

  constructor(props) {
    super(props);

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

    return shouldUpdate && !state.displayColorPicker;
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
  handleSelect = (location: NMSLocation) => {
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
      <div className="ui segment StoredLocations__root">
        <div className="ui segment innerContainer">
          <h3>{`Stored Locations (${storedLocations.length})`}</h3>
          <BasicDropdown
          className="optionsDropdown"
          height={height}
          width={250}
          icon="ellipsis horizontal"
          showValue={null}
          persist={true}
          options={leftOptions} />
          <div
          ref={this.getRef}
          className="ui segments locationsContainer"
          style={{maxHeight: `${height - (selectedLocationId && !multiSelectedLocation ? needsExpand ? 565 : 404 : 125)}px`}}>
            {map(storedLocations, (location, i) => {
              let isVisible = i >= this.range.start && i <= this.range.start + this.range.length;

              if (isVisible) {
                return (
                  <StoredLocationItem
                  key={location.dataId}
                  ref={location.dataId}
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