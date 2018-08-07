import {remote} from 'electron';
import state from './state';
import React from 'react';
import ReactTooltip from 'react-tooltip';
import onClickOutside from 'react-onclickoutside';
import openExternal from 'open-external';
import {assignIn, clone, defer} from 'lodash';

import * as utils from './utils';
import {handleRestart} from './dialog';
import {findIndex, map} from './lang';

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
      this.props.storedBases.splice(refBase, 1);
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
  handleSupport = () => {
    openExternal('https://neuropuff.com/static/donate.html');
  }
  handleBugReport = () => {
    openExternal('https://github.com/jaszhix/NoMansConnect/issues');
  }
  handleLog = () => state.set({displayLog: true})
  handleToggleOpen = () => {
    ReactTooltip.hide();
    this.setState({open: !this.state.open});
  }
  handleSettings = () => state.set({displaySettings: true})
  render() {
    var p = this.props;
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
          <div
          className="item"
          onClick={this.handleSettings}
          data-place="left"
          data-tip={utils.tip('Configure NMC.')}>
            Settings
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
          data-tip={utils.tip('Help pay for server time. Total contributions since initial release: $255. Thanks a lot!')}>
            Support NMC
          </div>
          <div
          className="item"
          onClick={this.handleBugReport}
          data-place="left"
          data-tip={utils.tip('Bug reports are an important part of this app\'s development.')}>
            Report Bug
          </div>
          <div
          className="item"
          onClick={this.handleLog}
          data-place="left"
          data-tip={utils.tip('View the NMC log.')}>
            Open Log
          </div>
          <div className="divider" />
          <div
          className="item"
          onClick={handleRestart}
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
    isGalaxies: true,
    height: 0
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
    let persist = this.props.persist || option.id === 'teleport';
    if (persist) {
      e.stopPropagation();
    }
    if (typeof option.id === 'number') {
      state.set({selectedGalaxy: option.id});
    } else if (typeof option.onClick === 'function') {
      option.onClick(option.id);
    }
    this.setState({open: persist});
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
      className={`ui dropdown BasicDropdown__root${this.state.open ? ' active visible' : ''}`}
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
          maxHeight: `${this.props.height ? this.props.height : (height / 2)}px`,
          minWidth: `${this.props.width || '132.469'}px`,
          overflowY: 'auto'
        }}
        className={`menu transition ${this.state.open ? 'visible' : 'hidden'}`}>
          {this.props.options.length > 0 ? map(this.props.options, (option, i)=>{
            let tooltip = '';
            if (option.tooltip) {
              tooltip = option.tooltip
            }
            return (
              <div
              key={i}
              className={`item${option.disabled ? ' disabled' : ''}`}
              onClick={option.disabled ? null : (e) => this.handleOptionClick(e, option)}
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
  handleOptionClick = (option) => {
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
                    onClick={() => this.handleOptionClick(option)}>
                      {option.content}
                    </div>
                  </div>
                  <div className="ui two wide column right floated">
                    <div
                    style={notificationTrashIconContainerStyle}
                    onClick={() => this.handleDelete(option)}
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