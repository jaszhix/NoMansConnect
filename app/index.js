import './app.global.css';
import {remote} from 'electron';
const win = remote.getCurrentWindow();
import fs from 'fs';
import path from 'path';
import Log from './log';
const log = new Log();
import watch from 'watch';
import {usedLetters} from 'windows-drive-letters';
const ps = require('win-ps');
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
import {ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend} from 'recharts';
import Loader from './loader';
const screenshot = require('./capture');
import * as utils from './utils';
import knownGalaxies from './static/galaxies.json';

import defaultWallpaper from './assets/images/default_wallpaper.png';
import baseIcon from './assets/images/base_icon.png';
import spaceStationIcon from './assets/images/spacestation_icon.png';

// Temporary until all 256 galaxy names are known
let galaxies = knownGalaxies.concat(knownGalaxies).concat(knownGalaxies).concat(knownGalaxies).concat(knownGalaxies).concat([knownGalaxies[0]]);
let galaxyIter = 1;
utils.each(galaxies, (g, k)=>{
  ++galaxyIter;
  if (galaxyIter > knownGalaxies.length) {
    galaxies[k] = `Galaxy ${galaxyIter}`;
  }
});

if (module.hot) {
  module.hot.accept();
}

const {Menu, MenuItem, dialog} = remote;

const IMAGE_DOMAIN = /*process.env.NODE_ENV === 'development' ? 'http://192.168.1.148:8000' : */'https://neuropuff.com'

class SaveEditorDropdownMenu extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  componentDidMount(){
    _.defer(()=>ReactTooltip.rebuild());
  }
  handleClickOutside(){
    if (this.props.editorOpen) {
      state.set({editorOpen: false});
    }
  }
  render(){
    var p = this.props;
    return (
      <div
      style={{WebkitAppRegion: 'no-drag'}}
      className={`ui dropdown icon item${p.editorOpen ? ' visible' : ''}`}
      onClick={()=>state.set({editorOpen: !p.editorOpen})}>
        <i className="database icon" />
        <div
        style={{
          minWidth: '183px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
          borderTop: '1px solid rgb(149, 34, 14)'
        }}
        className={`menu transition ${p.editorOpen ? 'visible' : 'hidden'}`}>
          <div
          style={{opacity: p.profile.exp >= 50 ? '1' : '0.5'}}
          className="item"
          onClick={p.profile.exp >= 50 ? ()=>p.onCheat('repairInventory') : null}
          data-place="left"
          data-tip={utils.tip('Requires 50 registered locations.')}>
            Repair Inventory
          </div>
          <div
          style={{opacity: p.profile.exp >= 100 ? '1' : '0.5'}}
          className="item"
          onClick={p.profile.exp >= 100 ? ()=>p.onCheat('stockInventory') : null}
          data-place="left"
          data-tip={utils.tip('Requires 100 registered locations.')}>
            Fully Stock Inventory
          </div>
          <div
          style={{opacity: p.profile.exp >= 200 ? '1' : '0.5'}}
          className="item"
          onClick={p.profile.exp >= 200 ? ()=>p.onCheat('refuelEnergy') : null}
          data-place="left"
          data-tip={utils.tip('Requires 200 registered locations.')}>
            Refuel Energies/Shields
          </div>
          <div
          className="item"
          onClick={()=>p.onCheat('modifyUnits', p.profile.exp * 1000)}
          data-place="left"
          data-tip={utils.tip('Explore more to increase your units allowance.')}>
            {`Add ${p.profile.exp * 1000}k Units`}
          </div>
        </div>
      </div>
    );
  }
};

SaveEditorDropdownMenu = onClickOutside(SaveEditorDropdownMenu);

