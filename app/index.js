import './app.global.css';
import {remote} from 'electron';
const win = remote.getCurrentWindow();
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import watch from 'watch';
import {usedLetters} from 'windows-drive-letters';
const ps = require('win-ps');
import state from './state';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import _ from 'lodash';
import $ from 'jquery';
import ReactUtils from 'react-utils';
import ReactMarkdown from 'react-markdown';
import onClickOutside from 'react-onclickoutside';
import openExternal from 'open-external';
import moment from 'moment';
import {ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend} from 'recharts';
import Loader from './loader';
const screenshot = require('./capture');
import * as utils from './utils';
import knownGalaxies from './static/galaxies.json';
// Temporary until all 256 galaxy names are known
let galaxies = knownGalaxies.concat(knownGalaxies).concat(knownGalaxies).concat(knownGalaxies).concat(knownGalaxies).concat([knownGalaxies[0]]);
let galaxyIter = 1;
_.each(galaxies, (g, k)=>{
  ++galaxyIter;
  if (galaxyIter > knownGalaxies.length) {
    galaxies[k] = `Galaxy ${galaxyIter}`;
  }
});

if (module.hot) {
  module.hot.accept();
}

const {Menu, MenuItem, dialog} = remote;

const IMAGE_DOMAIN = process.env.NODE_ENV === 'development' ? 'http://192.168.1.148:8000' : 'https://neuropuff.com'

var DropdownMenu = onClickOutside(React.createClass({
  handleClickOutside(){
    if (this.props.s.settingsOpen) {
      state.set({settingsOpen: false});
    }
  },
  handleAbout(){
    dialog.showMessageBox({
      type: 'info',
      buttons: [],
      title: 'No Man\'s Connect',
      message: '0.4.2',
      detail: 'This version is beta. Please back up your save files.'
    });
  },
  handleSync(){
    this.props.onSync();
  },
  handleAutoCapture(e){
    e.stopPropagation();
    state.set({autoCapture: !this.props.s.autoCapture});
  },
  render(){
    var p = this.props;
    let modes = ['permadeath', 'survival', 'normal', 'creative'];
    return (
      <div
      style={{WebkitAppRegion: 'no-drag'}}
      className={`ui dropdown icon item${p.s.settingsOpen ? ' visible' : ''}`}
      onClick={()=>state.set({settingsOpen: !p.s.settingsOpen})}>
        <i className="wrench icon" />
        <div
        style={{minWidth: '183px'}}
        className={`menu transition ${p.s.settingsOpen ? 'visible' : 'hidden'}`}>
          {modes.map((mode, i)=>{
            return (
              <div
              key={i}
              className={`item${p.s.mode === mode ? ' selected' : ''}`}
              onClick={()=>state.set({mode: mode}, ()=>this.props.onModeSwitch(mode))}>
                {_.upperFirst(mode)}
              </div>
            );
          })}
          <div className="divider"></div>
          <div className="item" onClick={this.handleAutoCapture}>
            Screenshots: {p.s.autoCapture ? 'Auto' : 'Manual'}
          </div>
          <div className="divider"></div>
          <div className="item" onClick={this.handleSync}>
            Sync Locations
          </div>
          <div className="divider"></div>
          <div className="item" onClick={this.handleAbout}>
            About
          </div>
          <div className="item" onClick={()=>openExternal('https://neuropuff.com/static/donate.html')}>
            Support NMC
          </div>
          <div className="divider"></div>
          <div className="item" onClick={()=>window.close()}>
            Quit
          </div>
        </div>
      </div>
    );
  }
}));

var BasicDropdown = onClickOutside(React.createClass({
  getDefaultProps(){
    return {
      options: [],
      selectedGalaxy: 0,
      icon: 'dropdown',
      showValue: true,
      persist: false
    };
  },
  getInitialState(){
    return {
      open: false
    };
  },
  handleOptionClick(e, option){
    if (this.props.persist) {
      e.stopPropagation();
    }
    option.onClick(option.id);
    this.setState({open: this.props.persist});
  },
  handleClickOutside(){
    if (this.state.open) {
      this.setState({open: false});
    }
  },
  render(){
    let p = this.props;
    return (
      <div
      style={{
        fontFamily: 'geosanslight-nmsregular',
        fontSize: '16px'
      }}
      className={`ui dropdown${this.state.open ? ' active visible' : ''}`}
      onClick={()=>this.setState({open: !this.state.open})}>
        {p.showValue ? <div className="text">{galaxies[p.selectedGalaxy]}</div> : null}
        <i className={`${p.icon} icon`} />
        <div
        style={{
          display: this.state.open ? 'block !important' : 'none',
          borderRadius: '0px',
          background: 'rgb(23, 26, 22)'
        }}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          {this.props.options.length > 0 ? this.props.options.map((option, i)=>{
            return (
              <div key={i} className="item" onClick={(e)=>this.handleOptionClick(e, option)}>{option.label}</div>
            );
          }) : null}
        </div>
      </div>
    );
  }
}));

