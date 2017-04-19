import './app.global.css';
import {remote} from 'electron';
const win = remote.getCurrentWindow();
import fs from 'fs';
import path from 'path';
import Log from './log';
const log = new Log();
/*(function(){
  var oldLog = console.log;
  console.log = function (message) {
    log.error(message)
    oldLog.apply(console, arguments);
  };
  var oldWarn = console.warn;
  console.warn = function (message) {
    log.error(message)
    oldWarn.apply(console, arguments);
  };
  var oldError = console.error;
  console.error = function (message) {
    log.error(message)
    oldError.apply(console, arguments);
  };
})();*/
import watch from 'watch';
const ps = require('win-ps');
import {machineId} from 'electron-machine-id';
import state from './state';
import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import VisibilitySensor from 'react-visibility-sensor';
import ReactUtils from 'react-utils';
import ReactMarkdown from 'react-markdown';
import ReactTooltip from 'react-tooltip';
import onClickOutside from 'react-onclickoutside';
import openExternal from 'open-external';
import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';

import Loader from './loader';
const screenshot = require('./capture');
import each from './each';
import * as utils from './utils';

import defaultWallpaper from './assets/images/default_wallpaper.png';
import baseIcon from './assets/images/base_icon.png';
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown, DropdownMenu, SaveEditorDropdownMenu} from './dropdowns';
import GalacticMap from './map';

if (module.hot) {
  module.hot.accept();
}

const {dialog} = remote;

const IMAGE_DOMAIN = /*process.env.NODE_ENV === 'development' ? 'http://192.168.1.148:8000' :*/ 'https://neuropuff.com'

class ImageModal extends React.Component {
  constructor(props) {
    super(props);
    this.modalStyle = {
      background: 'rgb(23, 26, 22)',
      borderTop: '2px solid #95220E',
      position: 'fixed',
      left: '50%',
      top: '12%',
      zIndex: '1001',
      WebkitTransformOrigin: '50% 25%',
      boxShadow: 'none'
    };
  }
  handleClickOutside(){
    state.set({selectedImage: null});
  }
  render(){
    return (
      <div className="ui fullscreen modal active" style={this.modalStyle}>
        <span className="close"/>
        <img className="image content" src={`${IMAGE_DOMAIN}${this.props.image}`} />
      </div>
    );
  }
};

ImageModal = onClickOutside(ImageModal);

const locationItemStyle = {padding: '0px 2px', margin: '0px 3px', background: 'rgba(23, 26, 22, 0.8)', fontFamily: 'geosanslight-nmsregular', fontSize: '16px'};

class Item extends React.Component {
  constructor(props) {
    super(props);
    this.wrapperStyle = {
      position: 'initial',
      borderBottom: '1px solid rgba(255, 255, 255, 0.27)'
    };
    this.valueStyle = {
      float: 'right',
      position: 'relative',
      top: '1px',
      WebkitUserSelect: 'initial'
    };
    this.labelStyle = {
      fontWeight: '600'
    };
    this.descriptionStyle = {
      marginBottom: '8px'
    };
  }
  handleDescClick(e){
    e.preventDefault();
    openExternal(e.target.href);
  }
  componentDidMount(){
    if (this.props.label === 'Description') {
      _.defer(()=>{
        if (this.refs.desc) {
          this.refs.desc.addEventListener('click', this.handleDescClick);
        }
      });
    }
  }
  componentWillUnmount(){
    if (this.refs.desc) {
      this.refs.desc.removeEventListener('click', this.handleDescClick);
    }
  }
  render(){
    if (this.props.label === 'Description') {
      return (
        <div
        ref="desc"
        className="ui segment"
        style={utils.css(locationItemStyle, this.wrapperStyle)}>
          <ReactMarkdown className="md-p" source={this.props.value} />
        </div>
      );
    } else {
      return (
        <div
        className="ui segment"
        style={utils.css(locationItemStyle, this.wrapperStyle)}>
          <span style={this.labelStyle}>{`${this.props.label}`}</span> <span style={this.valueStyle}>{this.props.value}</span>
        </div>
      );
    }
  }
};

