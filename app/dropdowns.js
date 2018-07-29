import {remote} from 'electron';
import log from './log';
import state from './state';
import React from 'react';
import ReactTooltip from 'react-tooltip';
import onClickOutside from 'react-onclickoutside';
import openExternal from 'open-external';
import {assignIn, clone, defer, pullAt, upperFirst, last} from 'lodash';

import * as utils from './utils';
import {findIndex, map, tryFn} from './lang';

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
const trashIconContainerStyle = {
  position: 'relative',
  left: '92%',
  width: '179px',
  top: '-14px',
  cursor: 'pointer'
};
const notificationTrashIconContainerStyle = {
  position: 'relative',
  top: '14px',
  cursor: 'pointer'
};

export class BaseDropdownMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hover: -1,
      open: false
    };
    this.baseItemStyle = {
      height: '36px'
    };
    this.menuContainerStyle = assignIn(clone(menuContainerStyle), {
      width: '260px'
    });
  }
  componentDidMount() {
    defer(ReactTooltip.rebuild);
  }
  handleClickOutside = () => {
    if (this.state.open) {
      this.setState({open: false});
    }
  }
  handleSave = (e) => {
    e.stopPropagation();
    this.props.onSaveBase();
  }
  handleDelete = (e, base) => {
    e.stopPropagation();
    let refBase = findIndex(this.props.storedBases, _base => _base.Name === base.Name);
    if (refBase !== -1) {
      pullAt(this.props.storedBases, refBase);
      state.set({storedBases: this.props.storedBases});
    }
  }
  handleToggleOpen = () => {
    ReactTooltip.hide();
    this.setState({open: !this.state.open});
  }
  handleOnMouseEnter = (e) => {
    this.setState({hover: parseInt(e.target.id)});
  }
  handleOnMouseLeave = () => {
    this.setState({hover: -1});
  }
  render() {
    var p = this.props;
    return (
      <div
      style={noDragStyle}
      className={`ui dropdown icon item${this.state.open ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={utils.tip('Save/Restore Bases')}>
        <img
        style={{width: '19px'}}
        src={p.baseIcon} />
        <div
        style={this.menuContainerStyle}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          <div
          className="item"
          onClick={this.handleSave}
          data-place="left"
          data-tip={utils.tip('Saves all active bases found in the save file to NMC\'s storage.')}>
            Save Bases
          </div>
          {p.storedBases && p.storedBases.length > 0 ? <div className="divider" /> : null}
          {p.storedBases && p.storedBases.length > 0 ? map(p.storedBases, (base, i)=>{
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
                onClick={() => this.props.onRestoreBase(base)}
                data-place="left"
                data-tip={utils.tip('Import this base over a currently existing base from the save. Choose the base to import, and then you will be prompted to choose which base to write over.')}>
                  {baseName}
                </div>
                <div
                style={trashIconContainerStyle}
                onClick={(e) => this.handleDelete(e, base)}
                data-place="bottom"
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
    this.state = {
      open: false
    };
  }
  componentDidMount() {
    defer(ReactTooltip.rebuild);
  }
  handleClickOutside = () => {
    if (this.state.open) {
      this.setState({open: false});
    }
  }
  handleClick = (e) => {
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
  handleToggleOpen = () => {
    ReactTooltip.hide();
    this.setState({open: !this.state.open});
  }
  render() {
    var p = this.props;
    return (
      <div
      style={noDragStyle}
      className={`ui dropdown icon item${this.state.open ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={utils.tip('Save Editor')}>
        <i className="database icon" />
        <div
        style={menuContainerStyle}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
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
    this.state = {
      open: false
    }
  }
  handleClickOutside = () => {
    if (this.state.open) {
      this.setState({open: false});
    }
  }
  handleAbout = () => {
    dialog.showMessageBox({
      type: 'info',
      buttons: [],
      title: 'No Man\'s Connect',
      message: this.props.s.version,
      detail: `
Please back up your save files.

Special Thanks

- rysulliv
- ViktorKrugar
- Artimec_w
- Bbsoto
- Matthew Humphrey
- temp-999
- ukmerlin
- afWings/AGT
- Cranky-Cat
- monkeyman192
- pgrace
- rayrod118

No Man's Connect - Online Location Manager
Copyright (C) 2017 Jason Hicks and Contributors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.
      `
    });
  }
  handleSync = () => {
    this.props.onSync();
  }
  handleWallpaper = () => {
    this.props.onSetWallpaper()
  }
  handleAutoCapture = (e) => {
    e.stopPropagation();
    state.set({autoCapture: !this.props.s.autoCapture});
  }
  handleResetRemoteCache = () => {
    window.jsonWorker.postMessage({
      method: 'remove',
      key: 'remoteLocations'
    });

    this.props.onRestart();
  }
  handleUsernameProtection = () => {
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
  handleSetEmail = () => {
    state.set({setEmail: true});
  }
  handlePlatformToggle = () => {
    state.set({ps4User: !this.props.s.ps4User}, this.props.onRestart);
  }
  handleModeSwitch = (mode) => {
    state.set({mode: mode});
  }
  handlePollRate = (e) => {
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
  handleSupport = () => {
    openExternal('https://neuropuff.com/static/donate.html');
  }
  handleBugReport = () => {
    openExternal('https://github.com/jaszhix/NoMansConnect/issues');
  }
  handleToggleOpen = () => {
    ReactTooltip.hide();
    this.setState({open: !this.state.open});
  }
  handleOfflineModeToggle = (e) => {
    e.stopPropagation();
    state.set({
      title: `${state.updateAvailable ? 'OLD' : 'NO'} MAN'S ${!this.props.s.offline ? 'DIS' : ''}CONNECT`,
      offline: !this.props.s.offline
    });
  }
  render() {
    var p = this.props;
    let modes = ['permadeath', 'survival', 'normal', 'creative'];
    return (
      <div
      style={noDragStyle}
      className={`ui dropdown icon item${this.state.open ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={utils.tip('Options')}>
        <i className="wrench icon" />
        {p.s.username.length > 0 ? <span style={{paddingLeft: '12px'}}>{p.s.username}</span> : null}
        <div
        style={menuContainerStyle}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          {!p.s.ps4User ? map(modes, (mode, i)=>{
            return (
              <div
              key={i}
              className={`item${p.s.mode === mode ? ' selected' : ''}`}
              onClick={() => this.handleModeSwitch(mode)}
              data-place="left"
              data-tip={utils.tip('Controls which save file is loaded and saved.')}>
                {upperFirst(mode)}
              </div>
            );
          }) : null}
          {!p.s.ps4User ? <div className="divider" /> : null}
          {!p.s.ps4User && !p.s.offline ?
          <div
          className="item"
          onClick={this.handleAutoCapture}
          data-place="left"
          data-tip={utils.tip('Automatically grabs your screen when NMS is running and the game is saved. Only works when NMS is in window mode.')}>
            Screenshots: {p.s.autoCapture ? 'Auto' : 'Manual'}
          </div> : null}
          {!p.s.ps4User ? <div className="divider" /> : null}
          <div
          className="item"
          onClick={this.handlePlatformToggle}
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
          {!p.s.offline ?
          <div
          className="item"
          onClick={this.handleSync}
          data-place="left"
          data-tip={utils.tip('Downloads stored locations belonging to you, that are available on the server, and uploads locations missing on the server.')}>
            Sync Locations
          </div> : null}
          <div
          className="item"
          onClick={this.handleResetRemoteCache}
          data-place="left"
          data-tip={utils.tip('This clears the remote locations list that is stored locally in Roaming/NoMansConnect.')}>
            Reset Remote Cache
          </div>
          {!p.s.offline ?
          <div
          className="item"
          onClick={this.handlePollRate}
          data-place="left"
          data-tip={utils.tip('Controls how often the client will check the server for new locations. If you experience performance issues, consider increasing this value.')}>
            {`Polling Rate: ${p.s.pollRate / 1000} Seconds`}
          </div> : null}
          {p.s.profile ?
          <div
          className={`item${!p.s.profile.email ? ' item-disabled' : ''}`}
          onClick={p.s.profile.email ? this.handleUsernameProtection : null}
          data-place="left"
          data-tip={
            p.s.profile.email ?
            utils.tip('Highly recommended! Anyone can claim your username and impersonate you if this is not enabled. This associates your username with your Windows installation\'s cryptographic signature, so be sure to disable this when switching computers, upgrading hardware, or reinstalling Windows.')
            :
            utils.tip('Please associate an email address with your profile in order to use username protection.')}>
            {`Username Protection: ${p.s.profile.protected ? 'On' : 'Off'}`}
          </div> : null}
          {p.s.profile ?
          <div
          className="item"
          onClick={this.handleSetEmail}
          data-place="left"
          data-tip={utils.tip(`Incase you get locked out of your profile, setting a recovery email can assist in unprotecting your username, when enabled. ${p.s.profile.email ? ' Current recovery email: ' + p.s.profile.email : ''}`)}>
            Set Recovery Email
          </div> : null}
          {!p.s.offline ?
          <div
          className="item"
          onClick={this.props.onUsernameOverride}
          data-place="left"
          data-tip={utils.tip('Changes your username. This will update all of your locations. You must disable username protection before setting this.')}>
            Override Username
          </div> : null}
          <div
          className="item"
          onClick={this.handleWallpaper}
          data-place="left"
          data-tip={utils.tip('Changes the NMC background.')}>
            {p.s.wallpaper ? 'Reset Wallpaper' : 'Set Wallpaper'}
          </div>
          <div
          className="item"
          onClick={this.handleOfflineModeToggle}
          data-place="left"
          data-tip={utils.tip(`Prevents NMC from making network requests to the server, and attempts to keep most features in a functional state.`)}>
            {`Offline Mode: ${p.s.offline ? 'On' : 'Off'}`}
          </div>
          <div className="divider" />
          <div
          className="item"
          onClick={this.handleAbout}
          data-place="left"
          data-tip={utils.tip('NMC info.')}>
            About
          </div>
          <div
          className="item"
          onClick={this.handleSupport}
          data-place="left"
          data-tip={utils.tip('Help pay for server time. Total contributions since initial release: $135. Thanks a lot!')}>
            Support NMC
          </div>
          <div
          className="item"
          onClick={this.handleBugReport}
          data-place="left"
          data-tip={utils.tip('Bug reports are an important part of this app\'s development.')}>
            Report Bug
          </div>
          <div className="divider" />
          <div
          className="item"
          onClick={p.onRestart}
          data-place="left"
          data-tip={utils.tip('Restarts the NMC process.')}>
            Restart
          </div>
          <div
          className="item"
          onClick={window.close}
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
  static defaultProps = {
    options: [],
    selectedGalaxy: 0,
    icon: 'dropdown',
    showValue: true,
    persist: false,
    isGalaxies: true
  };
  constructor(props) {
    super(props);
    this.state = {
      open: false
    };
  }
  componentDidMount() {
    defer(ReactTooltip.rebuild);
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
  }
  handleOptionClick = (e, option) => {
    if (this.props.persist) {
      e.stopPropagation();
    }
    if (typeof option.id === 'number') {
      state.set({selectedGalaxy: option.id});
    } else {
      option.onClick(option.id);
    }
    this.setState({open: this.props.persist});
  }
  handleClickOutside = () => {
    if (this.state.open && !this.willUnmount) {
      this.setState({open: false});
    }
  }
  handleToggleOpen = () => {
    this.setState({open: !this.state.open});
  }
  render() {
    let height = this.props.height ? this.props.height : window.innerHeight;
    return (
      <div
      style={basicMenuContainerStyle}
      className={`ui dropdown${this.state.open ? ' active visible' : ''}`}
      onClick={this.handleToggleOpen}>
        {this.props.showValue && this.props.options.length > 0 ?
        <div className="text">
          {this.props.isGalaxies ? state.galaxies[this.props.selectedGalaxy] : this.props.options[this.props.selectedGalaxy].label}
        </div> : null}
        <i className={`${this.props.icon} icon`} />
        <div
        style={{
          display: this.state.open ? 'block !important' : 'none',
          borderRadius: '0px',
          background: 'rgb(23, 26, 22)',
          maxHeight: `${height / 2}px`,
          minWidth: `${this.props.width || '132.469'}px`,
          overflowY: 'auto'
        }}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          {this.props.options.length > 0 ? map(this.props.options, (option, i)=>{
            let tooltip = '';
            if (option.id === 'teleport') {
              tooltip = `<strong>Current save file: ${tryFn(() => last(state.saveFileName.split(utils.dirSep)))}</strong><br /> Ensure the game is paused before teleporting, and afterwards, select "Reload current" from the game\'s options menu.`;
            }
            return (
              <div
              key={i}
              className={`item${option.disabled ? ' disabled' : ''}`}
              onClick={(e) => this.handleOptionClick(e, option)}
              data-place="left"
              data-tip={utils.tip(tooltip)}>
                {option.label}
                {option.hasOwnProperty('toggle') ?
                <span className="BasicDropdown__alignRight"><i className={`${option.toggle ? 'checkmark' : 'remove'} icon`} /></span>
                : null}
              </div>
            );
          }) : null}
        </div>
      </div>
    );
  }
};

BasicDropdown = onClickOutside(BasicDropdown);

export class NotificationDropdown extends React.Component {
  static defaultProps = {
    options: [],
    selectedGalaxy: 0,
    icon: 'dropdown',
    showValue: true,
    persist: false
  };
  constructor(props) {
    super(props);
    this.state = {
      open: false
    };
  }
  componentDidMount() {
    defer(ReactTooltip.rebuild);
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
  }
  handleOptionClick = (e, option) => {
    state.set({displayFriendRequest: option});
  }
  handleClickOutside = () => {
    if (this.state.open && !this.willUnmount) {
      this.setState({open: false});
    }
  }
  handleToggleOpen = () => {
    this.setState({open: !this.state.open});
  }
  handleDelete = (option) => {
    utils.ajax.delete(`/nmsnotification/${option.id}/`, {
      machineId: this.props.machineId,
      username: this.props.username
    }).then(() => {
      state.trigger('pollSaveData');
    }).catch((err) => {
      console.log(err);
    });
  }
  render() {
    let height = this.props.height ? this.props.height : window.innerHeight;
    return (
      <div
      style={noDragStyle}
      className={`ui dropdown icon item${this.state.open ? ' active visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-tip={!this.state.open ? utils.tip(`${this.props.options.length} new message${this.props.options.length > 1 ? 's' : ''}`) : ''}>
        <i className="envelope icon" />
        <div
        style={{
          display: this.state.open ? 'block !important' : 'none',
          borderRadius: '0px',
          background: 'rgb(23, 26, 22)',
          maxHeight: `${height / 2}px`,
          width: '400px',
          overflowY: 'none',
          overflowX: 'none'
        }}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          {this.props.options.length > 0 ? map(this.props.options, (option, i)=>{
            return (
              <div
              key={option.id}
              className="item"
              onMouseEnter={() => this.setState({hover: i})}
              onMouseLeave={() => this.setState({hover: -1})}>
                <div className="ui four column grid">
                  <div className="ui six wide column left floated">
                    <div
                    key={i}
                    className="item"
                    onClick={(e) => this.handleOptionClick(e, option)}>
                      {option.content}
                    </div>
                  </div>
                  <div className="ui two wide column right floated">
                    <div
                    style={notificationTrashIconContainerStyle}
                    onClick={(e) => this.handleDelete(e, option)}
                    data-place="bottom"
                    data-tip={utils.tip('Remove Notification')}>
                      {this.state.hover === i ? <i className="trash outline icon" /> : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : null}
        </div>
      </div>
    );
  }
};

NotificationDropdown = onClickOutside(NotificationDropdown);