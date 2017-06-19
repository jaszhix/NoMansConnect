import {remote} from 'electron';
import Log from './log';
const log = new Log();
import state from './state';
import React from 'react';
import autoBind from 'react-autobind';
import ReactTooltip from 'react-tooltip';
import onClickOutside from 'react-onclickoutside';
import openExternal from 'open-external';
import _ from 'lodash';

import * as utils from './utils';

const {dialog} = remote;

const menuContainerStyle = {
  minWidth: '183px',
  borderBottomLeftRadius: '0px',
  borderBottomRightRadius: '0px',
  borderTop: '1px solid rgb(149, 34, 14)'
};
const noDragStyle = {
  WebkitAppRegion: 'no-drag'
};
const basicMenuContainerStyle = {
  fontFamily: 'geosanslight-nmsregular',
  fontSize: '16px'
};

export class BaseDropdownMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hover: -1
    };
    autoBind(this);
    this.trashIconContainerStyle = {
      position: 'relative',
      left: '92%',
      width: '179px',
      top: '-14px',
      cursor: 'pointer'
    };
    this.baseItemStyle = {
      height: '36px'
    };
    this.menuContainerStyle = _.assignIn(_.clone(menuContainerStyle), {
      width: '260px'
    });
  }
  componentDidMount(){
    _.defer(ReactTooltip.rebuild);
  }
  handleClickOutside(){
    if (this.props.baseOpen) {
      state.set({baseOpen: false});
    }
  }
  handleSave(e){
    e.stopPropagation();
    this.props.onSaveBase();
  }
  handleDelete(e, base){
    e.stopPropagation();
    let refBase = _.findIndex(this.props.storedBases, {Name: base.Name});
    if (refBase !== -1) {
      _.pullAt(this.props.storedBases, refBase);
      state.set({storedBases: this.props.storedBases});
    }
  }
  handleToggleOpen(){
    ReactTooltip.hide();
    state.set({
      baseOpen: !this.props.baseOpen,
      editorOpen: false,
      settingsOpen: false
    })
  }
  handleOnMouseEnter(e){
    this.setState({hover: parseInt(e.target.id)});
  }
  handleOnMouseLeave(){
    this.setState({hover: -1});
  }
  render(){
    var p = this.props;
    return (
      <div
      style={noDragStyle}
      className={`ui dropdown icon item${p.baseOpen ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={utils.tip('Save/Restore Bases')}>
        <img
        style={{width: '19px'}}
        src={p.baseIcon} />
        <div
        style={this.menuContainerStyle}
        className={`menu transition ${p.baseOpen ? 'visible' : 'hidden'}`}>
          <div
          className="item"
          onClick={this.handleSave}
          data-place="left"
          data-tip={utils.tip('Saves the base claimed in the currently loaded save file.')}>
            Save Base
          </div>
          {p.storedBases && p.storedBases.length > 0 ? <div className="divider" /> : null}
          {p.storedBases && p.storedBases.length > 0 ? _.map(p.storedBases, (base, i)=>{
            let baseName = base.Name;
            if (baseName.indexOf(' Base') !== -1) {
              baseName = baseName.split(' Base')[0];
            }
            return (
              <div
              key={i}
              id={i}
              style={this.baseItemStyle}
              className="item"
              onMouseEnter={this.handleOnMouseEnter}
              onMouseLeave={this.handleOnMouseLeave}>
                <div
                onClick={()=>this.props.onRestoreBase(base)}
                data-place="left"
                data-tip={utils.tip('Restores the base over the claimed base in the currently loaded save file. In order for this to work, you must ensure at least one base item is placed on your existing base, as this is how the saved base\'s vertices are converted for the new location\'s geometry.')}>
                  {baseName}
                </div>
                <div
                style={this.trashIconContainerStyle}
                onClick={(e)=>this.handleDelete(e, base)}
                data-place="right"
                data-tip={utils.tip('Remove Base')}>
                  {this.state.hover === i ? <i className="trash outline icon" /> : null}
                </div>
              </div>
            );
          }) : null}
        </div>
      </div>
    );
  }
};

BaseDropdownMenu = onClickOutside(BaseDropdownMenu);

export class SaveEditorDropdownMenu extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  componentDidMount(){
    _.defer(ReactTooltip.rebuild);
  }
  handleClickOutside(){
    if (this.props.editorOpen) {
      state.set({editorOpen: false});
    }
  }
  handleClick(e){
    let id = e.target.id;
    let requirement;
    if (e.target.id.indexOf('|') !== -1) {
      let split = e.target.id.split('|');
      id = split[0];
      requirement = parseInt(split[1]);
    }
    let isUnits = id === 'modifyUnits';
    if (isUnits || this.props.profile.exp >= requirement || process.env.NODE_ENV === 'development') {
      let args = [id];
      if (isUnits) {
        args.push(this.props.profile.exp * 1000);
      }
      this.props.onCheat(...args);
    }
  }
  handleToggleOpen(){
    ReactTooltip.hide();
    state.set({
      editorOpen: !this.props.editorOpen,
      baseOpen: false,
      settingsOpen: false
    });
  }
  render(){
    var p = this.props;
    return (
      <div
      style={noDragStyle}
      className={`ui dropdown icon item${p.editorOpen ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={utils.tip('Save Editor')}>
        <i className="database icon" />
        <div
        style={menuContainerStyle}
        className={`menu transition ${p.editorOpen ? 'visible' : 'hidden'}`}>
          <div
          id="repairInventory|50"
          style={{opacity: p.profile.exp >= 50 ? '1' : '0.5'}}
          className="item"
          onClick={this.handleClick}
          data-place="left"
          data-tip={utils.tip('Requires 50 registered locations.')}>
            Repair Inventory
          </div>
          <div
          id="stockInventory|100"
          style={{opacity: p.profile.exp >= 100 ? '1' : '0.5'}}
          className="item"
          onClick={this.handleClick}
          data-place="left"
          data-tip={utils.tip('Requires 100 registered locations.')}>
            Fully Stock Inventory
          </div>
          <div
          id="refuelEnergy|200"
          style={{opacity: p.profile.exp >= 200 ? '1' : '0.5'}}
          className="item"
          onClick={this.handleClick}
          data-place="left"
          data-tip={utils.tip('Requires 200 registered locations.')}>
            Refuel Energies/Shields
          </div>
          <div
          id="modifyUnits"
          className="item"
          onClick={this.handleClick}
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
      Please back up your save files.

      Special Thanks

      - Cranky-Cat
      - monkeyman192
      - pgrace
      - rayrod118

      Software written by Jason Hicks (jaszhix).
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

    this.props.onRestart();
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
          this.props.s.profile.protected = !this.props.s.profile.protected;
          state.set({profile: this.props.s.profile});
        }).catch((err)=>{
          log.error(`Error enabling username protection: ${err}`);
        });
      } else {
        return;
      }
    });
  }
  handlePlatformToggle(){
    state.set({ps4User: !this.props.s.ps4User}, this.props.onRestart);
  }
  handleModeSwitch(mode){
    state.set({mode: mode}, this.props.onRestart);
  }
  handlePollRate(e){
    e.stopPropagation();
    let rate;
    if (this.props.s.pollRate === 45000) {
      rate = 60000;
    } else if (this.props.s.pollRate === 60000) {
      rate = 90000;
    } else {
      rate = 45000;
    }
    state.set({pollRate: rate});
  }
  handleSupport(){
    openExternal('https://neuropuff.com/static/donate.html');
  }
  handleToggleOpen(){
    ReactTooltip.hide();
    state.set({
      settingsOpen: !this.props.s.settingsOpen,
      baseOpen: false,
      editorOpen: false
    });
  }
  render(){
    var p = this.props;
    let modes = ['permadeath', 'survival', 'normal', 'creative'];
    return (
      <div
      style={noDragStyle}
      className={`ui dropdown icon item${p.s.settingsOpen ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={utils.tip('Options')}>
        <i className="wrench icon" />
        {p.s.username.length > 0 ? <span style={{paddingLeft: '12px'}}>{p.s.username}</span> : null}
        <div
        style={menuContainerStyle}
        className={`menu transition ${p.s.settingsOpen ? 'visible' : 'hidden'}`}>
          {!p.s.ps4User ? _.map(modes, (mode, i)=>{
            return (
              <div
              key={i}
              className={`item${p.s.mode === mode ? ' selected' : ''}`}
              onClick={()=>this.handleModeSwitch(mode)}
              data-place="left"
              data-tip={utils.tip('Controls which save file is loaded and saved.')}>
                {_.upperFirst(mode)}
              </div>
            );
          }) : null}
          {!p.s.ps4User ? <div className="divider"></div> : null}
          {!p.s.ps4User ?
          <div className="item" onClick={this.handleAutoCapture}
          data-place="left"
          data-tip={utils.tip('Automatically grabs your screen when NMS is running and the game is saved. Only works when NMS is in window mode.')}>
            Screenshots: {p.s.autoCapture ? 'Auto' : 'Manual'}
          </div> : null}
          {!p.s.ps4User ? <div className="divider"></div> : null}
          <div className="item" onClick={this.handlePlatformToggle}
          data-place="left"
          data-tip={utils.tip('Select which platform you play NMS.')}>
            {`Platform: ${p.s.ps4User ? 'PS4' : 'PC'}`}
          </div>
          {!p.s.ps4User ?
          <div
          className="item"
          onClick={this.props.onSelectInstallDirectory}
          data-place="left"
          data-tip={utils.tip('Optional. Select the location NMS is installed in. This is used to associate your mods with a location, so other players can see a location which may not load properly for them.')}>
            Select NMS Install Directory
          </div> : null}
          {!p.s.ps4User ?
          <div
          className="item"
          onClick={this.props.onSelectSaveDirectory}
          data-place="left"
          data-tip={utils.tip('Required. Select the location the save files are in.')}>
            Select NMS Save Directory
          </div> : null}
          <div
          className="item"
          onClick={this.handleSync}
          data-place="left"
          data-tip={utils.tip('Downloads stored locations belonging to you, that are available on the server, and uploads locations missing on the server.')}>
            Sync Locations
          </div>
          <div
          className="item"
          onClick={this.handleResetRemoteCache}
          data-place="left"
          data-tip={utils.tip('This clears the remote locations list that is stored locally in Roaming/NoMansConnect.')}>
            Reset Remote Cache
          </div>
          <div
          className="item"
          onClick={this.handlePollRate}
          data-place="left"
          data-tip={utils.tip('Controls how often the client will check the server for new locations. If you experience performance issues, consider increasing this value.')}>
            {`Polling Rate: ${p.s.pollRate / 1000} Seconds`}
          </div>
          {p.s.profile ?
          <div className="item" onClick={this.handleUsernameProtection}
          data-place="left"
          data-tip={utils.tip('Highly recommended! Anyone can claim your username and impersonate you if this is not enabled. This associates your username with your Windows installation\'s cryptographic signature, so be sure to disable this when switching computers, upgrading hardware, or reinstalling Windows.')}>
            {`Username Protection: ${p.s.profile.protected ? 'On' : 'Off'}`}
          </div> : null}
          <div
          className="item"
          onClick={this.props.onUsernameOverride}
          data-place="left"
          data-tip={utils.tip('Changes your username. This will update all of your locations. You must disable username protection before setting this.')}>
            Override Username
          </div>
          <div className="item" onClick={this.handleWallpaper}
          data-place="left"
          data-tip={utils.tip('Changes the NMC background.')}>
            {p.s.wallpaper ? 'Reset Wallpaper' : 'Set Wallpaper'}
          </div>
          <div className="divider"></div>
          <div className="item" onClick={this.handleAbout}
          data-place="left"
          data-tip={utils.tip('NMC info.')}>
            About
          </div>
          <div className="item" onClick={this.handleSupport}
          data-place="left"
          data-tip={utils.tip('Help pay for server time. Total contributions as of this release: $80. Thanks a lot!')}>
            Support NMC
          </div>
          <div className="divider"></div>
          <div className="item"
          onClick={p.onRestart}
          data-place="left"
          data-tip={utils.tip('Restarts the NMC process.')}>
            Restart
          </div>
          <div className="item" onClick={window.close}
          data-place="left"
          data-tip={utils.tip('Exit NMC.')}>
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
  componentDidMount(){
    _.defer(ReactTooltip.rebuild);
  }
  componentWillUnmount(){
    this.willUnmount = true;
  }
  handleOptionClick(e, option){
    if (this.props.persist) {
      e.stopPropagation();
    }
    option.onClick(option.id);
    this.setState({open: this.props.persist});
  }
  handleClickOutside(){
    if (this.state.open && !this.willUnmount) {
      this.setState({open: false});
    }
  }
  handleToggleOpen(){
    this.setState({open: !this.state.open});
  }
  render(){
    let height = this.props.height ? this.props.height : window.innerHeight;
    return (
      <div
      style={basicMenuContainerStyle}
      className={`ui dropdown${this.state.open ? ' active visible' : ''}`}
      onClick={this.handleToggleOpen}>
        {this.props.showValue ? <div className="text">{state.galaxies[this.props.selectedGalaxy]}</div> : null}
        <i className={`${this.props.icon} icon`} />
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
            let tooltip = '';
            if (option.id === 'teleport') {
              tooltip = 'Ensure the game is paused before teleporting, and afterwards, select "Reload current" from the game\'s options menu.'
            }
            return (
              <div
              key={i}
              className="item"
              onClick={(e)=>this.handleOptionClick(e, option)}
              data-place="left"
              data-tip={utils.tip(tooltip)}>
                {option.label}
              </div>
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