class Button extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hover: false,
    };
  }
  render(){
    return (
      <div
      className="ui segment"
      style={{
        letterSpacing: '3px',
        fontFamily: 'geosanslight-nmsregular',
        fontSize: '16px',
        padding: '3px 3px',
        textAlign: 'center',
        cursor: 'pointer',
        background: this.state.hover ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
      }}
      onMouseEnter={()=>this.setState({hover: true})}
      onMouseLeave={()=>this.setState({hover: false})}
      onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
};

class LocationBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hover: '',
      limit: false,
      name: this.props.name,
      description: this.props.description,
      isVisible: !this.props.enableVisibilityCheck
    };
    autoBind(this);
    this.wrapperStyle = {
      minHeight: '245px'
    };
    this.inputStyle = {
      width: '300px',
      position: 'relative',
      left: '28px',
      top: '3px',
      color: '#FFF',
      background: 'rgb(23, 26, 22)',
      padding: '0.67861429em 0em',
      borderRadius: '0px',
      border: '0px',
      fontSize: '15px',
      letterSpacing: '2px'
    };
    this.textareaStyle = {
      width: '300px',
      position: 'relative',
      left: '28px',
      top: '3px',
      color: '#FFF',
      background: 'rgb(23, 26, 22)',
      padding: '0.67861429em 0em',
      border: '0px',
      fontFamily: 'geosanslight-nmsregular',
      fontSize: '15px',
      letterSpacing: '2px',
      outlineColor: 'none'
    };
    this.imageStyle = {
      cursor: 'pointer',
      maxHeight: '144.5px',
      maxWidth: '386px',
      width: '99%'
    };
    this.starStyle = {
      position: 'absolute',
      top: '15px',
      right: '10px',
      cursor: 'pointer'
    };
    this.baseStyle = {
      width: '21px',
      height: '21px'
    };
    this.uiSegmentEditStyle = {
      padding: '3px 3px',
      cursor: 'pointer',
      background: '#171A16'
    };
    this.scrollBoxStyle = {
      maxHeight: '177px',
      minHeight: '177px',
      overflowY: 'auto',
      width: '363px'
    };
  }
  onVisibilityChange(isVisible){
    this.setState({isVisible: isVisible});
  }
  handleCancel(){
    this.props.onEdit();
  }
  componentWillReceiveProps(nextProps){
    if (nextProps.selectType && !_.isEqual(nextProps.location, this.props.location) && this.refs.scrollBox
      || nextProps.updating !== this.props.updating && nextProps.updating) {
      if (this.refs.scrollBox) {
        this.refs.scrollBox.scrollTop = 0;
      }

      this.setState({name: '', description: ''});
    }
    if (nextProps.enableVisibilityCheck !== this.props.enableVisibilityCheck && !nextProps.enableVisibilityCheck) {
      this.setState({isVisible: true});
    }
  }
  render(){
    let p = this.props;
    let refFav = _.findIndex(p.favorites, (fav)=>{
      return fav === p.location.id;
    });
    let upvote = refFav !== -1;
    let isOwnLocation = p.isOwnLocation && p.selectType && p.location.username === p.username;
    let deleteArg = p.location.image && p.location.image.length > 0;
    let compact = p.width && p.width <= 1212;
    let isSpaceStation = p.location.id[p.location.id.length - 1] === '0';
    let leftOptions = [];

    if (p.location.id !== p.currentLocation) {
      leftOptions.push({
        id: 'teleport',
        label: p.selectType && p.installing && p.installing === `tselected` || p.i && p.installing === `t${p.i}` ? 'Working...' : 'Teleport Here',
        onClick: ()=>p.onTeleport(p.location, p.selectType ? 'selected' : p.i)
      });
    }
    if (p.isOwnLocation && p.selectType && p.location.username === p.username) {
      leftOptions.push({
        id: 'edit',
        label: p.edit ? 'Cancel' : 'Edit Details',
        onClick: ()=>p.onEdit()
      });
    }
    if (isOwnLocation) {
      leftOptions.push({
        id: 'uploadScreen',
        label: 'Upload Screenshot',
        onClick: ()=>p.onUploadScreen()
      });
      if (deleteArg) {
        leftOptions.push({
          id: 'deleteScreen',
          label: 'Delete Screenshot',
          onClick: ()=>p.onDeleteScreen()
        });
      } else {
        let refLeftOption = _.findIndex(leftOptions, {id: 'deleteScreen'});
        _.pullAt(leftOptions, refLeftOption);
      }
    } else if (p.selectType && p.location.id !== p.currentLocation) {
      leftOptions.push({
        id: 'removeStored',
        label: 'Remove From Storage',
        onClick: ()=>p.onRemoveStoredLocation()
      });
    }

    return (
        <div
        className="ui segment"
        style={{
          background: p.selectType ? 'rgba(23, 26, 22, 0.9)' : 'rgb(23, 26, 22)',
          display: 'inline-table',
          opacity: this.state.isVisible ? '1' : '0',
          borderTop: '2px solid #95220E',
          textAlign: 'left',
          marginTop: p.selectType ? '26px' : 'initial',
          marginBottom: '26px',
          marginRight: !p.selectType && p.i % 1 === 0 ? '26px' : 'initial',
          minWidth: `${compact ? 358 : 386}px`,
          maxWidth: '386px',
          minHeight: '245px',
          maxHeight: '289px',
          zIndex: p.mapZoom ? '91' : 'inherit',
          position: p.mapZoom ? 'fixed' : '',
          left: p.mapZoom ? '28px' : 'inherit',
          top: p.mapZoom ? `${p.height - 365}px` : 'inherit',
          WebkitUserSelect: 'none'
        }}>
          <VisibilitySensor
          active={p.enableVisibilityCheck}
          partialVisibility={true}
          onChange={this.onVisibilityChange}>
            <h3 style={{
              textAlign: 'center',
              maxHeight: '23px',
              cursor: p.selectType ? 'default' : 'pointer'
            }}
            onClick={()=>state.set({selectedLocation: p.location, selectedGalaxy: p.location.galaxy})}>
              {p.edit && this.state.name.length > 0 ? this.state.name : p.location.username ? p.name.length > 0 ? p.name : `${p.location.username} explored` : 'Selected'}
            </h3>
          </VisibilitySensor>

          {this.state.isVisible ?
          <i
          style={this.starStyle}
          className={`${upvote ? '' : 'empty '}star icon`}
          onClick={()=>p.onFav(p.location)} /> : null}
          {this.state.isVisible ?
          <div style={{
            position: 'absolute',
            left: '17px',
            right: compact ? '143px' : 'initial',
            top: '16px'
          }}>
            {leftOptions.length > 0 ?
            <BasicDropdown
            icon="ellipsis horizontal"
            showValue={null}
            persist={p.edit}
            options={leftOptions} /> : null}
            {p.location.base ?
            <span data-tip={utils.tip('Base')} style={{position: 'absolute', left: '26px', top: '0px'}}>
              <img style={this.baseStyle} src={baseIcon} />
            </span> : null}
            {isSpaceStation ?
            <span data-tip={utils.tip('Space Station')} style={{position: 'absolute', left: '26px', top: '0px'}}>
              <img style={this.baseStyle} src={spaceStationIcon} />
            </span> : null}
          </div> : null}
          {p.edit && this.state.isVisible ?
          <div>
            <div
            className="ui segment"
            style={this.uiSegmentEditStyle}>
              <div className="ui input" style={{width: '200px'}}>
                <div className="row">
                  <input
                  style={this.inputStyle}
                  type="text"
                  value={this.state.name}
                  onChange={(e)=>this.setState({name: e.target.value})}
                  maxLength={30}
                  placeholder="Name" />
                </div>
              </div>
              <div className="ui input" style={{width: '200px'}}>
                <div className="row">
                  <textarea
                  style={this.textareaStyle}
                  type="text"
                  value={this.state.description}
                  onChange={(e)=>this.setState({description: e.target.value})}
                  maxLength={200}
                  placeholder="Description... (200 character limit)" />
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-xs-6">
                <Button onClick={()=>p.onSubmit(this.state.name, this.state.description)}>
                  {p.updating ? 'Updating...' : this.state.limit ? `Limit exceeded (${this.state.description.length} characters)` : 'Update Location'}
                </Button>
              </div>
            </div>
          </div>
          : this.state.isVisible ?
          <div>
            <div
            ref="scrollBox"
            style={this.scrollBoxStyle}>
              {p.image && p.image.length > 0 ?
              <div style={{textAlign: 'center'}}>
                <img
                style={this.imageStyle}
                src={`${IMAGE_DOMAIN}${p.image}`}
                onClick={()=>state.set({selectedImage: p.image})} />
              </div> : null}
              {p.location.description ? <Item label="Description" value={p.location.description} /> : null }
              <Item label="Galactic Address" value={p.location.translatedId} />
              <Item label="Voxel Address" value={p.location.id} />
              {p.location.galaxy !== undefined ? <Item label="Galaxy" value={state.galaxies[p.location.galaxy]} /> : null}
              <Item label="Distance to Center" value={`${p.location.distanceToCenter.toFixed(3)} LY`} />
              <Item label="Jumps" value={p.location.jumps} />
              {p.location.mode ? <Item label="Mode" value={_.upperFirst(p.location.mode)} /> : null}
              {p.location.teleports ? <Item label="Teleports" value={p.location.teleports} /> : null}
              {p.location.score ? <Item label="Favorites" value={p.location.score} /> : null}
              {p.name.length > 0 ? <Item label="Explored by" value={p.location.username} /> : null}
              <Item label="Created" value={moment(p.location.timeStamp).format('MMMM D, Y')} />
              {p.location.mods && p.location.mods.length > 0 ?
              <div
              className="ui segment"
              style={utils.css(locationItemStyle)}>
                <span style={{fontWeight: '600'}}>Mods Used ({p.location.mods.length})</span>:
                {_.map(p.location.mods, (mod, i)=>{
                  return (
                    <div
                    key={i}
                    className="ui segment"
                    style={utils.css(locationItemStyle, {
                      marginTop: i === 0 ? '14px' : '0px',
                      marginBottom: '0px',
                      fontSize: '14px'
                    })}>
                      {_.truncate(mod, {length: 43})}
                    </div>
                  );
                })}
              </div> : null}
            </div>
          </div> : null}
        </div>

    );
  }
};

