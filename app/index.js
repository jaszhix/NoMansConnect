import './app.global.css';
import {remote} from 'electron';
const win = remote.getCurrentWindow();
import fs from 'fs';
import path from 'path';
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
let galaxyIter = 0;
let galaxyRepeat = 1
_.each(galaxies, (g, k)=>{
  ++galaxyIter;
  if (galaxyIter > 61) {
    galaxies[k] = `Galaxy ${galaxyIter}`;
  }
});

if (module.hot) {
  module.hot.accept();
}

const {Menu, MenuItem, dialog} = remote;

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
      message: '0.3.1',
      detail: 'This version is beta. Please back up your save files.'
    });
  },
  handleOpenGlobal(){
    state.set({global: true, nmDir: ''}, ()=>this.props.onDirOpen());
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
          <div className="item" onClick={this.handleAbout}>
            About
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
      selectedGalaxy: 0
    };
  },
  getInitialState(){
    return {
      open: false
    };
  },
  handleOptionClick(option){
    option.onClick(option.id);
    this.setState({open: false});
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
        <div className="text">{galaxies[p.selectedGalaxy]}</div>
        <i className="dropdown icon" />
        <div
        style={{
          display: this.state.open ? 'block !important' : 'none',
          borderRadius: '0px',
          background: 'rgb(23, 26, 22)'
        }}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          {this.props.options.length > 0 ? this.props.options.map((option, i)=>{
            return (
              <div key={i} className="item" onClick={()=>this.handleOptionClick(option)}>{option.label}</div>
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
          background: '#0B2B39',
          display: 'inline-table',
          borderTop: '2px solid #95220E',
          textAlign: 'left',
        }}>
          {this.props.payload[0].payload.user ?
          <div
          className="ui segment"
          style={{padding: '3px 5px'}}>
            {`${this.props.payload[0].payload.user}`}
          </div> : null}
          {this.props.payload.map((item, i)=>{
            return (
              <div
              key={i}
              className="ui segment"
              style={{padding: '3px 5px'}}>
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
  componentDidMount(){
    let limit = 0;

    _.defer(()=>{
      $('.recharts-legend-item-text').css({position: 'relative', top: '3px'});
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
  render () {
    let p = this.props;
    let currentLocation = [];
    let locations = [];
    let remoteLocations = [];
    let selectedLocation = [];
    let favLocations = [];
    _.each(p.storedLocations, (location)=>{
      if (location.galaxy !== p.selectedGalaxy) {
        return;
      }
      if (location.upvote) {
        favLocations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          selected: true,
          id: location.id
        });
      } else if (p.selectedLocation && location.id === p.selectedLocation.id) {
        selectedLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          selected: true,
          id: location.id
        });
      } else if (_.isEqual(location, _.first(p.storedLocations))) {
        currentLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          id: location.id
        });
      } else {
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
        if (p.selectedLocation && location.data.id === p.selectedLocation.id) {
          selectedLocation.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            selected: true,
            id: location.data.id
          });
        } else if (_.isEqual(location.data, _.first(p.storedLocations))) {
          currentLocation.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            id: location.id
          });
        } else if (location.username !== p.username) {
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

    let center = [{
      x: 2047,
      y: 2047,
      z: 127
    }];

    let size = p.width >= 1349 ? 512 : p.width <= 1180 ? 240 : p.width <= 1180 ? 360 : p.width <= 1240 ? 400 : p.width <= 1300 ? 440 : 480;
    return (
      <ScatterChart width={size} height={size} margin={{top: 20, right: 20, bottom: 20}}>
        <XAxis tickLine={false} tickFormatter={(tick)=>''} ticks={[0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4096]} domain={[0, 4096]} type="number" dataKey="x" range={[0, 4096]} name="X" label="X"/>
        <YAxis tickLine={false} tickFormatter={(tick)=>''} ticks={[0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4096]} domain={[0, 4096]} type="number" dataKey="y" range={[0, 4096]} name="Z" label="Z"/>
        <ZAxis dataKey="z" range={[60, 200]} name="Y" />
        <CartesianGrid />
        <Tooltip cursor={{strokeDasharray: '3 3'}} content={<TooltipChild />}/>
        <Legend align="right" wrapperStyle={{fontFamily: 'geosanslight-nmsregular', fontSize: '16px', right: '0px'}} iconSize={12}/>
        <Scatter name="Explored Location" data={locations} fill="#5fcc93" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Shared Location" data={remoteLocations} fill="#0080db" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Center" data={center} fill="#ba3935" shape="circle" isAnimationActive={false}/>
        <Scatter name="Favorite Location" data={favLocations} fill="#9c317c" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
        <Scatter name="Current Location" data={currentLocation} fill="#FFF" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
        <Scatter name="Selected Location" data={selectedLocation} fill="#ffc356" shape="circle" isAnimationActive={false}/>
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
      <div className="ui modal active" style={{
        background: 'rgb(23, 26, 22)',
        borderTop: '2px solid #95220E',
        position: 'fixed',
        left: '50%',
        top: '30%',
        zIndex: '1001',
        WebkitTransformOrigin: '50% 25%',
        boxShadow: 'none'
      }}>
        <span className="close"/>
        <img className="image content" src={this.props.image} />
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
        <span style={{fontWeight: '600'}}>{`${this.props.label}`}</span> <span style={{float: 'right', position: 'relative', top: '1px'}}>{this.props.value}</span>
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
    return (
      <div
      className="ui segment"
      style={{
        background: '#0B2B39',
        display: 'inline-table',
        //float: 'left',
        borderTop: '2px solid #95220E',
        textAlign: 'left',
        marginTop: p.selectType ? '26px' : 'initial',
        marginBottom: '26px',
        marginRight: !p.selectType && p.i % 1 === 0 ? '26px' : 'initial',
        minWidth: '386px',
        maxWidth: '386px',
        maxHeight: '289px'
      }}>
        <h3 style={{textAlign: 'center', maxHeight: '23px'}}>{p.location.username ? this.state.name.length > 0 ? this.state.name : `${p.location.username} explored` : 'Selected Location'}</h3>
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
              src={p.image}
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
    return (
      <div className="ui segment" style={{
        background: 'rgb(23, 26, 22)',
        display: 'inline-table',
        borderTop: '2px solid #95220E',
        textAlign: 'center'
      }}>
        <h3>Galactic Map</h3>
        {p.galaxyOptions.length > 0 ?
        <div style={{
          position: 'absolute',
          right: '48px',
          top: '16px'
        }}>
          <BasicDropdown
          options={p.galaxyOptions}
          selectedGalaxy={p.selectedGalaxy} />
        </div> : null}
        <div style={{position: 'relative', left: '-18px'}}>
          <ThreeDimScatterChart
          selectedGalaxy={p.selectedGalaxy}
          storedLocations={p.storedLocations}
          width={p.width}
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
  componentWillUnmount(){
    if (this.refs.recentExplorations) {
      this.refs.recentExplorations.removeEventListener('scroll', this.scrollListener);
    }
  },
  scrollListener(){
    let node = this.refs.recentExplorations;
    if (node.scrollTop + window.innerHeight >= node.scrollHeight + node.offsetTop - 200
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
          this.props.s.remoteLocations.results[refRemoteLocation].data.name = name;
          this.props.s.remoteLocations.results[refRemoteLocation].data.description = description;
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
                this.props.s.storedLocations[refLocation].image = newDataUri;
              }
              let refRemoteLocation = _.findIndex(this.props.s.remoteLocations.results, (location)=>{
                return location.data.id === this.props.s.selectedLocation.id;
              });
              if (refRemoteLocation !== -1) {
                this.props.s.remoteLocations.results[refRemoteLocation].data.image = newDataUri;
              }
              this.props.s.selectedLocation.image = newDataUri;
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
        this.props.s.storedLocations[refLocation].image = '';
      }
      let refRemoteLocation = _.findIndex(this.props.s.remoteLocations.results, (location)=>{
        return location.data.id === this.props.s.selectedLocation.id;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].data.image = '';
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
    state.set({
      selectedLocation: this.props.s.selectedLocation && this.props.s.selectedLocation.id === location.id ? null : location,
      selectedGalaxy: location.galaxy
    })
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
            style={{display: 'inline-flex', background: 'transparent'}}
            onMouseLeave={()=>this.setState({storedLocationHover: -1})}>
              <div className="ui segment" style={{
                background: '#0B2B39',
                display: 'inline-table',
                borderTop: '2px solid #95220E',
                width: '245px',
                textAlign: 'center'
              }}>
                <h3>Stored Locations</h3>
                <div className="ui segments" style={{maxHeight: `${p.s.height - 125}px`, overflowY: 'auto'}}>
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
                        <p>{location.name && location.name.length > 0 ? location.name : location.id}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="ui segments" style={{display: 'inline-flex', paddingTop: '14px', marginLeft: '0px'}}>
              <GalacticMap
              galaxyOptions={p.s.galaxyOptions}
              selectedGalaxy={p.s.selectedGalaxy}
              storedLocations={p.s.storedLocations}
              width={p.s.width}
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
          right: '68px',
          maxWidth: remoteLocationsWidth,
        }}>
          <div className="ui segments" style={{display: 'inline-flex', paddingTop: '14px'}}>
            <div className="ui segment" style={{
              background: '#42201E',
              display: 'inline-table',
              borderTop: '2px solid #95220E',
              textAlign: 'center'
            }}>
              <h3>{p.s.sort === '-created' ? 'Recent' : p.s.sort === '-score' ? 'Favorite' : 'Popular'} Explorations</h3>
              <div
              style={{
                maxHeight: `${p.s.height - 125}px`,
                width: remoteLocationsWidth,
                overflowY: 'auto',
                overflowX: 'hidden'
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
        initialize();
      });
    };
    utils.store.get('migrated', (migrated)=>{
      if (!migrated) {
        utils.migrateStorage(()=>{
          indexMods();
        });
      } else {
        indexMods();
      }
    });
  },
  componentDidUpdate(pP, pS){
    if (pS.search.length > 0 && this.state.search.length === 0 && this.state.searchInProgress) {
      state.set({searchInProgress: false}, ()=>{
        this.handleClearSearch();
      });
    }
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
      let data = res.data;
      if (this.state.remoteLocations.length === 0) {
        this.state.remoteLocations = {
          results: []
        };
      }

      if (!q && page > 1 && sort === this.state.sort) {
        data.results = _.concat(this.state.remoteLocations.results, data.results);
        data.results = _.uniqBy(data.results, 'id');
        data.results = _.orderBy(data.results, 'created', 'desc');
      }

      _.each(data.results, (remoteLocation, key)=>{
        let refFav = _.findIndex(this.state.favorites, (fav)=>{
          return fav === remoteLocation.data.id;
        });
        let upvote = refFav !== -1;

        data.results[key].data.name = remoteLocation.name;
        data.results[key].data.description = remoteLocation.description;
        data.results[key].data.score = remoteLocation.score;
        data.results[key].data.upvote = upvote;
        try {
          data.results[key].data.image = remoteLocation.image
        } catch (e) {
          data.results[key].data.image = '';
        }
        if (this.state.selectedLocation) {
          this.state.selectedLocation.image = remoteLocation.data.image;
        }
        _.each(this.state.storedLocations, (storedLocation, key)=>{
          if (remoteLocation.data.id === storedLocation.id) {
            this.state.storedLocations[key].username = remoteLocation.data.username;
            this.state.storedLocations[key].name = remoteLocation.name;
            this.state.storedLocations[key].description = remoteLocation.description;
            this.state.storedLocations[key].score = remoteLocation.score;
            if (!storedLocation.image) {
              this.state.storedLocations[key].image = remoteLocation.data.image;
            }
          }
        });
        if (!init) {
          let remoteOwnedLocations = _.filter(data.results, (remoteOwnedLocation)=>{
            let refStoredLocation = _.findIndex(this.state.storedLocations, {id: remoteOwnedLocation.data.id});
            return remoteOwnedLocation.username === this.state.username && refStoredLocation === -1;
          });
          if (remoteOwnedLocations.length > 0) {
            this.state.storedLocations = _.orderBy(_.concat(this.state.storedLocations, _.map(remoteOwnedLocations, 'data')), 'timeStamp', 'desc');
          }
        }
      });

      state.set({
        selectedLocation: this.state.selectedLocation,
        storedLocations: this.state.storedLocations,
        remoteLocations: data,
        searchInProgress: this.state.search.length > 0,
        page: page,
        init: false
      });
    }).catch((err)=>{
      state.set({init: false});
      console.log(err)
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

      if (this.timeout)  {
        clearTimeout(this.timeout);
      }

      let next = ()=>{
        this.fetchRemoteLocations(1, this.state.sort, init);
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
          this.timeout = setTimeout(()=>this.pollSaveData(), 300000);
        }
      };

      if (mode && mode !== this.state.mode) {
        this.state.mode = mode;
      }

      utils.exc(this.whichCmd).then((result)=>{
        let saveData = JSON.parse(fs.readFileSync(this.saveJSON));
        let location = utils.formatID(saveData.PlayerStateData.UniverseAddress.GalacticAddress);
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
            state.set({username: location.username}, ()=>{
              next();
            });
            return;
          }

          this.state.storedLocations.push(location);
          this.state.storedLocations = _.orderBy(_.uniqBy(this.state.storedLocations, 'id'), 'timeStamp', 'desc');
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
      }).catch((e)=>{
        next();
        console.log(e)
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
            left: '32px',
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
                <i className={s.searchInProgress ? 'remove link icon' : 'search link icon'} style={{cursor: 'default', padding: '0px'}} onClick={()=>s.searchInProgress ? ()=>this.handleClearSearch() : ()=>this.handleSearch()}/>
              </div>
            </div>
            <DropdownMenu
            s={s}
            onModeSwitch={(mode)=>this.pollSaveData(mode)}  />
          </div>
          <div
          style={{WebkitAppRegion: 'no-drag'}}
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