class DropdownMenu extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  handleClickOutside(){
    if (this.props.s.settingsOpen) {
      state.set({settingsOpen: false});
    }
  }
  handleAbout(){
    dialog.showMessageBox({
      type: 'info',
      buttons: [],
      title: 'No Man\'s Connect',
      message: this.props.s.version,
      detail: `
      This version is beta. Please back up your save files.

      Special Thanks

      - pgrace
      - rayrod118
      `
    });
  }
  handleSync(){
    this.props.onSync();
  }
  handleWallpaper(){
    this.props.onSetWallpaper()
  }
  handleAutoCapture(e){
    e.stopPropagation();
    state.set({autoCapture: !this.props.s.autoCapture});
  }
  handleResetRemoteCache(){
    state.json.remove('remoteLocations');
    remote.app.relaunch();
    window.close();
  }
  handleUsernameProtection(){
    let helpMessage = 'When you protect your username, the app will associate your computer with your username to prevent impersonation. If you plan on using the app on another computer, you will need to disable protection before switching.';
    if (this.props.s.profile.protected) {
      helpMessage = 'Are you sure you want to unprotect your username?'
    }
    dialog.showMessageBox({
      title: 'Important Information',
      message: helpMessage,
      buttons: ['Cancel', `${this.props.s.profile.protected ? 'Unp' : 'P'}rotect Username`]
    }, result=>{
      if (result === 1) {
        utils.ajax.post('/nmsprofile/', {
          username: this.props.s.username,
          machineId: this.props.s.machineId,
          protected: !this.props.s.profile.protected
        }).then(()=>{
          this.props.s.profile.protected = !this.props.s.profile.protected
          state.set({profile: this.props.s.profile});
        }).catch((err)=>{
          log.error(`Error enabling username protection: ${err}`);
        });
      } else {
        return;
      }
    });
  }
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
        style={{
          minWidth: '183px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
          borderTop: '1px solid rgb(149, 34, 14)'
        }}
        className={`menu transition ${p.s.settingsOpen ? 'visible' : 'hidden'}`}>
          {_.map(modes, (mode, i)=>{
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
          <div className="item" onClick={this.props.onSelectInstallDirectory}>
            Select NMS Install Directory
          </div>
          <div className="item" onClick={this.props.onSelectSaveDirectory}>
            Select NMS Save Directory
          </div>
          <div className="item" onClick={this.handleSync}>
            Sync Locations
          </div>
          <div className="item" onClick={this.handleResetRemoteCache}>
            Reset Remote Cache
          </div>
          {p.s.profile ?
          <div className="item" onClick={this.handleUsernameProtection}>
            {`Username Protection: ${p.s.profile.protected ? 'On' : 'Off'}`}
          </div> : null}
          <div className="item" onClick={this.handleWallpaper}>
            {p.s.wallpaper ? 'Reset Wallpaper' : 'Set Wallpaper'}
          </div>
          <div className="divider"></div>
          <div className="item" onClick={this.handleAbout}>
            About
          </div>
          <div className="item" onClick={()=>openExternal('https://neuropuff.com/static/donate.html')}>
            Support NMC
          </div>
          <div className="divider"></div>
          <div className="item" onClick={p.onRestart}>
            Restart
          </div>
          <div className="item" onClick={()=>window.close()}>
            Quit
          </div>
        </div>
      </div>
    );
  }
};

DropdownMenu = onClickOutside(DropdownMenu);

class BasicDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false
    };
    autoBind(this);
  }
  handleOptionClick(e, option){
    if (this.props.persist) {
      e.stopPropagation();
    }
    option.onClick(option.id);
    this.setState({open: this.props.persist});
  }
  handleClickOutside(){
    if (this.state.open) {
      this.setState({open: false});
    }
  }
  render(){
    let p = this.props;
    let height = p.height ? p.height : window.innerHeight;
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
          background: 'rgb(23, 26, 22)',
          maxHeight: `${height / 2}px`,
          minWidth: '132.469px',
          overflowY: 'auto'
        }}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          {this.props.options.length > 0 ? _.map(this.props.options, (option, i)=>{
            return (
              <div key={i} className="item" onClick={(e)=>this.handleOptionClick(e, option)}>{option.label}</div>
            );
          }) : null}
        </div>
      </div>
    );
  }
};

BasicDropdown.defaultProps = {
  options: [],
  selectedGalaxy: 0,
  icon: 'dropdown',
  showValue: true,
  persist: false
};
BasicDropdown = onClickOutside(BasicDropdown);