LocationBox.defaultProps = {
  selectType: false,
  name: '',
  description: ''
};

class RemoteLocations extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
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
        this.refs.recentExplorations.addEventListener('scroll', this.scrollListener);
      } else {
        _.delay(()=>checkRemote(), 500);
      }
    };
    checkRemote();
    this.throttledPagination = _.throttle(this.props.onPagination, 1000, {leading: true});
  }
  shouldComponentUpdate(nextProps) {
    return (nextProps.s.remoteLocations.results !== this.props.s.remoteLocations.results
      || nextProps.s.favorites !== this.props.s.favorites
      || nextProps.updating !== this.props.updating
      || nextProps.s.installing !== this.props.s.installing
      || nextProps.s.mapZoom !== this.props.s.mapZoom
      || nextProps.s.width !== this.props.s.width)
  }
  componentWillUnmount(){
    if (this.refs.recentExplorations) {
      this.refs.recentExplorations.removeEventListener('scroll', this.scrollListener);
    }
  }
  scrollListener(){
    if (!this.props.s.remoteLocations.next) {
      return;
    }
    let node = this.refs.recentExplorations;
    if (node.scrollTop + window.innerHeight >= node.scrollHeight + node.offsetTop - 180
      && this.props.s.remoteLocations.next) {
      this.throttledPagination(this.props.s.page);
    }
  }
  handleFavorite(location, upvote){
    this.props.onFav(location, upvote)
  }
  render(){
    let p = this.props;
    let remoteLocationsWidth = `${p.s.width <= 1747 ? 441 : p.s.width <= 2164 ? 902 : 1300}px`;
    let containerStyle = {
      position: 'absolute',
      right: p.s.mapZoom ? '0px' : '68px',
      zIndex: p.s.mapZoom && p.s.width >= 1854 ? '91' : 'inherit',
      maxWidth: remoteLocationsWidth,
      opacity: p.s.mapZoom && (p.s.width < 1804 && p.s.selectedLocation || p.s.width < 1694) ? '0.5' : '1',
      WebkitTransition: '0.1s opacity'
    };
    let uiSegmentsStyle = {
      display: 'inline-flex',
      paddingTop: '14px',
      width: p.s.mapZoom ? '400px !important' : 'inherit'
    };
    let innerContainerStyle = {
      maxHeight: `${p.s.height - 125}px`,
      width: p.s.mapZoom ? '400px' : remoteLocationsWidth,
      minWidth: '400px',
      maxWidth: p.s.mapZoom ? `${Math.abs(p.s.width - 1482)}px !important` : remoteLocationsWidth,
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'relative'
    };
    let enableVisibilityCheck = p.s.remoteLength >= 200;
    return (
      <div className="columns" style={containerStyle}>
        <div className="ui segments" style={uiSegmentsStyle}>
          <div className="ui segment" style={this.uiSegmentStyle}>
            <h3>{p.s.sort === '-created' ? 'Recent' : p.s.sort === '-score' ? 'Favorite' : 'Popular'} Explorations</h3>
            <div
            style={innerContainerStyle}
            ref="recentExplorations">
              {_.map(p.s.remoteLocations.results, (location, i)=>{
                location.data.teleports = location.teleports;
                location.upvote = location.data.upvote;
                return (
                  <LocationBox
                  key={i}
                  i={i}
                  enableVisibilityCheck={enableVisibilityCheck}
                  name={location.name}
                  description={location.description}
                  username={p.s.username}
                  isOwnLocation={p.isOwnLocation}
                  location={location.data}
                  installing={p.s.installing}
                  updating={p.updating}
                  favorites={p.s.favorites}
                  image={location.image}
                  onFav={this.handleFavorite}
                  onTeleport={p.onTeleport}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

class StoredLocationItem extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      hover: false
    };
  }
  render(){
    let uiSegmentStyle = {
      fontFamily: 'geosanslight-nmsregular',
      fontSize: '16px',
      fontWeight: this.props.location.upvote ? '600' : '400',
      cursor: 'pointer',
      padding: '3px 12px 3px 3px',
      background: this.state.hover || this.props.isSelected ? 'rgba(255, 255, 255, 0.1)' : 'inherit',
      textAlign: 'right'
    };
    let name = this.props.location.name && this.props.location.name.length > 0 ? this.props.location.name : this.props.location.id;
    let isMarquee = (this.state.hover || this.props.isSelected) && name.length >= 25;
    name = isMarquee ? name : _.truncate(name, {length: 22});
    let isSpaceStation = this.props.location.id[this.props.location.id.length - 1] === '0';
    return (
      <div
      key={this.props.location.id}
      className="ui segment"
      style={uiSegmentStyle}
      onMouseEnter={()=>this.setState({hover: true})}
      onMouseLeave={()=>this.setState({hover: false})}
      onClick={this.props.onClick}>
        {this.props.location.base ?
        <span data-tip={utils.tip('Base')} style={{position: 'absolute', left: `${this.props.location.upvote ? 31 : 4}px`, top: '4px'}}>
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
        <p className={isMarquee ? 'marquee' : ''} style={{
          maxWidth: `${isMarquee ? 200 : 177}px`,
          whiteSpace: 'nowrap',
          position: 'relative',
          left: `${isMarquee ? 33 : name.length >= 25 ? 76 : 86}px`,
        }}><span>{name}</span></p>
      </div>
    );
  }
}

class StoredLocations extends React.Component {
  constructor(props){
    super(props);
  }
  componentDidMount(){
    this.uiSegmentStyle = {
      background: 'rgba(23, 26, 22, 0.9)',
      display: 'inline-table',
      borderTop: '2px solid #95220E',
      minWidth: '285px',
      maxWidth: '285px',
      textAlign: 'center',
      paddingLeft: '0px',
      paddingRight: '0px'
    };
  }
  shouldComponentUpdate(nextProps){
    return (nextProps.storedLocations !== this.props.storedLocations
      || nextProps.selectedLocationId !== this.props.selectedLocationId
      || nextProps.height !== this.props.height
      || nextProps.mapZoom !== this.props.mapZoom
      || nextProps.filterOthers !== this.props.filterOthers)
  }
  render(){
    let leftOptions = [
      {
        id: 'hideOthers',
        label: this.props.filterOthers ? 'Show all locations' : 'Hide others\' locations',
        onClick: ()=>state.set({filterOthers: !this.props.filterOthers})
      }
    ];
    return (
      <div
        className="ui segment"
        style={{display: 'inline-flex', background: 'transparent', WebkitUserSelect: 'none'}}>
          <div className="ui segment" style={this.uiSegmentStyle}>
            <h3>Stored Locations</h3>
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
            <div className="ui segments" style={{maxHeight: `${this.props.height - (this.props.mapZoom ? 498 : 125)}px`, overflowY: 'auto', overflowX: 'hidden'}}>
              {_.map(this.props.storedLocations, (location, i)=>{
                return (
                  <StoredLocationItem
                  key={i}
                  onClick={()=>this.props.onSelect(location)}
                  isSelected={this.props.selectedLocationId === location.id}
                  location={location}/>
                );
              })}
            </div>
          </div>
        </div>
    );
  }
}

class Container extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      updating: false,
      edit: false,
      mapRender: '<div />'
    };
    autoBind(this);
  }
  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.s.selectedLocation, this.props.s.selectedLocation)) {
      this.setState({edit: false});
    }
  }
  handleFavorite(location){
    let refFav = _.findIndex(this.props.s.favorites, (fav)=>{
      return fav === location.id;
    });
    let upvote = refFav === -1;

    utils.ajax.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      score: location.score,
      upvote: upvote,
      id: location.id
    }).then((res)=>{
      let refLocation = _.findIndex(this.props.s.storedLocations, {id: location.id});
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].score = res.data.score;
        this.props.s.storedLocations[refLocation].upvote = upvote;
      }
      let refRemoteLocation = _.findIndex(this.props.s.remoteLocations.results, (location)=>{
        return location.data.id === location.id;
      });
      if (refRemoteLocation !== -1) {
        _.assignIn(this.props.s.remoteLocations.results[refRemoteLocation].data, {
          score: res.data.score,
          upvote: res.data.upvote,
        });
      }
      if (upvote) {
        this.props.s.favorites.push(location.id);
      } else {
        _.pullAt(this.props.s.favorites, refFav);
      }
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        favorites: _.uniq(this.props.s.favorites)
      });
    }).catch((err)=>{
      log.error(`Failed to favorite remote location: ${err}`);
    });
  }
  handleUpdate(name, description){
    this.setState({updating: true}, ()=>{
      if (description.length > 200) {
        this.setState({limit: true});
        return;
      }
      utils.ajax.post('/nmslocation/', {
        machineId: this.props.s.machineId,
        username: this.props.s.username,
        name: name,
        description: description,
        id: this.props.s.selectedLocation.id
      }).then((res)=>{
        let refLocation = _.findIndex(this.props.s.storedLocations, {id: this.props.s.selectedLocation.id});
        if (refLocation !== -1) {
          this.props.s.storedLocations[refLocation].name = name;
          this.props.s.storedLocations[refLocation].description = description;
        }
        let refRemoteLocation = _.findIndex(this.props.s.remoteLocations.results, (location)=>{
          return location.data.id === this.props.s.selectedLocation.id;
        });
        if (refRemoteLocation !== -1) {
          this.props.s.remoteLocations.results[refRemoteLocation].name = name;
          this.props.s.remoteLocations.results[refRemoteLocation].data.description = description;
          this.props.s.remoteLocations.results[refRemoteLocation].description = description;
        }
        this.props.s.selectedLocation.name = name;
        this.props.s.selectedLocation.description = description;
        state.set({
          storedLocations: this.props.s.storedLocations,
          remoteLocations: this.props.s.remoteLocations,
          selectedLocation: this.props.s.selectedLocation
        }, ()=>{
          this.setState({
            updating: false,
            edit: false
          });
        });
      }).catch((err)=>{
        log.error(`Failed to update remote location: ${err}`);
      });
    });
  }
  handleUploadScreen(e){
    e.persist();
    this.setState({updating: true}, ()=>{
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
            utils.ajax.post('/nmslocation/', {
              machineId: this.props.s.machineId,
              username: this.props.s.username,
              imageU: newDataUri,
              id: this.props.s.selectedLocation.id
            }).then((res)=>{
              let refLocation = _.findIndex(this.props.s.storedLocations, {id: this.props.s.selectedLocation.id});
              if (refLocation !== -1) {
                this.props.s.storedLocations[refLocation].image = res.data.image;
              }
              let refRemoteLocation = _.findIndex(this.props.s.remoteLocations.results, (location)=>{
                return location.data.id === this.props.s.selectedLocation.id;
              });
              if (refRemoteLocation !== -1) {
                this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
              }
              this.props.s.selectedLocation.image = res.data.image;
              state.set({
                storedLocations: this.props.s.storedLocations,
                remoteLocations: this.props.s.remoteLocations,
                selectedLocation: this.props.s.selectedLocation
              }, ()=>{
                this.setState({
                  updating: false,
                  edit: false
                });
              });
            }).catch((err)=>{
              log.error(`Failed to upload screenshot: ${err}`);
            });
          }
        };
        sourceImage.src = reader.result;
        this.refs.uploadScreenshot.value = '';
      };
      reader.readAsDataURL(e.target.files[0]);
    });
  }
  handleDeleteScreen(){
    utils.ajax.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      imageD: true,
      id: this.props.s.selectedLocation.id
    }).then((res)=>{
      let refLocation = _.findIndex(this.props.s.storedLocations, {id: this.props.s.selectedLocation.id});
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].image = res.data.image;
      }
      let refRemoteLocation = _.findIndex(this.props.s.remoteLocations.results, (location)=>{
        return location.data.id === this.props.s.selectedLocation.id;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
      }
      this.props.s.selectedLocation.image = '';
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        selectedLocation: this.props.s.selectedLocation
      }, ()=>{
        this.setState({
          updating: false,
          edit: false
        });
      });
    });
  }
  handleSelectLocation(location){
    location = _.cloneDeep(location);
    let deselected = this.props.s.selectedLocation && this.props.s.selectedLocation.id === location.id;
    if (!deselected) {
      let refRemoteLocation = _.find(this.props.s.remoteLocations.results, (remoteLocation)=>{
        return remoteLocation.data.id === location.id;
      });

      if (refRemoteLocation !== undefined && refRemoteLocation) {
        refRemoteLocation.data.image = refRemoteLocation.image;
        _.assignIn(location, refRemoteLocation.data);
      }
    }
    state.set({
      selectedLocation: deselected ? null : location,
      selectedGalaxy: deselected ? 0 : location.galaxy
    });
  }
  render(){
    let p = this.props;
    let isOwnLocation = _.findIndex(p.s.storedLocations, {id: p.s.selectedLocation ? p.s.selectedLocation.id : null}) !== -1;
    let storedLocations = _.orderBy(p.s.storedLocations, (location)=>{
      return location.upvote !== undefined && location.upvote;
    }, 'desc');
    if (p.s.filterOthers) {
      storedLocations = _.filter(storedLocations, (location)=>{
        return location.username === p.s.username;
      });
    }
    return (
      <div className="ui grid row" style={{paddingTop: '51px', float: 'left', position: 'absolute', margin: '0px auto', left: '0px', right: '0px'}}>
        <input ref="uploadScreenshot" onChange={this.handleUploadScreen} style={{display: 'none'}} type="file" accept="image/*" multiple={false} />
        <div className="columns">
          <div className="ui segments stackable grid container" style={{maxWidth: '800px !important'}}>
            <StoredLocations
            onSelect={this.handleSelectLocation}
            storedLocations={storedLocations}
            selectedLocationId={p.s.selectedLocation ? p.s.selectedLocation.id : null}
            height={p.s.height}
            mapZoom={p.s.mapZoom}
            filterOthers={p.s.filterOthers}
            username={p.s.username}/>
            <div className="ui segments" style={{display: 'inline-flex', paddingTop: '14px', marginLeft: '0px'}}>
              <GalacticMap
              mapZoom={p.s.mapZoom}
              mapLines={p.s.mapLines}
              galaxyOptions={p.s.galaxyOptions}
              selectedGalaxy={p.s.selectedGalaxy}
              storedLocations={p.s.storedLocations}
              width={p.s.width}
              height={p.s.height}
              remoteLocations={p.s.remoteLocations}
              selectedLocation={p.s.selectedLocation}
              currentLocation={p.s.currentLocation}
              username={p.s.username}
              show={p.s.show} />
              {p.s.selectedLocation ?
              <LocationBox
              name={p.s.selectedLocation.name}
              description={p.s.selectedLocation.description}
              username={p.s.username}
              selectType={true}
              currentLocation={p.s.currentLocation}
              isOwnLocation={isOwnLocation}
              location={p.s.selectedLocation}
              installing={p.s.installing}
              updating={this.state.updating}
              edit={this.state.edit}
              favorites={p.s.favorites}
              image={p.s.selectedLocation.image}
              width={p.s.width}
              height={p.s.height}
              mapZoom={p.s.mapZoom}
              onUploadScreen={()=>this.refs.uploadScreenshot.click()}
              onDeleteScreen={this.handleDeleteScreen}
              onFav={this.handleFavorite}
              onEdit={()=>this.setState({edit: !this.state.edit})}
              onRemoveStoredLocation={p.onRemoveStoredLocation}
              onTeleport={(location, type)=>p.onTeleport(location, type)}
              onSubmit={(name, description)=>this.handleUpdate(name, description)}
               /> : null}
            </div>
          </div>
        </div>
        {p.s.remoteLocations && p.s.remoteLocations.results ?
        <RemoteLocations
        s={p.s}
        currentLocation={p.s.currentLocation}
        isOwnLocation={isOwnLocation}
        updating={this.state.updating}
        onPagination={p.onPagination}
        onTeleport={p.onTeleport}
        onFav={this.handleFavorite}/> : null}
      </div>
    );
  }
};

