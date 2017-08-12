import state from './state';
import React from 'react';
import autoBind from 'react-autobind';
import _ from 'lodash';
import $ from 'jquery';
import * as utils from './utils';

import baseIcon from './assets/images/base_icon.png';
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';

class StoredLocationItem extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      hover: false
    };
    autoBind(this);
  }
  handleClick(){
    this.props.onClick(this.props.location, this.props.i);
  }
  render(){
    let uiSegmentStyle = {
      fontFamily: 'geosanslight-nmsregular',
      fontSize: '16px',
      fontWeight: this.props.location.upvote ? '600' : '400',
      cursor: 'pointer',
      padding: '3px 12px 3px 3px',
      background: this.state.hover || this.props.isSelected ? 'rgba(255, 255, 255, 0.1)' : 'inherit',
      textAlign: 'right',
      minHeight: '29px',
      maxHeight: '29px'
    };
    let usesName = this.props.location.name && this.props.location.name.length > 0;
    let idFormat = `${this.props.useGAFormat ? this.props.location.translatedId : this.props.location.id}${this.props.useGAFormat && this.props.location.PlanetIndex > 0 ? ' P' + this.props.location.PlanetIndex.toString() : ''}`
    let name = usesName ? this.props.location.name : idFormat;
    let isMarquee = (this.state.hover || this.props.isSelected) && name.length >= 25;
    name = isMarquee ? name : _.truncate(name, {length: 23});
    let isSpaceStation = this.props.location.id[this.props.location.id.length - 1] === '0';
    return (
      <div
      className="ui segment"
      style={uiSegmentStyle}
      onMouseEnter={()=>this.setState({hover: true})}
      onMouseLeave={()=>this.setState({hover: false})}
      onClick={this.handleClick}>
        {this.props.location.base ?
        <span
        data-tip={utils.tip('Base')}
        style={{position: 'absolute', left: `${this.props.location.upvote ? 31 : 4}px`, top: '4px'}}>
          <img style={{width: '21px', height: '21px'}} src={baseIcon} />
        </span> : null}
        {isSpaceStation ?
        <span data-tip={utils.tip('Space Station')} style={{position: 'absolute', left: `${this.props.location.upvote ? 31 : 4}px`, top: '3px'}}>
          <img style={{width: '21px', height: '21px'}} src={spaceStationIcon} />
        </span> : null}
        {this.props.location.upvote ?
        <i
        style={{
          position: 'absolute',
          top: '2px',
          left: '6px',
          cursor: 'pointer'
        }}
        className="star icon" /> : null}
        <p
        className={isMarquee ? 'marquee' : ''}
        style={{
          color: this.props.location.playerPosition && !this.props.location.manuallyEntered ? 'inherit' : '#7fa0ff',
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
  constructor(props){
    super(props);
    autoBind(this);
    this.invisibleStyle = {
      height: '29px'
    };
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
  componentDidMount(){
    let checkStored = ()=>{
      if (this.storedLocations) {
        $(this.storedLocations).scrollEnd(this.scrollListener, 25);
        this.setViewableRange(this.storedLocations);
      } else {
        _.delay(()=>checkStored(), 500);
      }
    };
    checkStored();
  }
  shouldComponentUpdate(nextProps){
    return (nextProps.storedLocations !== this.props.storedLocations
      || nextProps.selectedLocationId !== this.props.selectedLocationId
      || nextProps.height !== this.props.height
      || nextProps.filterOthers !== this.props.filterOthers
      || nextProps.useGAFormat !== this.props.useGAFormat)
  }
  componentWillUnmount(){
    if (this.storedLocations) {
      this.storedLocations.removeEventListener('scroll', this.scrollListener);
    }
  }
  setViewableRange(node){
    if (!node) {
      return;
    }
    this.range = utils.whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: 29,
      columns: 1
    });
    this.forceUpdate();
  }
  scrollListener(){
    this.setViewableRange(this.storedLocations);
  }
  handleSelect(location, i){
    let hasSelectedId = this.props.selectedLocationId;
    this.props.onSelect(location);
    _.defer(()=>{
      if (location.id === this.props.selectedLocationId && !hasSelectedId) {
        this.storedLocations.scrollTop = i * 29;
      }
    });
  }
  getRef(ref){
    this.storedLocations = ref;
  }
  render(){
    let leftOptions = [
      {
        id: 'hideOthers',
        label: this.props.filterOthers ? 'Show All Locations' : 'Hide Others\' Locations',
        onClick: ()=>state.set({filterOthers: !this.props.filterOthers})
      },
      {
        id: 'sortTime',
        label: this.props.sortStoredByTime ? 'Sort by Favorites' : 'Sort Chronologically',
        onClick: ()=>state.set({sortStoredByTime: !this.props.sortStoredByTime})
      },
      {
        id: 'useGAFormat',
        label: this.props.useGAFormat ? 'Show Universe Addresses' : 'Show Galactic Addresses',
        onClick: ()=>state.set({useGAFormat: !this.props.useGAFormat})
      }
    ];
    return (
      <div
      className="ui segment"
      style={{display: 'inline-flex', background: 'transparent', WebkitUserSelect: 'none'}}>
        <div className="ui segment" style={this.uiSegmentStyle}>
          <h3>{`Stored Locations (${this.props.storedLocations.length})`}</h3>
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
          ref={this.getRef}
          className="ui segments"
          style={{
            maxHeight: `${this.props.height - (this.props.selectedLocationId ? 404 : 125)}px`,
            WebkitTransition: 'max-height 0.1s',
            overflowY: 'auto',
            overflowX: 'hidden'}}>
            {_.map(this.props.storedLocations, (location, i)=>{
              let isVisible = i >= this.range.start && i <= this.range.start + this.range.length;
              if (isVisible) {
                return (
                  <StoredLocationItem
                  key={location.id}
                  ref={location.id}
                  i={i}
                  onClick={this.handleSelect}
                  isSelected={this.props.selectedLocationId === location.id}
                  location={location}
                  useGAFormat={this.props.useGAFormat} />
                );
              } else {
                return (
                  <div
                  key={location.id}
                  style={this.invisibleStyle} />
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