class TooltipChild extends React.Component {
  constructor(props) {
    super(props);
  }
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
          {_.map(this.props.payload, (item, i)=>{
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
};

class ThreeDimScatterChart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      show: {
        'Shared': true,
        'Explored': true,
        'Center': true,
        'Favorite': true,
        'Current': true,
        'Selected': true,
        'Base': true
      }
    };
    autoBind(this);
  }
  componentDidMount(){
    _.defer(()=>{
      $('.recharts-legend-item-text').css({position: 'relative', top: '3px'});
      utils.each(this.state.show, (type, key)=>{
        $('.recharts-legend-item').each(function(){
          if ($(this).text() === key) {
            $(this).addClass(key.split(' ').join('_'));
          }
        });
      });
    });
  }
  renderShape(symbol){
    symbol.fill = '#fbbd08';
    return symbol;
  }
  handleSelect(symbol){
    let refStoredLocation = _.findIndex(this.props.storedLocations, {id: symbol.id});
    if (refStoredLocation !== -1) {
      state.set({selectedLocation: this.props.storedLocations[refStoredLocation]});
    }
    let refRemoteLocation = _.findIndex(this.props.remoteLocations.results, {id: symbol.id});
    if (refRemoteLocation !== -1) {
      state.set({selectedLocation: this.props.remoteLocations.results[refRemoteLocation].data});
    }
  }
  handleLegendClick(e){
    this.state.show[e.payload.name] = !this.state.show[e.payload.name];
    this.setState({show: this.state.show}, ()=>{
      $(`.${e.payload.name.split(' ').join('_')}`).css({
        opacity: this.state.show[e.payload.name] ? '1' : '0.5'
      });
    });
  }
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