class App extends Reflux.Component {
  constructor(props) {
    super(props);

    this.state = {};
    this.store = state;
    autoBind(this);
  }
  componentDidMount(){
    log.init(this.state.configDir);
    log.error(`Initializing No Man's Connect ${this.state.version}`);
    this.handleWorkers();
    window.handleWallpaper = this.handleWallpaper
    this.saveJSON = path.join(__dirname, 'saveCache.json');
    this.saveJSON = path.resolve(__dirname, this.saveJSON);
    this.saveTool = process.env.NODE_ENV === 'production' ? '\\nmssavetool\\nmssavetool.exe' : '\\app\\nmssavetool\\nmssavetool.exe';
    this.whichCmd = `.${this.saveTool} decrypt -g ${this.state.mode} -o ${this.saveJSON}`;

    window.ajaxWorker.postMessage({
      method: 'get',
      func: 'version',
      url: '/nmslocation',
      obj: {
        params: {
          version: true
        }
      }
    });

    let initialize = ()=>{
      machineId().then((id)=>{
        this.pollSaveData(this.state.mode, true, id);
      }).catch((err)=>{
        console.log(err);
        this.pollSaveData(this.state.mode, true, null);
      });
    };

    let indexMods = ()=>{
      let letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'X', 'Z'];
      let indexModsInUse = (_path, modPath)=>{
        fs.readFile(`${_path}\\Binaries\\SETTINGS\\TKGRAPHICSSETTINGS.MXML`, (err, data)=>{
          if (!err) {
            let fullscreen = data.toString().split('<Property name="FullScreen" value="')[1].substr(0, 4);
            if (fullscreen === 'true') {
              state.set({autoCapture: false});
            }
          }
          fs.readdir(`${_path}${modPath}`, (err, list)=>{
            if (err) {
              log.error(`Failed to read mods directory: ${err}`);
              this.handleInstallDirFailure();
              return;
            }
            list = _.filter(list, (item)=>{
              return item.toLowerCase().indexOf('.pak') !== -1;
            });
            state.set({mods: list}, ()=>{
              initialize();
            });
          });
        });
      };

      let paths = [
        `/Program Files (x86)/GalaxyClient/Games/No Man's Sky`,
        `/Program Files (x86)/Steam/steamapps/common/No Man's Sky`,
        `/Steam/steamapps/common/No Man's Sky`,
        `/steamapps/common/No Man's Sky`,
        `/Program Files/No Man's Sky`,
        `/GOG Games/No Man's Sky`,
        `/Games/No Man's Sky`,
      ];

      if (this.state.installDirectory) {
        paths = [this.state.installDirectory.split(':\\')[1]].concat(paths);
      }

      let modPath = `\\GAMEDATA\\PCBANKS\\MODS`;

      let hasPath = false;
      each(letters, (drive, key)=>{
        each(paths, (_path)=>{
          let __path = `${drive}:${_path}`;
          if (fs.existsSync(__path)) {
            hasPath = true;
            indexModsInUse(__path, modPath);
            return;
          }
        });
      });
      if (!hasPath) {
        log.error('Failed to locate NMS install: path doesn\'t exist.')
        initialize();
      }
    };
    indexMods();
  }
  componentDidUpdate(pP, pS){
    if (pS.search.length > 0 && this.state.search.length === 0 && this.state.searchInProgress) {
      state.set({searchInProgress: false}, ()=>{
        this.handleClearSearch();
      });
    }
  }
  handleWorkers(){
    window.ajaxWorker.onmessage = (e)=>{
      if (e.data.err) {
        log.error(`AJAX Worker failure: ${e.data.func}`);
        state.set({init: false});
        if (e.data.func === 'handleSync') {
          this.fetchRemoteLocations(e.data.params[0], e.data.params[1], e.data.params[2], true);
        }
        return;
      }
      console.log('AJAX WORKER: ', e.data);
      if (e.data.func === 'version') {
        if (e.data.data.version !== this.state.version) {
          this.handleUpgrade();
        }
      } else if (e.data.func === 'syncRemoteOwned') {
        this.formatRemoteLocations(e.data, 1, this.state.sort, false, true, true);
      } else if (e.data.func === 'handleSync') {
        this.fetchRemoteLocations(e.data.params[0], e.data.params[1], e.data.params[2], true, true);
      } else if (e.data.func === 'fetchRemoteLocations') {
        this.formatRemoteLocations(e.data, e.data.params[0], e.data.params[1], e.data.params[2], false, e.data.params[3], ()=>{
          if (e.data.params[2]) { // init
            this.pollRemoteLocations(e.data.params[2]);
          }
        });
      } else if (e.data.func === 'pollRemoteLocations') {
        if (e.data.data.results.length > 0) {
          this.formatRemoteLocations(e.data, e.data.params[0], e.data.params[1], false, true, false, ()=>{
            this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
          });
        } else {
          this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
        }
      }
    }
    window.formatWorker.onmessage = (e)=>{
      console.log('FORMAT WORKER: ', e.data);
      state.set(e.data.stateUpdate, null, e.data.sync);
    };
  }
  syncRemoteOwned(cb=null){
    window.ajaxWorker.postMessage({
      method: 'get',
      func: 'syncRemoteOwned',
      url: '/nmslocationsync',
      obj: {
        params: {
          username: this.state.username
        }
      }
    });
    if (cb) {
      _.defer(cb);
    }
  }
  handleSync(page=1, sort=this.state.sort, init=false){
    this.syncRemoteOwned(()=>{
      let locations = [];
      each(this.state.storedLocations, (location)=>{
        location = _.cloneDeep(location);
        location.timeStamp = new Date(location.timeStamp);
        locations.push(location);
      });
      window.ajaxWorker.postMessage({
        method: 'post',
        func: 'handleSync',
        url: '/nmslocationremotesync/',
        obj: {
          locations: locations,
          mode: this.state.mode,
          username: this.state.username
        },
        params: [page, sort, init]
      });
    });
  }
  formatRemoteLocations(res, page, sort, init, partial, sync, cb=null){
    if (this.state.remoteLocations.length === 0 || !this.state.remoteLocations) {
      this.state.remoteLocations = {
        results: []
      };
    }

    window.formatWorker.postMessage({
      res: res,
      page: page,
      sort: sort,
      init: init,
      partial: partial,
      sync: sync,
      state: {
        remoteLocations: this.state.remoteLocations,
        search: this.state.search,
        sort: this.state.sort,
        favorites: this.state.favorites,
        storedLocations: this.state.storedLocations,
      }
    });

    if (cb) {
      _.defer(cb);
    }
  }
  pollRemoteLocations(init=false){
    if (this.timeout)  {
      clearTimeout(this.timeout);
    }

    if (this.state.sort !== '-created' || this.state.remoteLocations.results.length === 0 || init) {
      this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
      return;
    }

    let lastRemoteLocation = _.chain(this.state.remoteLocations.results).orderBy('created', 'desc').first().value();

    let start = new Date(lastRemoteLocation.created);
    let end = new Date();

    window.ajaxWorker.postMessage({
      method: 'get',
      func: 'pollRemoteLocations',
      url: '/nmslocationpoll',
      obj: {
        params: {
          start: start,
          end: end,
          id: lastRemoteLocation.data.id
        }
      },
      params: [this.state.page, this.statesort]
    });
  }
  fetchRemoteLocations(page=this.state.page, sort=this.state.sort, init=false, sync=false){
    let q = this.state.search.length > 0 ? this.state.search : null;
    let path = q ? '/nmslocationsearch' : '/nmslocation';
    window.ajaxWorker.postMessage({
      method: 'get',
      func: 'fetchRemoteLocations',
      url: path,
      obj: {
        params: {
          page: page,
          sort: sort,
          q: q
        }
      },
      params: [page, sort, init, sync]
    });
  }
  handleCheat(id, n){
    let currentLocation = _.find(this.state.storedLocations, {id: this.state.currentLocation});
    if (currentLocation) {
      this.handleTeleport(currentLocation, 0, id, n);
    }
  }
  handleTeleport(location, i, action=null, n=null){
    state.set({installing: `t${i}`}, ()=>{
      utils.getLastGameModeSave(this.state.saveDirectory, this.state.mode).then((saveData)=>{
        if (location.data) {
          location = location.data;
        }

        _.assignIn(saveData.result.SpawnStateData, {
          PlayerPositionInSystem: location.playerPosition,
          PlayerTransformAt: location.playerTransform,
          ShipPositionInSystem: location.shipPosition,
          ShipTransformAt: location.shipTransform
        });

        _.assignIn(saveData.result.PlayerStateData.UniverseAddress.GalacticAddress, {
          PlanetIndex: location.PlanetIndex,
          SolarSystemIndex: location.SolarSystemIndex,
          VoxelX: location.VoxelX,
          VoxelY: location.VoxelY,
          VoxelZ: location.VoxelZ
        });

        if (action) {
          saveData.result = utils[action](saveData, n);
        }

        saveData.result.PlayerStateData.UniverseAddress.RealityIndex = location.galaxy;

        fs.writeFile(this.saveJSON, JSON.stringify(saveData.result), {flag : 'w'}, (err, data)=>{
          if (err) {
            console.log(err);
          }
          let absoluteSaveDir = this.state.saveFileName.split('\\');
          _.pullAt(absoluteSaveDir, absoluteSaveDir.length - 1);
          absoluteSaveDir = absoluteSaveDir.join('\\');
          utils.exc(`.${this.saveTool} encrypt -g ${this.state.mode} -i ${this.saveJSON} -s ${absoluteSaveDir}`, (res)=>{
            console.log(res);
          }).catch((e)=>{
            console.log(e);
          });
          let refStoredLocation = _.findIndex(this.state.storedLocations, {id: location.id});
          if (refStoredLocation !== -1) {
            state.set({installing: false});
            return;
          }
          utils.ajax.post('/nmslocation/', {
            machineId: this.state.machineId,
            teleports: true,
            id: location.id
          }).then((res)=>{
            let refRemoteLocation = _.findIndex(this.state.remoteLocations.results, (remoteLocation)=>{
              return remoteLocation.data.id === location.id;
            });
            if (refRemoteLocation !== -1) {
              this.state.remoteLocations.results[refRemoteLocation] = res.data;
            }

            state.set({
              installing: false,
              currentLocation: location.id,
              remoteLocations: this.state.remoteLocations
            });
          }).catch((err)=>{
            log.error(`Unable to send teleport stat to server: ${err}`);
            state.set({installing: false});
          });
        });
      }).catch((err)=>{
        console.log(err);
        log.error(`Unable to teleport to location: ${err}`);
        this.handleSaveDataFailure(this.state.mode, false, ()=>{
          this.handleTeleport(location, i);
        });
      });
    });
  }
  pollSaveData(mode, init=false, machineId=this.state.machineId){
    let getLastSave = (NMSRunning=false)=>{
      let next = ()=>{
        if (init) {
          this.handleWallpaper();
          this.handleSync(1, this.state.sort, init);
        } else {
          this.fetchRemoteLocations(1, this.state.sort, init);
        }
        if (init) {
          watch.createMonitor(this.state.saveDirectory, {
            ignoreDotFiles: true,
            ignoreNotPermitted: true,

          }, (monitor)=>{
            this.pollSaveDataThrottled = _.throttle(this.pollSaveData, 15000, {leading: true});
            monitor.on('changed', (f, curr, prev)=>{
              this.pollSaveDataThrottled();
            });
          });
        }
      };

      if (mode && mode !== this.state.mode) {
        this.state.mode = mode;
      }

      let processData = (saveData, location, refLocation, username, profile=null)=>{
        /*let uniquePlayers = [];
        each(saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record, (record)=>{
          uniquePlayers.push(record.OWS.USN);
        });
        console.log(_.uniq(uniquePlayers))*/
        username = _.isString(username) && username.length > 0 ? username : '';

        console.log('SAVE DATA: ', saveData.result)

        let refFav = _.findIndex(this.state.favorites, (fav)=>{
          return fav === location.id;
        });
        let upvote = refFav !== -1;

        screenshot(init || !NMSRunning || !this.state.autoCapture, (image)=>{
          if (refLocation === -1) {
            _.assignIn(location, {
              username: username,
              playerPosition: _.clone(saveData.result.SpawnStateData.PlayerPositionInSystem),
              playerTransform: _.clone(saveData.result.SpawnStateData.PlayerTransformAt),
              shipPosition: _.clone(saveData.result.SpawnStateData.ShipPositionInSystem),
              shipTransform: _.clone(saveData.result.SpawnStateData.ShipTransformAt),
              galaxy: _.clone(saveData.result.PlayerStateData.UniverseAddress.RealityIndex),
              distanceToCenter: Math.sqrt(Math.pow(location.VoxelX, 2) + Math.pow(location.VoxelY, 2) + Math.pow(location.VoxelZ, 2)) * 100,
              translatedX: utils.convertInteger(location.VoxelX, 'x'),
              translatedZ: utils.convertInteger(location.VoxelZ, 'z'),
              translatedY: utils.convertInteger(location.VoxelY, 'y'),
              upvote: upvote,
              image: image,
              mods: this.state.mods,
              timeStamp: Date.now(),
            });

            location.jumps = Math.ceil(location.distanceToCenter / 400);

            location.translatedId = `${utils.toHex(location.translatedX, 4)}:${utils.toHex(location.translatedY, 4)}:${utils.toHex(location.translatedZ, 4)}:${utils.toHex(location.SolarSystemIndex, 4)}`;

            if (location.translatedId.toLowerCase().indexOf('nan') !== -1) {
              console.error(`translatedId formatting is NaN: ${location}`);
              state.set({username: location.username}, ()=>{
                next();
              });
              return;
            }

            this.state.storedLocations.push(location);
            this.state.storedLocations =  _.chain(this.state.storedLocations).uniqBy('id').orderBy('timeStamp', 'desc').value();

          }

          // Detect player base

          let base = null;
          let refBase = _.find(saveData.result.PlayerStateData.TeleportEndpoints, {TeleporterType: 'Base'});
          let baseFound = refBase !== undefined && refBase
          if (baseFound) {
            base = utils.formatID(refBase.UniverseAddress);
          }

          each(this.state.storedLocations, (storedLocation, i)=>{
            if (_.isString(storedLocation.timeStamp)) {
              this.state.storedLocations[i].timeStamp = new Date(storedLocation.timeStamp).getTime()
            }
            if (baseFound) {
              let hasBase = (base.VoxelX === storedLocation.VoxelX
                && base.VoxelY === storedLocation.VoxelY
                && base.VoxelZ === storedLocation.VoxelZ
                && base.SolarSystemIndex === storedLocation.SolarSystemIndex
                && base.PlanetIndex === storedLocation.PlanetIndex
                && refBase.UniverseAddress.RealityIndex === storedLocation.galaxy);
              this.state.storedLocations[i].base = hasBase;
            }
          });
          this.state.storedLocations = _.orderBy(this.state.storedLocations, 'timeStamp', 'desc');

          let stateUpdate = {
            storedLocations: this.state.storedLocations,
            currentLocation: location.id,
            username: username,
            saveDirectory: this.state.saveDirectory,
            saveFileName: saveData.path,
            machineId: machineId
          };

          if (profile) {
            stateUpdate.profile = profile.data;
          }

          if (init) {
            log.error(`Username: ${stateUpdate.username}`);
            log.error(`Active save file: ${stateUpdate.saveFileName}`);
            log.error(`Current location: ${stateUpdate.currentLocation}`);
          }

          state.set(stateUpdate, ()=>{
            if (refLocation === -1) {
              utils.ajax.post('/nmslocation/', {
                machineId: this.state.machineId,
                username: location.username,
                mode: this.state.mode,
                image: image,
                data: location
              }).then((res)=>{
                next();
              }).catch((err)=>{
                next();
              });
            } else {
              next();
            }
          });
        });
      }

      console.log(this.state.saveDirectory)

      utils.getLastGameModeSave(this.state.saveDirectory, this.state.mode).then((saveData)=>{
        let location = utils.formatID(saveData.result.PlayerStateData.UniverseAddress);
        const refLocation = _.findIndex(this.state.storedLocations, {id: location.id});
        let username = saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record[0].OWS.USN;

        utils.ajax.get('/nmsprofile', {
          params: {
            username: username,
            machineId: machineId
          }
        }).then((profile)=>{
          processData(saveData, location, refLocation, username, profile);
        }).catch((err)=>{
          console.log(err)

          if (err.response && err.response.status === 403) {
            this.handleProtectedSession(username);
          } else {
            processData(saveData, location, refLocation, username);
          }
        });

      }).catch((err)=>{
        console.log(err, this.state.saveDirectory, this.state.saveFileName)
        log.error(`Unable to retrieve NMS save file: ${err}`)
        log.error(`${this.state.saveDirectory}, ${this.state.saveFileName}`);
        try {
          log.error(err.stack)
        } catch (e) {}

        this.handleSaveDataFailure(mode, init, ()=>{
          this.pollSaveData(mode, init);
        });
      });
    };

    if (parseFloat(this.state.winVersion) <= 6.1) {
      log.error(`Skipping process scan for Windows 7 user...`)
      getLastSave(false);
    } else {
      ps.snapshot(['ProcessName']).then((list) => {
        let NMSRunning = _.findIndex(list, {ProcessName: 'NMS.exe'}) !== -1;
        getLastSave(NMSRunning);
      }).catch((err)=>{
        log.error(`Unable to use win-ps: ${err}`);
        getLastSave(false);
      });
    }
  }
  handleProtectedSession(username){
    dialog.showMessageBox({
      title: `Protection Enabled For ${username}`,
      message: 'This username was protected by another user. When you protect your username, the app will associate your computer with your username to prevent impersonation. If this is in error, please open an issue on the Github repository.',
      buttons: ['OK', 'Open Issue']
    }, result=>{
      if (result === 1) {
        openExternal('https://github.com/jaszhix/NoMansConnect/issues');
        window.close();
      } else {
        window.close();
      }
    });
  }
  handleRemoveStoredLocation(){
    if (this.state.selectedLocation.id === this.state.currentLocation) {
      log.error('Failed to remove stored location: cannot remove the player\'s current location.');
      return;
    }
    let refStoredLocation = _.findIndex(this.state.storedLocations, {id: this.state.selectedLocation.id});
    _.pullAt(this.state.storedLocations, refStoredLocation);
    state.set({
      storedLocations: this.state.storedLocations,
      selectedLocation: null
    });
  }
  stateChange(e){
    this.setState(e);
  }
  onWindowResize(){
    state.set({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }
  handleInstallDirFailure(){
    state.set({
      title: 'NMS Install Directory Not Found, Please Select Location'
    }, ()=>{
      this.handleSelectInstallDirectory();
    });
  }
  handleSaveDataFailure(mode=this.state.mode, init=false, cb){
    state.set({
      title: 'NMS Save Directory Not Found, Please Select Location'
    }, ()=>{
      this.handleSelectSaveDirectory();
    });
  }
  handleUpgrade(){
    log.error(`Newer version of NMC found.`);
    var infoUrl = 'https://github.com/jaszhix/NoMansConnect/releases';
    var helpMessage = 'A newer version of No Man\'s Connect was found.';

    _.defer(()=>{
      dialog.showMessageBox({
        title: 'No Man\'s Connect Upgrade',
        message: helpMessage,
        buttons: ['OK', 'Check releases']
      }, result=>{
        if (result === 1) {
          openExternal(infoUrl);
        } else {
          return;
        }
      });
    });
  }
  handleEnter(e){
    if (e.keyCode === 13) {
      this.fetchRemoteLocations(1)
    }
  }
  handleSort(sort){
    state.set({sort: sort}, ()=>{
      this.fetchRemoteLocations(1, sort);
    });
  }
  handleSearch(){
    state.set({remoteLocationsCache: this.state.remoteLocations}, ()=>{
      this.fetchRemoteLocations(1);
    });
  }
  handleClearSearch(){
    state.set({search: ''}, ()=>{
      window.jsonWorker.postMessage({
        method: 'get',
        key: 'remoteLocations'
      });
    })
  }
  handleWallpaper(){
    let wallpaper = defaultWallpaper;
    if (this.state.wallpaper) {
      try {
        wallpaper = `data:${_.last(this.state.wallpaper.split('.'))};base64,${fs.readFileSync(this.state.wallpaper).toString('base64')}`;
      } catch (err) {
        log.error(`Unable to set wallpaper: ${err}`);
      }
    }
    $(document.body).css({
      backgroundImage: `url(${wallpaper})`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    });
  }
  handleSetWallpaper(){
    if (this.state.wallpaper) {
      state.set({wallpaper: null}, ()=>{
        this.handleWallpaper();
      });
      return;
    }
    dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif']},],
    }, (cb)=>{
      if (cb && cb[0]) {
        state.set({
          wallpaper: cb[0]
        }, ()=>{
          this.handleWallpaper();
        });
      }
    });
  }
  handleSelectInstallDirectory(){
    dialog.showOpenDialog({properties: ['openDirectory']}, (cb)=>{
      if (cb && cb[0]) {
        state.set({
          installDirectory: cb[0]
        }, ()=>{
          this.handleRestart();
        });
      }
    });
  }
  handleSelectSaveDirectory(){
    dialog.showOpenDialog({properties: ['openDirectory']}, (cb)=>{
      if (cb && cb[0]) {
        state.set({
          saveDirectory: cb[0],
          title: 'No Man\'s Connect'
        }, ()=>{
          this.handleRestart();
        });
      }
    });
  }
  handleRestart(){
    remote.app.relaunch();
    window.close();
  }
  handleMaximize(){
    state.set({maximized: !this.state.maximized}, ()=>{
      if (this.state.maximized) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    });
  }
  render(){
    var s = this.state;
    return (
      <div>
        <div className="ui top attached menu" style={{
          position: 'absolute',
          maxHeight: '42px',
          zIndex: '99',
          WebkitUserSelect: 'none',
          WebkitAppRegion: 'drag'
        }}>
          <h2 style={{
            position: 'absolute',
            left: '16px',
            top: '5px',
            margin: 'initial',
            WebkitTransition: 'left 0.1s',
            textTransform: 'uppercase'
          }}>{s.title}</h2>
          <div className="right menu">
            {!s.init ?
            <div
            style={{WebkitAppRegion: 'no-drag'}}
            className={`ui dropdown icon item${s.sort === '-created' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('-created')}>
              Recent
            </div> : null}
            {!s.init ?
            <div
            style={{WebkitAppRegion: 'no-drag'}}
            className={`ui dropdown icon item${s.sort === '-teleports' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('-teleports')}>
              Popular
            </div> : null}
            {!s.init ?
            <div
            style={{WebkitAppRegion: 'no-drag'}}
            className={`ui dropdown icon item${s.sort === '-score' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('-score')}>
              Favorites
            </div> : null}
            {/*<div
            className={`ui dropdown icon item${s.sort === 'distanceToCenter' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('distanceToCenter')} >
              Distance
            </div>*/}
            {!s.init ?
            <div className="item">
              <div
              className="ui transparent icon input"
              style={{width: '250px', WebkitUserSelect: 'initial', WebkitAppRegion: 'no-drag', fontSize: '15px'}}>
                <input type="text" style={{letterSpacing: '2px'}} placeholder="Search..." value={s.search} onChange={(e)=>state.set({search: e.target.value})} onKeyDown={this.handleEnter}/>
                <i className={s.searchInProgress ? 'remove link icon' : 'search link icon'} style={{cursor: 'default', padding: '0px'}} onClick={s.searchInProgress ? ()=>this.handleClearSearch() : ()=>this.handleSearch()}/>
              </div>
            </div> : null}
            {s.profile ?
            <SaveEditorDropdownMenu
            profile={s.profile}
            editorOpen={s.editorOpen}
            onCheat={this.handleCheat}
            /> : null}
            <DropdownMenu
            s={s}
            onSelectSaveDirectory={this.handleSelectSaveDirectory}
            onSelectInstallDirectory={this.handleSelectInstallDirectory}
            onRestart={this.handleRestart}
            onSync={this.handleSync}
            onSetWallpaper={this.handleSetWallpaper}
            onModeSwitch={(mode)=>this.pollSaveData(mode)}  />
          </div>
          <div
          style={{WebkitAppRegion: 'no-drag', paddingRight: '0px'}}
          className={`ui dropdown icon item`}
          onClick={()=>this.handleSort('-created')}>
            <div className="titlebar-controls">
              <div className="titlebar-minimize" onClick={()=>win.minimize()}>
                <svg x="0px" y="0px" viewBox="0 0 10 1">
                  <rect fill="#FFFFFF" width="10" height="1"></rect>
                </svg>
              </div>
              <div className="titlebar-resize" onClick={this.handleMaximize}>
                {s.maximized ?
                <svg className="fullscreen-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <path fill="#FFFFFF" d="M 0 0 L 0 10 L 10 10 L 10 0 L 0 0 z M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 z "/>
                </svg>
                :
                <svg className="maximize-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <mask id="Mask">
                    <path fill="#FFFFFF" d="M 3 1 L 9 1 L 9 7 L 8 7 L 8 2 L 3 2 L 3 1 z"/>
                    <path fill="#FFFFFF" d="M 1 3 L 7 3 L 7 9 L 1 9 L 1 3 z"/>
                  </mask>
                  <path fill="#FFFFFF" d="M 2 0 L 10 0 L 10 8 L 8 8 L 8 10 L 0 10 L 0 2 L 2 2 L 2 0 z" mask="url(#Mask)"/>
                </svg>}
              </div>
              <div className="titlebar-close" onClick={()=>win.close()}>
                <svg x="0px" y="0px" viewBox="0 0 10 10">
                  <polygon fill="#FFFFFF" points="10,1 9,0 5,4 1,0 0,1 4,5 0,9 1,10 5,6 9,10 10,9 6,5"></polygon>
                </svg>
              </div>
            </div>
          </div>
        </div>
        {this.state.selectedImage ? <ImageModal image={this.state.selectedImage} /> : null}
        {s.init ?
        <Loader />
        :
        <Container
        s={s}
        onTeleport={(location, i)=>this.handleTeleport(location, i)}
        onPagination={(page)=>this.fetchRemoteLocations(++page)}
        onRemoveStoredLocation={this.handleRemoveStoredLocation} />}
        <ReactTooltip
        effect="solid"
        place="bottom"
        multiline={true}
        html={true}
        offset={{top: 0, left: 6}} />
      </div>
    );
  }
};
reactMixin(App.prototype, ReactUtils.Mixins.WindowSizeWatch);
// Render to the #app element
ReactDOM.render(
  <App />,
  document.getElementById('app')
);