var TooltipChild = React.createClass({
  render(){
    if (this.props.active) {
      return (
        <div className="ui segments" style={{
          display: 'inline-table',
          textAlign: 'left',
          fontFamily: 'geosanslight-nmsregular',
          fontSize: '16px'
        }}>
          {this.props.payload[0].payload.user ?
          <div
          className="ui segment"
          style={{padding: '3px 5px', fontWeight: '600'}}>
            {`${this.props.payload[0].payload.user}`}
          </div> : null}
          {this.props.payload.map((item, i)=>{
            return (
              <div
              key={i}
              className="ui segment"
              style={{padding: '0px 5px'}}>
                {`${item.name}: ${item.name === 'Z' ? (0, 4096) - item.value : item.value}`}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }
});

var ThreeDimScatterChart = React.createClass({
  getInitialState(){
    return {
      show: {
        'Shared': true,
        'Explored': true,
        'Center': true,
        'Favorite': true,
        'Current': true,
        'Selected': true,
        'Base': true
      },
    };
  },
  componentDidMount(){
    _.defer(()=>{
      $('.recharts-legend-item-text').css({position: 'relative', top: '3px'});
      _.each(this.state.show, (type, key)=>{
        $('.recharts-legend-item').each(function(){
          if ($(this).text() === key) {
            $(this).addClass(key.split(' ').join('_'));
          }
        });
      });
    });
  },
  renderShape(symbol){
    symbol.fill = '#fbbd08';
    return symbol;
  },
  handleSelect(symbol){
    let refStoredLocation = _.findIndex(this.props.storedLocations, {id: symbol.id});
    if (refStoredLocation !== -1) {
      state.set({selectedLocation: this.props.storedLocations[refStoredLocation]});
    }
    let refRemoteLocation = _.findIndex(this.props.remoteLocations.results, {id: symbol.id});
    if (refRemoteLocation !== -1) {
      state.set({selectedLocation: this.props.remoteLocations.results[refRemoteLocation].data});
    }
  },
  handleLegendClick(e){
    this.state.show[e.payload.name] = !this.state.show[e.payload.name];
    this.setState({show: this.state.show}, ()=>{
      $(`.${e.payload.name.split(' ').join('_')}`).css({
        opacity: this.state.show[e.payload.name] ? '1' : '0.5'
      });
    });
  },
  render () {
    let p = this.props;
    let currentLocation = [];
    let locations = [];
    let remoteLocations = [];
    let selectedLocation = [];
    let favLocations = [];
    let baseLocations = [];

    let zRange = p.mapZoom ? [14, 64] : [22, 64];
    let ticks = p.mapZoom ? [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096] : [0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4096];
    let range = [0, 4096];

    _.each(p.storedLocations, (location)=>{
      if (location.galaxy !== p.selectedGalaxy) {
        return;
      }

      if (location.base && this.state.show['Base']) {
        baseLocations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else if (location.upvote && this.state.show['Favorite']) {
        favLocations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else if (p.selectedLocation && location.id === p.selectedLocation.id && this.state.show['Selected']) {
        selectedLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          selected: true,
          id: location.id
        });
      } else if (_.isEqual(location, _.first(p.storedLocations)) && this.state.show['Current']) {
        currentLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      }
      if (this.state.show['Explored']) {
        locations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      }
    });
    if (p.remoteLocations && p.remoteLocations.results) {
      _.each(p.remoteLocations.results, (location)=>{
        if (location.data.galaxy !== p.selectedGalaxy) {
          return;
        }
        if (location.data.base && this.state.show['Base']) {
          baseLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.data.upvote && this.state.show['Favorite']) {
          favLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.data.id
          });
        } else if (p.selectedLocation && location.data.id === p.selectedLocation.id && this.state.show['Selected']) {
          selectedLocation.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            selected: true,
            id: location.data.id
          });
        } else if (_.isEqual(location.data, _.first(p.storedLocations)) && this.state.show['Current']) {
          currentLocation.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.username !== p.username && this.state.show['Shared']) {
          remoteLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            user: location.username,
            id: location.id
          });
        }
      });
    }

    let center =  this.state.show['Center'] ? [{
      x: 2047,
      y: 2047,
      z: 127
    }] : [];

    let size = 480;

    if (p.width >= 1349 && p.height >= 1004) {
      size = 512;
    } else if (p.width <= 1152 || p.height <= 790) {
      size = 260;
    } else if (p.width <= 1212 || p.height <= 850) {
      size = 300;
    } else if (p.width <= 1254 || p.height <= 890) {
      size = 360;
    } else if (p.width <= 1290 || p.height <= 930) {
      size = 400;
    } else if (p.width <= 1328 || p.height <= 970) {
      size = 440;
    }

    size = p.mapZoom ? p.height - 105 : size;

    return (
      <ScatterChart width={size} height={size} margin={{top: 20, right: 20, bottom: 20}}>
        <XAxis tickLine={false} tickFormatter={(tick)=>''} ticks={ticks} domain={[0, 4096]} type="number" dataKey="x" range={range} name="X" label="X"/>
        <YAxis tickLine={false} tickFormatter={(tick)=>''} ticks={ticks} domain={[0, 4096]} type="number" dataKey="y" range={range} name="Z" label="Z"/>
        <ZAxis dataKey="z" range={zRange} name="Y" />
        <CartesianGrid />
        <Tooltip cursor={{strokeDasharray: '3 3'}} content={<TooltipChild />}/>
        <Legend align="right" wrapperStyle={{fontFamily: 'geosanslight-nmsregular', fontSize: '16px', right: '0px'}} iconSize={12} onClick={this.handleLegendClick}/>
        <Scatter name="Shared" data={remoteLocations} fill="#0080db" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Explored" data={locations} fill="#5fcc93" shape="circle" line={p.mapLines} isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Center" data={center} fill="#ba3935" shape="circle" isAnimationActive={false}/>
        <Scatter name="Base" data={baseLocations} fill="#9A9D99" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Favorite" data={favLocations} fill="#9c317c" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
        <Scatter name="Current" data={currentLocation} fill="#FFF" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
        <Scatter name="Selected" data={selectedLocation} fill="#ffc356" shape="circle" isAnimationActive={false}/>
      </ScatterChart>
    );
  }
});

var ImageModal = onClickOutside(React.createClass({
  handleClickOutside(){
    state.set({selectedImage: null});
  },
  render(){
    return (
      <div className="ui fullscreen modal active" style={{
        background: 'rgb(23, 26, 22)',
        borderTop: '2px solid #95220E',
        position: 'fixed',
        left: '50%',
        top: '12%',
        zIndex: '1001',
        WebkitTransformOrigin: '50% 25%',
        boxShadow: 'none'
      }}>
        <span className="close"/>
        <img className="image content" src={`${IMAGE_DOMAIN}${this.props.image}`} />
      </div>
    );
  }
}));

