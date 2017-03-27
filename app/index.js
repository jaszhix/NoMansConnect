import {remote} from 'electron';
import fs from 'fs';
import path from 'path';

import state from './state';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import _ from 'lodash';
import $ from 'jquery';
import ReactUtils from 'react-utils';
import ReactMarkdown from 'react-markdown';
import onClickOutside from 'react-onclickoutside';
import {ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend} from 'recharts';

import * as utils from './utils';
import './app.global.css';

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
      message: '0.0.1',
      detail: 'This version is alpha. Please back up your save files.'
    });
  },
  /*handleOpenDir(){
    dialog.showOpenDialog({properties: ['openDirectory']}, (cb)=>{
      if (fs.existsSync(`${cb[0]}/package.json`) && fs.existsSync(`${cb[0]}/node_modules`)) {
        state.set({nmDir: `${cb[0]}/node_modules/`, global: false});
        this.props.onDirOpen();
      } else {
        dialog.showErrorBox('Node Modules Not Found', 'The directory you selected does not contain a package.json file, or a node_modules directory.');
      }
    });
  },*/
  handleOpenGlobal(){
    state.set({global: true, nmDir: ''}, ()=>this.props.onDirOpen());
  },
  render(){
    var p = this.props;
    let modes = ['permadeath', 'survival', 'normal', 'creative'];
    return (
      <div className={`ui dropdown icon item${p.s.settingsOpen ? ' visible' : ''}`} onClick={()=>state.set({settingsOpen: !p.s.settingsOpen})}>
        <i className="wrench icon"></i>
        <div className={`menu transition ${p.s.settingsOpen ? 'visible' : 'hidden'}`}>
          {/*<div className="item" onClick={this.handleOpenDir}>
            Open Directory
          </div>
          <div className="divider"></div>*/}
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

var TooltipChild = React.createClass({
  render(){
    if (this.props.active) {
      return (
        <div className="ui segments" style={{
          background: '#0B2B39',
          display: 'inline-table',
          borderTop: '2px solid #95220E',
          textAlign: 'left'
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
  renderShape(symbol){
    symbol.fill = '#fbbd08';
    return symbol;
  },
  handleSelect(symbol){
    _.each(this.props.storedLocations, (location)=>{
      if (location.translatedX === symbol.x
        && location.translatedY === symbol.z
        && (0, 4096) - location.translatedZ === symbol.y) {
        state.set({selectedLocation: location});
        return;
      }
    })
  },
  render () {
    let currentLocation = [];
    let locations = [];
    let remoteLocations = [];
    let selectedLocation = [];
    _.each(this.props.storedLocations, (location)=>{
      if (this.props.selectedLocation && location.id === this.props.selectedLocation.id) {
        selectedLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
          selected: true
        });
      } else if (_.isEqual(location, _.first(this.props.storedLocations))) {
        currentLocation.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY
        });
      } else {
        locations.push({
          x: location.translatedX,
          y: (0, 4096) - location.translatedZ,
          z: location.translatedY,
        });
      }
    });
    if (this.props.remoteLocations && this.props.remoteLocations.results) {
      _.each(this.props.remoteLocations.results, (location)=>{
        if (location.username !== this.props.username) {
          remoteLocations.push({
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            user: location.username
          });
        }
      });
    }

    let center = [{
      x: 2047,
      y: 2047,
      z: 127
    }];
    let size = this.props.width >= 1349 ? 512 : this.props.width <= 1180 ? 240 : this.props.width <= 1180 ? 360 : this.props.width <= 1240 ? 400 : this.props.width <= 1300 ? 440 : 480
    return (
      <ScatterChart width={size} height={size} margin={{top: 20, right: 20, bottom: 20}}>
        <XAxis tickLine={false} tickFormatter={(tick)=>''} ticks={[0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4096]} domain={[0, 4096]} type="number" dataKey="x" range={[0, 4096]} name="X" label="X"/>
        <YAxis tickLine={false} tickFormatter={(tick)=>''} ticks={[0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4096]} domain={[0, 4096]} type="number" dataKey="y" range={[0, 4096]} name="Z" label="Z"/>
        <ZAxis dataKey="z" range={[60, 200]} name="Y" />
        <CartesianGrid />
        <Tooltip cursor={{strokeDasharray: '3 3'}} content={<TooltipChild />}/>
        <Legend align="right"/>
        <Scatter name="Selected Location" data={selectedLocation} fill="#fbbd08" shape="circle" isAnimationActive={false}/>
        <Scatter name="Current Location" data={currentLocation} fill="#FFF" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
        <Scatter name="Explored Location" data={locations} fill="#82ca9d" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Shared Location" data={remoteLocations} fill="#2780a7" shape="circle" isAnimationActive={false}/>
        <Scatter name="Center" data={center} fill='#DA2600' shape="circle" isAnimationActive={false}/>
      </ScatterChart>
    );
  }
});

var Container = React.createClass({
  getInitialState(){
    return {
      storedLocationHover: -1,
      edit: false,
      updating: false,
      limit: false,
      description: ''
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
  handleUpdate(){
    if (this.state.description.length > 200) {
      this.setState({limit: true});
      return;
    }
    this.setState({updating: true}, ()=>{
      utils.ajax.post('/nmslocation/', {
        username: this.props.s.username,
        description: this.state.description,
        id: this.props.s.selectedLocation.id
      }).then((res)=>{
        let refLocation = _.findIndex(this.props.s.storedLocations, {id: this.props.s.selectedLocation.id});
        if (refLocation !== -1) {
          this.props.s.storedLocations[refLocation].description = this.state.description;
        }
        let refRemoteLocation = _.findIndex(this.props.s.remoteLocations.results, (location)=>{
          return location.data.id === this.props.s.selectedLocation.id;
        });
        if (refRemoteLocation !== -1) {
          this.props.s.remoteLocations.results[refRemoteLocation].data.description = this.state.description;
        }
        state.set({
          storedLocations: this.props.s.storedLocations,
          remoteLocations: this.props.s.remoteLocations
        }, ()=>{
          this.setState({
            updating: false,
            edit: false
          });
        });
      });
    });
  },
  render(){
    let p = this.props;
    return (
      <div className="ui grid row" style={{paddingTop: '51px', float: 'left', position: 'absolute', margin: '0px auto', left: '0px', right: '0px'}}>
        <div className="col-sm-8">
          <div className="ui segments stackable grid container" style={{maxWidth: '800px !important'}}>
            <div
            className="ui segment"
            style={{display: 'inline-flex', paddingLeft: '26px', background: '#171A16'}}
            onMouseLeave={()=>this.setState({storedLocationHover: -1})}>
              <div className="ui segment" style={{
                background: '#0B2B39',
                display: 'inline-table',
                borderTop: '2px solid #95220E',
                width: '245px',
                textAlign: 'center'
              }}>
                <h3>Explored Locations</h3>
                <div className="ui segments" style={{maxHeight: `${p.s.height - 125}px`}}>
                  {p.s.storedLocations.map((location, i)=>{
                    return (
                      <div
                      key={location.id}
                      className="ui segment"
                      style={{
                        cursor: 'pointer',
                        padding: '3px 3px',
                        background: this.state.storedLocationHover === i || p.s.selectedLocation && p.s.selectedLocation.id === location.id ? 'rgba(23, 26, 22, 0.34)' : '#0B2B39',
                      }}
                      onMouseEnter={()=>this.setState({storedLocationHover: i})}
                      onClick={()=>state.set({selectedLocation: location})}>
                        <p>{this.state.storedLocationHover === i || p.s.selectedLocation && p.s.selectedLocation.id === location.id ? location.translatedId : location.id}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="ui segments" style={{display: 'inline-flex', paddingTop: '13px', marginLeft: '0px'}}>
              <div className="ui segment" style={{
                background: '#42201E',
                display: 'inline-table',
                borderTop: '2px solid #95220E',
                textAlign: 'center'
              }}>
                <h3>Galactic Map</h3>
                <div style={{position: 'relative', left: '-18px'}}>
                  <ThreeDimScatterChart
                  storedLocations={p.s.storedLocations}
                  width={p.s.width}
                  remoteLocations={p.s.remoteLocations}
                  selectedLocation={p.s.selectedLocation}
                  username={p.s.username} />
                </div>
              </div>
              {p.s.selectedLocation ?
              <div className="ui segment" style={{
                background: '#0B2B39',
                display: 'inline-table',
                borderTop: '2px solid #95220E',
                textAlign: 'left',
                marginTop: '26px',
                minWidth: '371px'
              }}>
                <h3 style={{textAlign: 'center'}}>Selected Location</h3>
                {this.state.edit ?
                  <div>
                    <div
                    className="ui segment"
                    style={{
                      padding: '3px 3px',
                      cursor: 'pointer',
                      background: this.state.storedLocationHover === 'cancel' ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
                    }}>
                      <div className="ui input" style={{width: '200px'}}>
                        <div className="row">
                          <textarea
                          style={{width: '300px', position: 'relative', left: '28px', top: '3px', color: '#000'}}
                          type="text"
                          value={this.state.description}
                          onChange={(e)=>this.setState({description: e.target.value})}
                          placeholder="Description... (200 character limit)" />
                        </div>
                      </div>
                    </div>
                    <div
                      className="ui segment"
                      style={{
                        padding: '3px 3px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: this.state.storedLocationHover === 'updateForm' ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
                      }}
                      onMouseEnter={()=>this.setState({storedLocationHover: 'updateForm'})}
                      onMouseLeave={()=>this.setState({storedLocationHover: -1})}
                      onClick={this.handleUpdate}>
                        {this.state.updating ? 'Updating...' : this.state.limit ? `Limit Exceeded (${this.state.description.length} characters)` : 'Update Location'}
                      </div>
                      <div
                      className="ui segment"
                      style={{
                        padding: '3px 3px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: this.state.storedLocationHover === 'cancel' ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
                      }}
                      onMouseEnter={()=>this.setState({storedLocationHover: 'cancel'})}
                      onMouseLeave={()=>this.setState({storedLocationHover: -1})}
                      onClick={()=>this.setState({edit: false, description: ''})}>
                        Cancel
                      </div>
                    </div>
                :
                <div>
                  <div>
                    <div
                    className="ui segment"
                    style={{padding: '3px 3px', background: '#0B2B39'}}>
                      Galactic Address: {p.s.selectedLocation.translatedId}
                    </div>
                    <div
                    className="ui segment"
                    style={{padding: '3px 3px', background: '#0B2B39'}}>
                      Voxel Address: {p.s.selectedLocation.id}
                    </div>
                    <div
                    className="ui segment"
                    style={{padding: '3px 3px', background: '#0B2B39'}}>
                      Distance to Center: {p.s.selectedLocation.distanceToCenter.toFixed(3)} LY
                    </div>
                    <div
                    className="ui segment"
                    style={{padding: '3px 3px', background: '#0B2B39'}}>
                      Jumps: {p.s.selectedLocation.jumps}
                    </div>
                  </div>
                  <div
                  className="ui segment"
                  style={{
                    padding: '3px 3px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: this.state.storedLocationHover === 'teleport' ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
                  }}
                  onMouseEnter={()=>this.setState({storedLocationHover: 'teleport'})}
                  onMouseLeave={()=>this.setState({storedLocationHover: -1})}
                  onClick={()=>p.onTeleport(location, 'selected')}>
                    {p.s.installing && p.s.installing === `tselected` ? 'Working...' : 'Teleport Here'}
                  </div>
                  <div
                  className="ui segment"
                  style={{
                    padding: '3px 3px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: this.state.storedLocationHover === 'update' ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
                  }}
                  onMouseEnter={()=>this.setState({storedLocationHover: 'update'})}
                  onMouseLeave={()=>this.setState({storedLocationHover: -1})}
                  onClick={()=>this.setState({edit: true})}>
                    Add Details
                  </div>
                </div>}
              </div> : null}
            </div>
          </div>
        </div>
        {p.s.remoteLocations && p.s.remoteLocations.results ?
        <div className="col-sm-4">
          <div className="ui segments" style={{display: 'inline-flex', paddingTop: '13px'}}>
            <div className="ui segment" style={{
              background: '#42201E',
              display: 'inline-table',
              borderTop: '2px solid #95220E',
              textAlign: 'center'
            }}>
              <h3>Recent Explorations</h3>
              <div style={{maxHeight: `${p.s.height - 125}px`, overflowY: 'auto'}} ref="recentExplorations">
                {p.s.remoteLocations.results.map((location, i)=>{
                  return (
                    <div key={i} className="ui segment" style={{
                      background: '#0B2B39',
                      display: 'block',
                      borderTop: '2px solid #95220E',
                      textAlign: 'left',
                      marginTop: `${i === 0 ? 0 : 26}px`,
                      maxWidth: '371px'
                    }}>
                      <h3 style={{textAlign: 'center'}}>{location.username} explored</h3>
                      <div style={{maxHeight: '184px', overflowY: 'auto'}}>
                        {location.description ?
                        <div
                        className="ui segment"
                        style={{padding: '3px 3px', background: '#0B2B39'}}>
                          Description: {location.description}
                        </div> : null}
                        <div
                        className="ui segment"
                        style={{padding: '3px 3px', background: '#0B2B39'}}>
                          Galactic Address: {location.data.translatedId}
                        </div>
                        <div
                        className="ui segment"
                        style={{padding: '3px 3px', background: '#0B2B39'}}>
                          Voxel Address: {location.data.id}
                        </div>
                        {location.data.distanceToCenter ?
                        <div
                        className="ui segment"
                        style={{padding: '3px 3px', background: '#0B2B39'}}>
                          Distance to Center: {location.data.distanceToCenter.toFixed(3)} LY
                        </div> : null}
                        <div
                        className="ui segment"
                        style={{padding: '3px 3px', background: '#0B2B39'}}>
                          Jumps: {location.data.jumps}
                        </div>
                        <div
                        className="ui segment"
                        style={{padding: '3px 3px', background: '#0B2B39'}}>
                          Mode: {_.upperFirst(location.mode)}
                        </div>
                      </div>
                      <div
                      className="ui segment"
                      style={{
                        padding: '3px 3px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: this.state.storedLocationHover === `t${i}` ? 'rgba(23, 26, 22, 0.6)' : '#171A16'
                      }}
                      onMouseEnter={()=>this.setState({storedLocationHover: `t${i}`})}
                      onMouseLeave={()=>this.setState({storedLocationHover: -1})}
                      onClick={()=>p.onTeleport(location)}>
                        {p.s.installing && p.s.installing === `t${i}` ? 'Working...' : 'Teleport Here'}
                      </div>
                    </div>
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
    this.setState({init: false});
    $('#splash').remove();
    this.saveJSON = path.join(__dirname, 'saveCache.json');
    this.saveJSON = path.resolve(__dirname, this.saveJSON);
    this.saveTool = process.env.NODE_ENV === 'production' ? '\\nmssavetool\\nmssavetool.exe' : '\\app\\nmssavetool\\nmssavetool.exe';
    this.whichCmd = `.${this.saveTool} decrypt -g ${this.state.mode} -o ${this.saveJSON}`;

    utils.ajax.get('/nmslocation', {
      params: {
        version: true
      }
    }).then((res)=>{
      if (res.data.version !== this.state.version) {
        state.set({canUpgrade: true}, ()=>{
          this.pollSaveData();
        });
      } else {
        this.pollSaveData();
      }
    }).catch(()=>{
      this.pollSaveData();
    });
  },
  fetchRemoteLocations(page=this.state.page){
    utils.ajax.get('/nmslocation', {
      params: {
        page: page
      }
    }).then((res)=>{
      let data = res.data;
      if (page > 1) {
        data.results = _.concat(this.props.s.remoteLocations.results, data.results)
      }
      state.set({
        remoteLocations: data,
        page: page
      });
    }).catch((err)=>{
      console.log(err)
    });
  },
  handleTeleport(location, i){
    state.set({installing: `t${i}`}, ()=>{
      utils.exc(this.whichCmd).then((result)=>{
        let saveData = JSON.parse(fs.readFileSync(this.saveJSON));

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

        fs.writeFile(this.saveJSON, JSON.stringify(saveData), {flag : 'w'}, (err, data)=>{
          if (err) {
            console.log(err);
          }
          utils.exc(`.${this.saveTool} encrypt -g ${this.state.mode} -i ${this.saveJSON}`, (res)=>{
            console.log(res);
          }).catch((e)=>{
            console.log(e);
          });
          state.set({installing: false});
        });
      }).catch((e)=>{
        console.log(e);
      });
    });
  },
  pollSaveData(mode){
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    let next = ()=>{
      this.fetchRemoteLocations();
      this.timeout = setTimeout(()=>this.pollSaveData(), 30000);
    };

    if (mode && mode !== this.state.mode) {
      this.stat.mode = mode;
    }

    utils.exc(this.whichCmd).then((result)=>{
      let saveData = JSON.parse(fs.readFileSync(this.saveJSON));
      let location = utils.formatID(saveData.PlayerStateData.UniverseAddress.GalacticAddress);
      const refLocation = _.findIndex(this.state.storedLocations, {id: location.id});
      let username = saveData.DiscoveryManagerData['DiscoveryData-v1'].Store.Record[0].OWS.USN;

      _.assignIn(location, {
        username: _.isString(username) && username.length > 0 ? username : '',
        playerPosition: _.clone(saveData.SpawnStateData.PlayerPositionInSystem),
        playerTransform: _.clone(saveData.SpawnStateData.PlayerTransformAt),
        shipPosition: _.clone(saveData.SpawnStateData.ShipPositionInSystem),
        shipTransform: _.clone(saveData.SpawnStateData.ShipTransformAt),
        distanceToCenter: Math.sqrt(Math.pow(location.VoxelX, 2) + Math.pow(location.VoxelY, 2) + Math.pow(location.VoxelZ, 2)) * 100,
        translatedX: utils.convertInteger(location.VoxelX, [4096, 2048]),
        translatedZ: utils.convertIntegerZ(location.VoxelZ, [3584, 1536, 4096]),
        translatedY: utils.convertInteger(location.VoxelY, [256, 128]),
        timeStamp: Date.now()
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
            data: location
          }).then((res)=>{
            next();
          }).catch((err)=>{
            console.log(err)
          });
        } else {
          next();
        }
      });
      console.log(saveData)
    }).catch((e)=>{
      console.log(e)
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
  render(){
    var s = this.state;
    return (
      <div>
        <div className="ui top attached menu" style={{
          position: 'absolute',
          maxHeight: '42px',
          zIndex: '99',
          WebkitUserSelect: 'none'
        }}>
          <h2 style={{
            position: 'absolute',
            left: '32px',
            top: '5px',
            margin: 'initial',
            WebkitTransition: 'left 0.1s'
          }}>{s.title}</h2>
          <div className="right menu">
            {/*<div className="item">
              <div className="ui transparent icon input">
                <input type="text" placeholder="Search..." value={s.search} onChange={(e)=>state.set({search: e.target.value})} onKeyDown={this.handleEnter}/>
                <i className={s.searchLoading ? 'ui basic loading button' : 'search link icon'} style={{cursor: 'default', padding: '0px'}} onClick={this.triggerSearch}/>
              </div>
            </div>*/}
            <DropdownMenu
            s={s}
            onModeSwitch={(mode)=>this.pollSaveData(mode)}  />
          </div>
        </div>
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