    utils.each(p.storedLocations, (location)=>{
      if (location.galaxy !== p.selectedGalaxy) {
        return;
      }

      if (location.upvote && this.state.show['Favorite']) {
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
      } else if (location.id === p.currentLocation && this.state.show['Current']) {
        currentLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else if (location.base && this.state.show['Base']) {
        baseLocations.push({
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
      utils.each(p.remoteLocations.results, (location)=>{
        if (location.data.galaxy !== p.selectedGalaxy) {
          return;
        }
        if (location.data.upvote && this.state.show['Favorite']) {
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
        } else if (location.data.id === p.currentLocation && this.state.show['Current']) {
          currentLocation.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.data.base && this.state.show['Base']) {
          baseLocations.push({
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
        <Scatter name="Selected" data={selectedLocation} fill="#ffc356" shape="circle" isAnimationActive={false}/>
        <Scatter name="Current" data={currentLocation} fill="#FFF" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
      </ScatterChart>
    );
  }
};

class ImageModal extends React.Component {
  constructor(props) {
    super(props);
  }
  handleClickOutside(){
    state.set({selectedImage: null});
  }
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
};

ImageModal = onClickOutside(ImageModal);

const locationItemStyle = {padding: '0px 2px', margin: '0px 3px', background: 'rgba(23, 26, 22, 0.8)', fontFamily: 'geosanslight-nmsregular', fontSize: '16px'};

class Item extends React.Component {
  constructor(props) {
    super(props);
  }
  render(){
    return (
      <div
      className="ui segment"
      style={utils.css(locationItemStyle, {position: 'initial', borderBottom: '1px solid rgba(255, 255, 255, 0.27)'})}>
        <span style={{fontWeight: '600'}}>{`${this.props.label}`}</span> <span style={{float: 'right', position: 'relative', top: '1px', WebkitUserSelect: 'initial'}}>{this.props.value}</span>
      </div>
    );
  }
};

class Button extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hover: false,
    };
    autoBind(this);
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
    if (nextProps.selectType && !_.isEqual(nextProps.location, this.props.location) && this.refs.scrollBox) {
      this.refs.scrollBox.scrollTop = 0;
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
    let title = 'Selected';
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
      <div style={{minHeight: '245px'}}>
        <VisibilitySensor
        active={p.enableVisibilityCheck}
        partialVisibility={true}
        onChange={this.onVisibilityChange} />
        {this.state.isVisible ?
        <div
        className="ui segment"
        style={{
          background: p.selectType ? 'rgba(23, 26, 22, 0.9)' : 'rgb(23, 26, 22)',
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
          style={this.starStyle}
          className={`${upvote ? '' : 'empty '}star icon`}
          onClick={()=>p.onFav(p.location)} />
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
          </div>
          {p.edit ?
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
          :
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
              {p.location.galaxy !== undefined ? <Item label="Galaxy" value={galaxies[p.location.galaxy]} /> : null}
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
              </div>: null}
            </div>
          </div>}
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

class GalacticMap extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  componentDidMount(){
    this.buildGalaxyOptions(this.props, true);
  }
  componentWillReceiveProps(nextProps){
    if (nextProps.storedLocations !== this.props.storedLocations
      || nextProps.remoteLocations !== this.props.remoteLocations
      || !_.isEqual(nextProps.selectedLocation, this.props.selectedLocation)) {
      this.buildGalaxyOptions(nextProps, false);
    }
  }
  shouldComponentUpdate(nextProps){
    return (nextProps.transparent !== this.props.transparent
      || nextProps.mapZoom !== this.props.mapZoom
      || nextProps.mapLines !== this.props.mapLines
      || nextProps.galaxyOptions !== this.props.galaxyOptions
      || nextProps.selectedGalaxy !== this.props.selectedGalaxy
      || nextProps.storedLocations !== this.props.storedLocations
      || nextProps.width !== this.props.width
      || nextProps.height !== this.props.height
      || nextProps.remoteLocations.results !== this.props.remoteLocations.results
      || !_.isEqual(nextProps.selectedLocation, this.props.selectedLocation)
      || nextProps.currentLocation !== this.props.currentLocation)
  }
  buildGalaxyOptions(p, init){
    let options = [];
    let currentGalaxy = 0;
    utils.each(p.storedLocations, (location, i)=>{
      if (location.id === p.currentLocation && location.galaxy) {
        currentGalaxy = location.galaxy;
      }
      options.push({id: location.galaxy});
    });
    if (p.remoteLocations && p.remoteLocations.results) {
      utils.each(p.remoteLocations.results, (location, i)=>{
        if (location.data.galaxy) {
          options.push({id: location.data.galaxy});
        }
      });
    }
    if (p.selectedLocation && p.selectedLocation.galaxy) {
      options.push({id: p.selectedLocation.galaxy});
    }
    options = _.chain(options).uniqBy('id').orderBy('id', 'asc').value();
    utils.each(options, (option, i)=>{
      options[i].label = galaxies[option.id];
      options[i].onClick = (id)=>state.set({selectedGalaxy: id});
    });
    state.set({
      galaxyOptions: options,
      selectedGalaxy: init ? currentGalaxy : p.selectedGalaxy
    });
  }
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
        background: 'rgba(23, 26, 22, 0.9)',
        background: p.mapZoom && (p.width > 1804 && p.selectedLocation || p.width > 1698 && !p.selectedLocation) ? `rgba(23, 26, 22, 0.9)` : 'rgb(23, 26, 0.95)',
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
          height={p.height}
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
          currentLocation={p.currentLocation}
          username={p.username} />
        </div>
      </div>
    );
  }
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
  shouldComponentUpdate(nextProps, nextState) {
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
    let name = this.props.location.name && this.props.location.name.length > 0 ? this.props.location.name : this.props.location.id
    name = _.truncate(name, {length: 20});
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
        <p style={{display: 'inline', maxWidth: '177px'}}>{name}</p>
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
      minWidth: '245px',
      maxWidth: '265px',
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
            <div className="ui segments" style={{maxHeight: `${this.props.height - (this.props.mapZoom ? 498 : 125)}px`, overflowY: 'auto'}}>
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
      edit: false
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

    utils.ajax.post('/nmslocation/',{
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
    let locationItemStyle = {padding: '0px 3px', background: '#0B2B39', fontFamily: 'geosanslight-nmsregular', fontSize: '16px'};
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
              currentLocation={p.s.currentLocation}
              username={p.s.username} />
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
    window.handleWallpaper = this.handleWallpaper
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

        let modPath = `/GAMEDATA/PCBANKS/MODS`;

        let hasPath = false;
        utils.each(letters, (drive, key)=>{
          utils.each(paths, (path)=>{
            let __path = `${drive}:${path}${modPath}`;
            if (fs.existsSync(__path)) {
              hasPath = true;
              indexModsInUse(__path);
              return;
            }
          });
        });
        if (!hasPath) {
          log.error('Failed to locate NMS install: path doesn\'t exist.')
          initialize();
        }
      }).catch((err) => {
        initialize();
        log.error(`Failed to locate NMS install: ${err}`);
        if (err.toString().indexOf('not recognized') !== -1) {
          initialize();
        } else {
          this.handleInstallDirFailure();
        }
      });
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
  syncRemoteOwned(cb){
    utils.ajax.get('/nmslocationsync', {
      params: {
        username: this.state.username
      }
    }).then((res)=>{
      this.formatRemoteLocations(res, 1, this.state.sort, false, true, true, cb);
    }).catch((err)=>{
      log.error(`Failed to sync to remote locations: ${err}`);
    });
  }
  handleSync(page=1, sort=this.state.sort, init=false){
    this.syncRemoteOwned(()=>{
      let locations = [];
      utils.each(this.state.storedLocations, (location)=>{
        location = _.cloneDeep(location);
        location.timeStamp = new Date(location.timeStamp);
        locations.push(location);
      });
      utils.ajax.post('/nmslocationremotesync/', {
        locations: locations,
        mode: this.state.mode,
        username: this.state.username
      }).then((res)=>{
        this.fetchRemoteLocations(page, sort, init, true, true);
      }).catch((err)=>{
        log.error(`Failed to sync local locations to remote locations: ${err}`);
        if (init) {
          this.fetchRemoteLocations(page, sort, init, true);
        }
      });
    });
  }
  formatRemoteLocations(res, page, sort, init, partial, sync, cb){
    if (this.state.remoteLocations.length === 0) {
      this.state.remoteLocations = {
        results: []
      };
    }

    if (this.state.search.length === 0 && page > 1 && sort === this.state.sort || partial && !sync) {
      let order = sort === '-created' ? 'created' : sort === '-score' ? 'score' : 'teleports';
      res.data.results = _.chain(this.state.remoteLocations.results).concat(res.data.results).uniqBy('id').orderBy(order, 'desc').value();
    }
    utils.each(res.data.results, (remoteLocation, key)=>{
      let refFav = _.findIndex(this.state.favorites, (fav)=>{
        return fav === remoteLocation.data.id;
      });
      let upvote = refFav !== -1;

      res.data.results[key].data.username = remoteLocation.username;
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
      let refStoredLocation = _.findIndex(this.state.storedLocations, {id: remoteLocation.data.id});
      if (refStoredLocation !== -1) {
        this.state.storedLocations[refStoredLocation].image = remoteLocation.image;
        this.state.storedLocations[refStoredLocation].username = remoteLocation.username;
        this.state.storedLocations[refStoredLocation].name = remoteLocation.name;
        this.state.storedLocations[refStoredLocation].description = remoteLocation.description;
        this.state.storedLocations[refStoredLocation].score = remoteLocation.score;
      }

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

    let stateUpdate = {
      storedLocations: this.state.storedLocations,
      remoteLocations: res.data,
      searchInProgress: this.state.search.length > 0,
      init: false
    };

    // Preserve pagination data from being overwritten on partials
    if (partial) {
      res.data.count = this.state.remoteLocations.count;
      res.data.next = this.state.remoteLocations.next;
    }

    if (!sync) {
      stateUpdate.page = init ? 1 : page;
    }

    state.set(stateUpdate, cb, sync);
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

    utils.ajax.get('/nmslocationpoll', {
      params: {
        start: start,
        end: end,
        id: lastRemoteLocation.data.id
      }
    }).then((res)=>{
      if (res.data.results.length > 0) {
        this.formatRemoteLocations(res, this.state.page, this.state.sort, false, true, false, ()=>{
          this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
        });
      } else {
        this.timeout = setTimeout(()=>this.pollRemoteLocations(), 30000);
      }
    }).catch((err)=>{
      log.error(`Remote location polling error: ${err}`);
      console.log(err);
    });
  }
  fetchRemoteLocations(page=this.state.page, sort=this.state.sort, init=false, sync=false){
    let q = this.state.search.length > 0 ? this.state.search : null;
    let path = q ? '/nmslocationsearch' : '/nmslocation';
    utils.ajax.get(path, {
      params: {
        page: page,
        sort: sort,
        q: q
      }
    }).then((res)=>{
      this.formatRemoteLocations(res, page, sort, init, false, sync, ()=>{
        if (init) {
          this.pollRemoteLocations(init);
        }
      });
    }).catch((err)=>{
      state.set({init: false});
      console.log(err);
      log.error(`Failed to fetch remote locations: ${err}`);
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
  pollSaveData(mode, init=false){
    let getLastSave = (NMSRunning=false)=>{
      let next = ()=>{
        if (init) {
          this.handleWallpaper();
          this.handleSync(1, this.state.sort, init);
        } else {
          this.fetchRemoteLocations(1, this.state.sort, init);
        }
        if (init) {
          watch.createMonitor(this.state.saveDirectory/*path.join(state.get().homedir, 'AppData', 'Roaming', 'HelloGames', 'NMS')*/, {
            ignoreDotFiles: true,
            ignoreNotPermitted: true,

          }, (monitor)=>{
            monitor.on('changed', (f, curr, prev)=>{
              this.pollSaveData();
            });
          });
        }
      };

      if (mode && mode !== this.state.mode) {
        this.state.mode = mode;
      }

      let processData = (saveData, location, refLocation, username, profile=null)=>{
        /*let uniquePlayers = [];
        utils.each(saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record, (record)=>{
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

          utils.each(this.state.storedLocations, (storedLocation, i)=>{
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
            saveFileName: saveData.path
          };

          if (profile) {
            stateUpdate.profile = profile.data;
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

      utils.getLastGameModeSave(this.state.saveDirectory, this.state.mode).then((saveData)=>{
        let location = utils.formatID(saveData.result.PlayerStateData.UniverseAddress);
        const refLocation = _.findIndex(this.state.storedLocations, {id: location.id});
        let username = saveData.result.DiscoveryManagerData['DiscoveryData-v1'].Store.Record[0].OWS.USN;

        utils.ajax.get('/nmsprofile', {
          params: {
            username: username,
            machineId: this.state.machineId
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

    ps.snapshot(['ProcessName']).then((list) => {
      let NMSRunning = _.findIndex(list, {ProcessName: 'NMS.exe'}) !== -1;
      getLastSave(NMSRunning);
    }).catch((err)=>{
      log.error(`Unable to use win-ps: ${err}`);
      getLastSave(false);
    });
  }
  handleProtectedSession(username){
    dialog.showMessageBox({
      title: `Protection Enabled For ${username}`,
      message: 'This username was protected by another user. When you protect your username, the app will associate your computer with your username to prevent impersonation. If this is in error, please open an issue on the Github repository.',
      buttons: ['OK', 'Open Issue']
    }, result=>{
      if (result === 1) {
        openExternal('https://github.com/jaszhix/NoMansConnect/issues');
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
    if (!this.state.saveDirectory) {
      state.set({
        saveDirectory: `${this.state.homedir}/AppData/Roaming/HelloGames/NMS`
      }, cb);
    } else if (this.state.saveDirectory.indexOf('DefaultUser') !== -1) {
      state.set({
        saveDirectory: `${this.state.homedir}/AppData/Roaming/HelloGames/NMS/DefaultUser`
      }, cb);
    } else {
      state.set({
        title: 'NMS Save Directory Not Found, Please Select Location'
      }, ()=>{
        this.handleSelectSaveDirectory();
      });
    }
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
  handleEnter(e, id){
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
      if (this.state.remoteLocationsCache) {
        state.set({remoteLocations: this.state.remoteLocationsCache});
      } else {
        this.fetchRemoteLocations(1, this.state.sort);
      }
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