const locationItemStyle = {padding: '0px 2px', margin: '0px 3px', background: '#0B2B39', fontFamily: 'geosanslight-nmsregular', fontSize: '16px'};

var Item = React.createClass({
  render(){
    return (
      <div
      className="ui segment"
      style={utils.css(locationItemStyle, {position: 'initial', borderBottom: '1px solid #113d50'})}>
        <span style={{fontWeight: '600'}}>{`${this.props.label}`}</span> <span style={{float: 'right', position: 'relative', top: '1px', WebkitUserSelect: 'initial'}}>{this.props.value}</span>
      </div>
    );
  }
});

var Button = React.createClass({
  getInitialState(){
    return {
      hover: false
    };
  },
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
});

var LocationBox = React.createClass({
  getDefaultProps() {
    return {
      selectType: false,
      name: '',
      description: ''
    };
  },
  getInitialState(){
    return {
      hover: '',
      limit: false,
      name: this.props.name,
      description: this.props.description
    };
  },
  handleCancel(){

    this.props.onEdit();

  },
  render(){
    let p = this.props;
    let refFav = _.findIndex(p.favorites, (fav)=>{
      return fav === p.location.id;
    });
    let upvote = refFav !== -1;
    let isOwnLocation = p.isOwnLocation && p.selectType && p.location.username === p.username;
    let deleteArg = p.location.image && p.location.image.length > 0;
    let compact = p.width && p.width <= 1212;
    let title = 'Selected';
    return (
      <div
      className="ui segment"
      style={{
        background: '#0B2B39',
        display: 'inline-table',
        borderTop: '2px solid #95220E',
        textAlign: 'left',
        marginTop: p.selectType ? '26px' : 'initial',
        marginBottom: '26px',
        marginRight: !p.selectType && p.i % 1 === 0 ? '26px' : 'initial',
        minWidth: `${compact ? 358 : 386}px`,
        maxWidth: '386px',
        maxHeight: '289px',
        zIndex: p.mapZoom ? '91' : 'inherit',
        position: p.mapZoom ? 'fixed' : '',
        left: p.mapZoom ? '28px' : 'inherit',
        top: p.mapZoom ? `${p.height - 365}px` : 'inherit',
        WebkitUserSelect: 'none'
      }}>
        <h3 style={{textAlign: 'center', maxHeight: '23px'}}>{p.edit && this.state.name.length > 0 ? this.state.name : p.location.username ? p.name.length > 0 ? p.name : `${p.location.username} explored` : 'Selected'}</h3>
        <i
        style={{
          position: 'absolute',
          top: '15px',
          right: '10px',
          cursor: 'pointer'
        }}
        className={`${upvote ? '' : 'empty '}star icon`}
        onClick={()=>p.onFav(p.location)} />
        {p.edit ?
        <div>
          <div
          className="ui segment"
          style={{
            padding: '3px 3px',
            cursor: 'pointer',
            background: '#171A16'
          }}>
            <div className="ui input" style={{width: '200px'}}>
              <div className="row">
                <input
                style={{
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
                }}
                type="text"
                value={this.state.name}
                onChange={(e)=>this.setState({name: e.target.value})}
                placeholder="Name" />
              </div>
            </div>
            <div className="ui input" style={{width: '200px'}}>
              <div className="row">
                <textarea
                style={{
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
                }}
                type="text"
                value={this.state.description}
                onChange={(e)=>this.setState({description: e.target.value})}
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
            <div className="col-xs-6" style={{marginBottom: '14px'}}>
              <Button onClick={this.handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
          <div className="row">
            <div className="col-xs-12">
            {isOwnLocation && deleteArg ?
              <Button onClick={p.onDeleteScreen}>
                Delete Screenshot
              </Button>  : null}
              <Button onClick={p.onUploadScreen}>
                Upload Screenshot
              </Button>
            </div>
          </div>
        </div>
        :
        <div>
          <div style={{maxHeight: '177px', minHeight: '177px', overflowY: 'auto'}}>
            {p.image && p.image.length > 0 ?
            <div style={{textAlign: 'center'}}>
              <img
              style={{
                cursor: 'pointer',
                maxHeight: '144.5px',
                maxWidth: '386px',
                width: '99%'
              }}
              src={`${IMAGE_DOMAIN}${p.image}`}
              onClick={()=>state.set({selectedImage: p.image})} />
            </div> : null}
            {p.location.description ? <Item label="Description" value={p.location.description} /> : null }
            <Item label="Galactic Address" value={p.location.translatedId} />
            <Item label="Voxel Address" value={p.location.id} />
            {p.location.galaxy !== undefined ? <Item label="Galaxy" value={galaxies[p.location.galaxy]} /> : null}
            <Item label="Distance to Center" value={`${p.location.distanceToCenter.toFixed(3)} LY`} />
            <Item label="Jumps" value={p.location.jumps} />
            {p.location.mode ? <Item label="Mode" value={_.upperFirst(p.location.mode)} /> : null}
            {p.location.teleports ? <Item label="Teleports" value={p.location.teleports} /> : null}
            {p.location.score ? <Item label="Favorites" value={p.location.score} /> : null}
            {this.state.name.length > 0 ? <Item label="Explored by" value={p.location.username} /> : null}
            <Item label="Created" value={moment(p.location.timeStamp).format('MMMM D, Y')} />
            {p.location.mods && p.location.mods.length > 0 ?
            <div
            className="ui segment"
            style={utils.css(locationItemStyle)}>
              <span style={{fontWeight: '600'}}>Mods Used ({p.location.mods.length})</span>:
              {p.location.mods.map((mod, i)=>{
                return (
                  <div
                  key={i}
                  className="ui segment"
                  title={mod}
                  style={utils.css(locationItemStyle, {
                    marginTop: i === 0 ? '14px' : '0px',
                    marginBottom: '0px',
                    fontSize: '14px'
                  })}>
                    {_.truncate(mod, {length: 43})}
                  </div>
                );
              })}
            </div>: null}
          </div>
          <div
          className="ui segment"
          style={{
            letterSpacing: '3px',
            fontFamily: 'geosanslight-nmsregular',
            fontSize: '16px',
            padding: '3px 3px',
            textAlign: 'center',
            cursor: 'pointer',
            background: this.state.hover === 'teleport' ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
          }}
          onMouseEnter={()=>this.setState({hover: 'teleport'})}
          onMouseLeave={()=>this.setState({hover: -1})}
          onClick={()=>p.onTeleport(p.location, p.selectType ? 'selected' : p.i)}>
            {p.selectType && p.installing && p.installing === `tselected` || p.i && p.installing === `t${p.i}` ? 'Working...' : 'Teleport Here'}
          </div>
          {p.isOwnLocation && p.selectType && p.location.username === p.username ?
          <div
          className="ui segment"
          style={{
            letterSpacing: '3px',
            fontFamily: 'geosanslight-nmsregular',
            fontSize: '16px',
            padding: '3px 3px',
            textAlign: 'center',
            cursor: 'pointer',
            background: this.state.hover === 'update' ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
          }}
          onMouseEnter={()=>this.setState({hover: 'update'})}
          onMouseLeave={()=>this.setState({hover: -1})}
          onClick={p.onEdit}>
            Edit Details
          </div> : null}
        </div>}
      </div>
    );
  }
});

var GalacticMap = React.createClass({
  componentDidMount(){
    this.buildGalaxyOptions(this.props);
  },
  buildGalaxyOptions(p){
    let options = [];
    _.each(p.storedLocations, (location, i)=>{
      options.push({id: location.galaxy});
    });
    if (p.remoteLocations && p.remoteLocations.results) {
      _.each(p.remoteLocations.results, (location, i)=>{
        options.push({id: location.data.galaxy});
      });
    }
    if (p.selectedLocation) {
      options.push({id: p.selectedLocation.galaxy});
    }
    options = _.uniqBy(options, 'id');
    _.each(options, (option, i)=>{
      options[i].label = galaxies[option.id];
      options[i].onClick = (id)=>state.set({selectedGalaxy: id});
    });
    state.set({galaxyOptions: options});
  },
  render(){
    let p = this.props;
    let compact = p.width <= 1212 || p.height <= 850;
    let leftOptions = [
      {
        id: 'mapLines',
        label: `Show Path: ${p.mapLines ? 'On' : 'Off'}`,
        onClick: ()=>state.set({mapLines: !p.mapLines})
      },
      {
        id: 'mapZoom',
        label: `Enlarge Map: ${p.mapZoom ? 'On' : 'Off'}`,
        onClick: ()=>state.set({mapZoom: !p.mapZoom})
      }
    ];
    let mapZoomOpacity = p.transparent ? '0.85' : '0';
    return (
      <div className="ui segment" style={{
        background: p.mapZoom && (p.width > 1804 && p.selectedLocation || p.width > 1698 && !p.selectedLocation) ? `rgba(23, 26, 22, ${mapZoomOpacity})` : 'rgb(23, 26, 22)',
        display: 'inline-table',
        borderTop: '2px solid #95220E',
        textAlign: 'center',
        position: p.mapZoom ? 'absolute' : 'inherit',
        top: p.mapZoom ? '-11px' : 'inherit',
        left: p.mapZoom ? p.selectedLocation ? '157px' : '15px' : 'inherit',
        WebkitTransition: 'left 0.1s, background 0.1s',
        zIndex: p.mapZoom ? '90' : 'inherit',
        WebkitUserSelect: 'none'
      }}>
        <h3 style={{textAlign: compact ? 'left' : 'inherit'}}>Galactic Map</h3>
        {p.galaxyOptions.length > 0 ?
        <div style={{
          position: 'absolute',
          right: '54px',
          top: '16px'
        }}>
          <BasicDropdown
          options={p.galaxyOptions}
          selectedGalaxy={p.selectedGalaxy} />
        </div> : null}
        <div style={{
          position: 'absolute',
          left: compact ? 'initial' : '48px',
          right: compact ? '143px' : 'initial',
          top: '16px'
        }}>
          <BasicDropdown
          icon="ellipsis horizontal"
          showValue={null}
          persist={true}
          options={leftOptions} />
        </div>
        <div style={{position: 'relative', left: '-18px'}}>
          <ThreeDimScatterChart
          mapZoom={p.mapZoom}
          mapLines={p.mapLines}
          selectedGalaxy={p.selectedGalaxy}
          storedLocations={p.storedLocations}
          width={p.width}
          height={p.height}
          remoteLocations={p.remoteLocations}
          selectedLocation={p.selectedLocation}
          username={p.username} />
        </div>
      </div>
    );
  }
});

var Container = React.createClass({
  getInitialState(){
    return {
      updating: false,
      edit: false
    };
  },
  componentDidMount(){
    let checkRemote = ()=>{
      if (this.props.s.remoteLocations && this.props.s.remoteLocations.results) {
        this.refs.recentExplorations.addEventListener('scroll', this.scrollListener);
      } else {
        _.delay(()=>checkRemote(), 500);
      }
    };
    checkRemote();
  },
  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.s.selectedLocation, this.props.s.selectedLocation)) {
      this.setState({edit: false});
    }
  },
  componentWillUnmount(){
    if (this.refs.recentExplorations) {
      this.refs.recentExplorations.removeEventListener('scroll', this.scrollListener);
    }
  },
  scrollListener(){
    let node = this.refs.recentExplorations;
    if (node.scrollTop + window.innerHeight >= node.scrollHeight + node.offsetTop - 180
      && this.props.s.remoteLocations.next) {
      this.props.onPagination(this.props.s.page);
    }
  },
  handleFavorite(location){
    let refFav = _.findIndex(this.props.s.favorites, (fav)=>{
      return fav === location.id;
    });
    let upvote = refFav === -1;

    utils.ajax.post('/nmslocation/',{
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
        this.props.s.remoteLocations.results[refRemoteLocation].score = res.data.score;
        this.props.s.remoteLocations.results[refRemoteLocation].data.score = res.data.score;
        this.props.s.remoteLocations.results[refRemoteLocation].data.upvote = upvote;
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
  },
  handleUpdate(name, description){
    this.setState({updating: true}, ()=>{
      if (description.length > 200) {
        this.setState({limit: true});
        return;
      }
      utils.ajax.post('/nmslocation/', {
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
  },
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
              console.log(refRemoteLocation)
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
  },
  handleDeleteScreen(){
    utils.ajax.post('/nmslocation/', {
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
  },
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
  },
  render(){
    let p = this.props;
    let locationItemStyle = {padding: '0px 3px', background: '#0B2B39', fontFamily: 'geosanslight-nmsregular', fontSize: '16px'};
    let isOwnLocation = _.findIndex(p.s.storedLocations, {id: p.s.selectedLocation ? p.s.selectedLocation.id : null}) !== -1;
    let storedLocations = _.orderBy(p.s.storedLocations, (location)=>{
      return location.upvote !== undefined && location.upvote;
    }, 'desc')
    let remoteLocationsWidth = `${p.s.width <= 1747 ? 441 : p.s.width <= 2164 ? 902 : 1300}px`;
    return (
      <div className="ui grid row" style={{paddingTop: '51px', float: 'left', position: 'absolute', margin: '0px auto', left: '0px', right: '0px'}}>
        <input ref="uploadScreenshot" onChange={this.handleUploadScreen} style={{display: 'none'}} type="file" accept="image/*" multiple={false} />
        <div className="columns">
          <div className="ui segments stackable grid container" style={{maxWidth: '800px !important'}}>
            <div
            className="ui segment"
            style={{display: 'inline-flex', background: 'transparent', WebkitUserSelect: 'none'}}
            onMouseLeave={()=>this.setState({storedLocationHover: -1})}>
              <div className="ui segment" style={{
                background: '#0B2B39',
                display: 'inline-table',
                borderTop: '2px solid #95220E',
                width: '245px',
                textAlign: 'center'
              }}>
                <h3>Stored Locations</h3>
                <div className="ui segments" style={{maxHeight: `${p.s.height - (p.s.mapZoom ? 498 : 125)}px`, overflowY: 'auto'}}>
                  {storedLocations.map((location, i)=>{
                    return (
                      <div
                      key={location.id}
                      className="ui segment"
                      style={{
                        fontFamily: 'geosanslight-nmsregular',
                        fontSize: '16px',
                        fontWeight: location.upvote ? '600' : '400',
                        cursor: 'pointer',
                        padding: '3px 3px',
                        background: this.state.storedLocationHover === i || p.s.selectedLocation && p.s.selectedLocation.id === location.id ? 'rgba(23, 26, 22, 0.34)' : '#0B2B39',
                      }}
                      onMouseEnter={()=>this.setState({storedLocationHover: i})}
                      onClick={()=>this.handleSelectLocation(location)}>
                        <p>{`${location.name && location.name.length > 0 ? location.name : location.id}${location.base ? ' (B)' : ''}`}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="ui segments" style={{display: 'inline-flex', paddingTop: '14px', marginLeft: '0px'}}>
              <GalacticMap
              transparent={p.s.transparent}
              mapZoom={p.s.mapZoom}
              mapLines={p.s.mapLines}
              galaxyOptions={p.s.galaxyOptions}
              selectedGalaxy={p.s.selectedGalaxy}
              storedLocations={p.s.storedLocations}
              width={p.s.width}
              height={p.s.height}
              remoteLocations={p.s.remoteLocations}
              selectedLocation={p.s.selectedLocation}
              username={p.s.username} />
              {p.s.selectedLocation ?
              <LocationBox
              name={p.s.selectedLocation.name}
              description={p.s.selectedLocation.description}
              username={p.s.username}
              selectType={true}
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
              onTeleport={(location, type)=>p.onTeleport(location, type)}
              onSubmit={(name, description)=>this.handleUpdate(name, description)}
               /> : null}
            </div>
          </div>
        </div>
        {p.s.remoteLocations && p.s.remoteLocations.results ?
        <div className="columns" style={{
          position: 'absolute',
          right: p.s.mapZoom ? '0px' : '68px',
          zIndex: p.s.mapZoom && p.s.width >= 1854 ? '91' : 'inherit',
          maxWidth: remoteLocationsWidth,
          opacity: p.s.mapZoom && (p.s.width < 1804 && p.s.selectedLocation || p.s.width < 1694) ? '0.5' : '1',
          WebkitTransition: '0.1s opacity'
        }}>
          <div className="ui segments" style={{display: 'inline-flex', paddingTop: '14px', width: p.s.mapZoom ? '400px !important' : 'inherit'}}>
            <div className="ui segment" style={{
              background: '#42201E',
              display: 'inline-table',
              borderTop: '2px solid #95220E',
              textAlign: 'center',
              WebkitUserSelect: 'none'
            }}>
              <h3>{p.s.sort === '-created' ? 'Recent' : p.s.sort === '-score' ? 'Favorite' : 'Popular'} Explorations</h3>
              <div
              style={{
                maxHeight: `${p.s.height - 125}px`,
                width: p.s.mapZoom ? '400px' : remoteLocationsWidth,
                minWidth: '400px',
                maxWidth: p.s.mapZoom ? `${Math.abs(p.s.width - 1482)}px !important` : remoteLocationsWidth,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
              ref="recentExplorations">
                {p.s.remoteLocations.results.map((location, i)=>{
                  location.data.teleports = location.teleports;
                  location.upvote = location.data.upvote;
                  return (
                    <LocationBox
                    key={i}
                    i={i}
                    name={location.name}
                    description={location.description}
                    username={p.s.username}
                    isOwnLocation={isOwnLocation}
                    location={location.data}
                    installing={p.s.installing}
                    updating={this.state.updating}
                    favorites={p.s.favorites}
                    image={location.image}
                    onFav={(location, upvote)=>this.handleFavorite(location, upvote)}
                    onTeleport={(_location, type)=>p.onTeleport(location, type)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div> : null}
      </div>
    );
  }
});

var App = React.createClass({
  mixins: [
    Reflux.ListenerMixin,
    ReactUtils.Mixins.WindowSizeWatch
  ],
  getInitialState(){
    return state.get();
  },
  componentDidMount(){
    this.listenTo(state, this.stateChange);
    this.saveJSON = path.join(__dirname, 'saveCache.json');
    this.saveJSON = path.resolve(__dirname, this.saveJSON);
    this.saveTool = process.env.NODE_ENV === 'production' ? '\\nmssavetool\\nmssavetool.exe' : '\\app\\nmssavetool\\nmssavetool.exe';
    this.whichCmd = `.${this.saveTool} decrypt -g ${this.state.mode} -o ${this.saveJSON}`;

    let initialize = ()=>{
      utils.ajax.get('/nmslocation', {
        params: {
          version: true
        }
      }).then((res)=>{
        if (res.data.version !== this.state.version) {
          this.pollSaveData(this.state.mode, true);
          this.handleUpgrade();
        } else {
          this.pollSaveData(this.state.mode, true);
        }
      }).catch(()=>{
        this.pollSaveData(this.state.mode, true);
      });
    };

    let indexMods = ()=>{
      usedLetters().then((letters) => {
        let indexModsInUse = (path)=>{
          fs.readdir(path, (err, list)=>{
            if (err) {
              log.error(`Failed to read mods directory: ${err}`);
              initialize();
              return;
            }
            state.set({mods: list}, ()=>{
              initialize();
            });
          });
        };

        let paths = [
          `:/Program Files (x86)/Steam/steamapps/common`,
          `:/Steam/steamapps/common`,
          `:/steamapps/common`,
          `:/Program Files`,
          `:GOG Games`,
          `:Games`,
        ];

        let modPath = `/No Man's Sky/GAMEDATA/PCBANKS/MODS`;

        let hasPath = false;
        _.each(letters, (drive, key)=>{
          _.each(paths, (path)=>{
            let __path = `${drive}${path}${modPath}`;
            if (fs.existsSync(__path)) {
              hasPath = true;
              indexModsInUse(__path);
              return;
            }
          });
        });
        if (!hasPath) {
          initialize();
        }
      }).catch((err) => {
        log.error(`Failed to locate NMS install: ${err}`);
        initialize();
      });
    };
    indexMods();
  },
  componentDidUpdate(pP, pS){
    if (pS.search.length > 0 && this.state.search.length === 0 && this.state.searchInProgress) {
      state.set({searchInProgress: false}, ()=>{
        this.handleClearSearch();
      });
    }
  },
  handleSync(page=1, sort=this.state.sort, init=false){
    this.syncRemoteOwned(()=>{
      let locations = [];
      _.each(this.state.storedLocations, (location)=>{
        location = _.cloneDeep(location);
        location.timeStamp = new Date(location.timeStamp);
        locations.push(location);
      });
      utils.ajax.post('/nmslocationremotesync/', {
        locations: locations,
        mode: this.state.mode,
        username: this.state.username
      }).then((res)=>{
        this.fetchRemoteLocations(page, sort, init);
      }).catch((err)=>{
        log.error(`Failed to sync local locations to remote locations: ${err}`);
      });
    });
  },
  formatRemoteLocations(res, page, sort, init, partial, cb){
    if (this.state.remoteLocations.length === 0) {
      this.state.remoteLocations = {
        results: []
      };
    }

    if (this.state.search.length === 0 && page > 1 && sort === this.state.sort || partial) {
      let order = sort === '-created' ? 'created' : sort === '-score' ? 'score' : 'teleports';
      res.data.results = _.chain(this.state.remoteLocations.results).concat(res.data.results).uniqBy('id').orderBy(order, 'desc').value();
    }
    _.each(res.data.results, (remoteLocation, key)=>{
      let refFav = _.findIndex(this.state.favorites, (fav)=>{
        return fav === remoteLocation.data.id;
      });
      let upvote = refFav !== -1;

      res.data.results[key].data.name = remoteLocation.name;
      res.data.results[key].data.description = remoteLocation.description;
      res.data.results[key].data.score = remoteLocation.score;
      res.data.results[key].data.upvote = upvote;
      // tbd
      try {
        res.data.results[key].data.image = remoteLocation.image
      } catch (e) {
        res.data.results[key].data.image = '';
      }

      _.each(this.state.storedLocations, (storedLocation, key)=>{
        if (remoteLocation.data.id === storedLocation.id) {
          this.state.storedLocations[key].username = remoteLocation.data.username;
          this.state.storedLocations[key].name = remoteLocation.name;
          this.state.storedLocations[key].description = remoteLocation.description;
          this.state.storedLocations[key].score = remoteLocation.score;
          // tbd
          this.state.storedLocations[key].image = remoteLocation.image;
        }
      });

      // Sync remote locations to stored

      if (!init) {
        let remoteOwnedLocations = _.filter(res.data.results, (remoteOwnedLocation)=>{
          let refStoredLocation = _.findIndex(this.state.storedLocations, {id: remoteOwnedLocation.data.id});
          return remoteOwnedLocation.username === this.state.username && refStoredLocation === -1;
        });
        if (remoteOwnedLocations.length > 0) {
          this.state.storedLocations = _.chain(this.state.storedLocations).concat(_.map(remoteOwnedLocations, 'data')).uniqBy('id').orderBy('timeStamp', 'desc').value()
        }
      }
    });

    // Preserve pagination data from being overwritten on partials
    if (partial) {
      res.data.count = this.state.remoteLocations.count;
      res.data.next = this.state.remoteLocations.next;
    }
    state.set({
      storedLocations: this.state.storedLocations,
      remoteLocations: res.data,
      searchInProgress: this.state.search.length > 0,
      page: page,
      init: false
    }, cb);
  },
  syncRemoteOwned(cb){
    utils.ajax.get('/nmslocationsync', {
      params: {
        username: this.state.username
      }
    }).then((res)=>{
      this.formatRemoteLocations(res, 1, this.state.sort, false, true, cb);
    }).catch((err)=>{
      log.error('Failed to sync to remote locations.');
    });
  },
  pollRemoteLocations(){
    if (this.timeout)  {
      clearTimeout(this.timeout);
    }

    if (this.state.sort !== '-created') {
      this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
      return;
    }

    let lastRemoteLocation = _.chain(this.state.remoteLocations.results).orderBy('created', 'desc').first().value();

    let start = new Date(lastRemoteLocation.created);
    let end = new Date();

    utils.ajax.get('/nmslocationpoll', {
      params: {
        start: start,
        end: end,
        id: lastRemoteLocation.data.id
      }
    }).then((res)=>{
      if (res.data.results.length > 0) {
        this.formatRemoteLocations(res, this.state.page, this.state.sort, false, true, ()=>{
          this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
        });
      } else {
        this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
      }
    }).catch((err)=>{
      console.log(err);
    });
  },
  fetchRemoteLocations(page=1, sort=this.state.sort, init=false){
    let q = this.state.search.length > 0 ? this.state.search : null;
    let path = q ? '/nmslocationsearch' : '/nmslocation';
    utils.ajax.get(path, {
      params: {
        page: page,
        sort: sort,
        q: q
      }
    }).then((res)=>{
      this.formatRemoteLocations(res, page, sort, init, false, ()=>{
        if (init) {
          this.pollRemoteLocations();
        }
      });
    }).catch((err)=>{
      state.set({init: false});
      console.log(err);
      log.error(`Failed to fetch remote locations: ${err}`);
    });
  },
  handleTeleport(location, i){
    console.log(location, i);
    state.set({installing: `t${i}`}, ()=>{
      utils.exc(this.whichCmd).then((result)=>{
        let saveData = JSON.parse(fs.readFileSync(this.saveJSON));

        if (location.data) {
          location = location.data;
        }

        _.assignIn(saveData.SpawnStateData, {
          PlayerPositionInSystem: location.playerPosition,
          PlayerTransformAt: location.playerTransform,
          ShipPositionInSystem: location.shipPosition,
          ShipTransformAt: location.shipTransform
        });

        _.assignIn(saveData.PlayerStateData.UniverseAddress.GalacticAddress, {
          PlanetIndex: location.PlanetIndex,
          SolarSystemIndex: location.SolarSystemIndex,
          VoxelX: location.VoxelX,
          VoxelY: location.VoxelY,
          VoxelZ: location.VoxelZ
        });

        saveData.PlayerStateData.UniverseAddress.RealityIndex = location.galaxy;

        fs.writeFile(this.saveJSON, JSON.stringify(saveData), {flag : 'w'}, (err, data)=>{
          if (err) {
            console.log(err);
          }
          utils.exc(`.${this.saveTool} encrypt -g ${this.state.mode} -i ${this.saveJSON}`, (res)=>{
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
              remoteLocations: this.state.remoteLocations
            });
          }).catch((err)=>{
            log.error(err);
            state.set({installing: false});
          });
        });
      }).catch((e)=>{
        console.log(e);
      });
    });
  },
  pollSaveData(mode, init=false){
    ps.snapshot(['ProcessName']).then((list) => {
      let NMSRunning = _.findIndex(list, {ProcessName: 'NMS.exe'}) !== -1;

      let next = ()=>{
        if (init) {
          this.handleSync(1, this.state.sort, init);
        } else {
          this.fetchRemoteLocations(1, this.state.sort, init);
        }
        if (init) {
          watch.createMonitor(path.join(state.get().homedir, 'AppData', 'Roaming', 'HelloGames', 'NMS'), {
            ignoreDotFiles: true,
            ignoreNotPermitted: true,

          }, (monitor)=>{
            monitor.on('changed', (f, curr, prev)=>{
              this.pollSaveData();
              console.log('changed')
            });
          });
        }
      };

      if (mode && mode !== this.state.mode) {
        this.state.mode = mode;
      }

      utils.exc(this.whichCmd).then((result)=>{
        let saveData = JSON.parse(fs.readFileSync(this.saveJSON));
        let location = utils.formatID(saveData.PlayerStateData.UniverseAddress);
        const refLocation = _.findIndex(this.state.storedLocations, {id: location.id});
        let username = saveData.DiscoveryManagerData['DiscoveryData-v1'].Store.Record[0].OWS.USN;

        console.log(saveData)

        let refFav = _.findIndex(this.state.favorites, (fav)=>{
          return fav === location.id;
        });
        let upvote = refFav !== -1;

        screenshot(init || !NMSRunning || !this.state.autoCapture, (image)=>{
          _.assignIn(location, {
            username: _.isString(username) && username.length > 0 ? username : '',
            playerPosition: _.clone(saveData.SpawnStateData.PlayerPositionInSystem),
            playerTransform: _.clone(saveData.SpawnStateData.PlayerTransformAt),
            shipPosition: _.clone(saveData.SpawnStateData.ShipPositionInSystem),
            shipTransform: _.clone(saveData.SpawnStateData.ShipTransformAt),
            galaxy: _.clone(saveData.PlayerStateData.UniverseAddress.RealityIndex),
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
          this.state.storedLocations = _.orderBy(_.uniqBy(this.state.storedLocations, 'id'), 'timeStamp', 'desc');

          // Detect player base

          let base = null;
          let refBase = _.find(saveData.PlayerStateData.TeleportEndpoints, {TeleporterType: 'Base'});

          if (refBase !== undefined && refBase) {
            base = utils.formatID(refBase.UniverseAddress);
            _.each(this.state.storedLocations, (storedLocation, i)=>{
              let hasBase = (base.VoxelX === storedLocation.VoxelX
                && base.VoxelY === storedLocation.VoxelY
                && base.VoxelZ === storedLocation.VoxelZ
                && base.SolarSystemIndex === storedLocation.SolarSystemIndex
                && base.PlanetIndex === storedLocation.PlanetIndex
                && refBase.UniverseAddress.RealityIndex === storedLocation.galaxy);
              this.state.storedLocations[i].base = hasBase;
            });
          }

          state.set({
            storedLocations: this.state.storedLocations,
            username: location.username
          }, ()=>{
            if (refLocation === -1) {
              utils.ajax.post('/nmslocation/', {
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
      }).catch((err)=>{
        log.error(`Failed to fetch save data: ${err}`);
        next();
      });
    });
  },
  stateChange(e){
    this.setState(e);
  },
  onWindowResize(){
    state.set({
      width: window.innerWidth,
      height: window.innerHeight
    });
  },
  handleUpgrade(){
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
  },
  handleEnter(e, id){
    if (e.keyCode === 13) {
      this.fetchRemoteLocations(1)
    }
  },
  handleSort(sort){
    state.set({sort: sort}, ()=>{
      this.fetchRemoteLocations(1, sort);
    });
  },
  handleSearch(){
    state.set({remoteLocationsCache: this.state.remoteLocations}, ()=>{
      this.fetchRemoteLocations(1);
    });
  },
  handleClearSearch(){
    state.set({search: ''}, ()=>{
      if (this.state.remoteLocationsCache) {
        state.set({remoteLocations: this.state.remoteLocationsCache});
      } else {
        this.fetchRemoteLocations(1, this.state.sort);
      }
    })
  },
  handleMaximize(){
    state.set({maximized: !this.state.maximized}, ()=>{
      if (this.state.maximized) {
        win.maximize();
      } else {
        let bounds = {
          height: 1040,
          width: 1351,
          x: 600,
          y: 5
        };
        win.setBounds(bounds);
        win.setContentBounds(bounds);
      }
    });
  },
  render(){
    var s = this.state;
    if (s.init) {
      return <Loader />
    }
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
            WebkitTransition: 'left 0.1s'
          }}>{s.title}</h2>
          <div className="right menu">
            <div
            style={{WebkitAppRegion: 'no-drag'}}
            className={`ui dropdown icon item${s.sort === '-created' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('-created')}>
              Recent
            </div>
            <div
            style={{WebkitAppRegion: 'no-drag'}}
            className={`ui dropdown icon item${s.sort === '-teleports' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('-teleports')}>
              Popular
            </div>
            <div
            style={{WebkitAppRegion: 'no-drag'}}
            className={`ui dropdown icon item${s.sort === '-score' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('-score')}>
              Favorites
            </div>
            {/*<div
            className={`ui dropdown icon item${s.sort === 'distanceToCenter' ? ' selected' : ''}`}
            onClick={()=>this.handleSort('distanceToCenter')} >
              Distance
            </div>*/}
            <div className="item">
              <div
              className="ui transparent icon input"
              style={{width: '250px', WebkitUserSelect: 'initial', WebkitAppRegion: 'no-drag', fontSize: '15px'}}>
                <input type="text" style={{letterSpacing: '2px'}} placeholder="Search..." value={s.search} onChange={(e)=>state.set({search: e.target.value})} onKeyDown={this.handleEnter}/>
                <i className={s.searchInProgress ? 'remove link icon' : 'search link icon'} style={{cursor: 'default', padding: '0px'}} onClick={s.searchInProgress ? ()=>this.handleClearSearch() : ()=>this.handleSearch()}/>
              </div>
            </div>
            <DropdownMenu
            s={s}
            onSync={this.handleSync}
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
                <svg className="maximize-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <mask id="Mask">
                    <path fill="#FFFFFF" d="M 3 1 L 9 1 L 9 7 L 8 7 L 8 2 L 3 2 L 3 1 z"/>
                    <path fill="#FFFFFF" d="M 1 3 L 7 3 L 7 9 L 1 9 L 1 3 z"/>
                  </mask>
                  <path fill="#FFFFFF" d="M 2 0 L 10 0 L 10 8 L 8 8 L 8 10 L 0 10 L 0 2 L 2 2 L 2 0 z" mask="url(#Mask)"/>
                </svg>
                :
                <svg className="fullscreen-svg" x="0px" y="0px" viewBox="0 0 10 10">
                  <path fill="#FFFFFF" d="M 0 0 L 0 10 L 10 10 L 10 0 L 0 0 z M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 z "/>
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
        <Container
        s={s}
        onTeleport={(location, i)=>this.handleTeleport(location, i)}
        onPagination={(page)=>this.fetchRemoteLocations(++page)} />
      </div>
    );
  }
});
// Render to the #app element
ReactDOM.render(
  <App />,
  document.getElementById('app')
);
