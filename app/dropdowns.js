import {remote} from 'electron';
import Log from './log';
const log = new Log();
import state from './state';
import React from 'react';
import autoBind from 'react-autobind';
//import ReactMarkdown from 'react-markdown';
import ReactTooltip from 'react-tooltip';
import onClickOutside from 'react-onclickoutside';
import openExternal from 'open-external';
import _ from 'lodash';

import * as utils from './utils';

const {dialog} = remote;

export class SaveEditorDropdownMenu extends React.Component {
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

export class DropdownMenu extends React.Component {
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
    window.jsonWorker.postMessage({
      method: 'remove',
      key: 'remoteLocations'
    });

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

export class BasicDropdown extends React.Component {
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
        {p.showValue ? <div className="text">{state.galaxies[p.selectedGalaxy]}</div> : null}
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