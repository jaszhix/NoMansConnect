import {remote} from 'electron';
import React from 'react';
import ReactTooltip from 'react-tooltip';
import onClickOutside from 'react-onclickoutside';
import openExternal from 'open-external';
import moment from 'moment';
import {findIndex, map} from '@jaszhix/utils';

import state from './state';
import log from './log';

import {tip, ajaxWorker, cleanUp} from './utils';
import {handleRestart} from './dialog';

const {dialog} = remote;

interface BasicDropdownProps {
  className?: string;
  options?: any[];
  selectedGalaxy?: number;
  icon?: string;
  showValue?: boolean;
  persist?: boolean;
  isGalaxies?: boolean;
  height?: number;
  maxHeight?: number;
  width?: number;
  detailsOnly?: boolean;
  value?: any;
  tipPlacement?: string;
  onOptionClick?: (id: string) => void;
}

interface BasicDropdownState {
  open?: boolean;
  maxHeight?: number;
}

interface BaseDropdownMenuProps {
  storedBases: any[]; // TODO: create base interface
  baseIcon: string;
}

interface BaseDropdownMenuState extends BasicDropdownState {
  hover?: number;
}

export class BaseDropdownMenu extends React.Component<BaseDropdownMenuProps, BaseDropdownMenuState> {
  constructor(props) {
    super(props);

    this.state = {
      hover: -1,
      open: false,
    };
  }
  componentDidMount() {
    ReactTooltip.rebuild();
  }
  handleClickOutside = () => {
    if (this.state.open) {
      this.setState({open: false});
    }
  }
  handleSave = (e) => {
    e.stopPropagation();

    state.trigger('saveBase', null);
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
    let p = this.props;
    return (
      <div
      className={`ui dropdown icon item noDrag cursorDefault${this.state.open ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={tip('Save/Restore Bases')}>
        <img
        style={{width: '19px'}}
        src={p.baseIcon} />
        <div className={`menu transition dropdown__menuContainer dropdown__baseMenuContainer ${this.state.open ? 'visible' : 'hidden'}`}>
          <div
          className="item"
          onClick={this.handleSave}
          data-place="left"
          data-tip={tip('Saves all active bases found in the save file to NMC\'s storage.')}>
            {state.navLoad ? 'Working...' : 'Save Bases'}
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
              className="item dropdown__baseItem"
              onMouseEnter={this.handleOnMouseEnter}
              onMouseLeave={this.handleOnMouseLeave}>
                <div
                onClick={() => state.trigger('restoreBase', base)}
                data-place="left"
                data-tip={tip('Import this base over a currently existing base from the save. Choose the base to import, and then you will be prompted to choose which base to write over.')}>
                  {baseName}
                </div>
                <div
                className="dropdown__trashIconContainer"
                onClick={(e) => this.handleDelete(e, base)}
                data-place="bottom"
                data-tip={tip('Remove Base')}>
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
// @ts-ignore
BaseDropdownMenu = onClickOutside(BaseDropdownMenu);

interface SaveEditorDropdownMenuProps {
  profile: any;
  onCheat: Function;
}

export class SaveEditorDropdownMenu extends React.Component<SaveEditorDropdownMenuProps, BasicDropdownState> {
  constructor(props) {
    super(props);
    this.state = {
      open: false
    };
  }
  componentDidMount() {
    ReactTooltip.rebuild();
  }
  handleClickOutside = () => {
    if (this.state.open) {
      this.setState({open: false});
    }
  }
  handleClick = (e) => {
    if (Date.now() < this.props.profile.data.lastSaveEditorModification + 86400000) {
      return;
    }
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
      ajaxWorker.put(`/nmsprofile/${this.props.profile.id}/`, {
        username: state.username,
        machineId: state.machineId,
        data: {
          lastSaveEditorModification: Date.now()
        }
      }).then((res) => {
        state.set({profile: res.data}, () => this.props.onCheat(...args));
      }).catch((err) => log.error('SaveEditorDropdownMenu.handleClick: ', err));
    }
  }
  handleToggleOpen = () => {
    ReactTooltip.hide();
    this.setState({open: !this.state.open});
  }
  render() {
    let p = this.props;
    let {lastSaveEditorModification} = p.profile.data;
    if (!lastSaveEditorModification) {
      lastSaveEditorModification = 0;
    }
    let now = Date.now();
    let disabled = now < (lastSaveEditorModification + 86400000);
    let getTip = (n) => tip(
      `Requires ${n} registered locations. ${disabled ? `Cheat menu will be available again ${moment(now).to(lastSaveEditorModification + 86400000)}.` : 'Limited to one use per day.'}`
    );
    return (
      <div
      className={`ui dropdown icon item noDrag cursorDefault${this.state.open ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={tip('Save Editor')}>
        <i className="database icon" />
        <div className={`menu transition dropdown__menuContainer ${this.state.open ? 'visible' : 'hidden'}`}>
          <div
          id="repairInventory|50"
          style={{opacity: p.profile.exp >= 50 ? 1 : 0.5}}
          className={`item${disabled ? ' item-disabled' : ''}`}
          onClick={this.handleClick}
          data-place="left"
          data-tip={getTip(50)}>
            Repair Inventory
          </div>
          <div
          id="stockInventory|100"
          style={{opacity: p.profile.exp >= 100 ? 1 : 0.5}}
          className={`item${disabled ? ' item-disabled' : ''}`}
          onClick={this.handleClick}
          data-place="left"
          data-tip={getTip(100)}>
            Fully Stock Inventory
          </div>
          <div
          id="refuelEnergy|200"
          style={{opacity: p.profile.exp >= 200 ? 1 : 0.5}}
          className={`item${disabled ? ' item-disabled' : ''}`}
          onClick={this.handleClick}
          data-place="left"
          data-tip={getTip(200)}>
            Refuel Energies/Shields
          </div>
          <div
          id="modifyUnits"
          className={`item${disabled ? ' item-disabled' : ''}`}
          onClick={this.handleClick}
          data-place="left"
          data-tip={tip('Explore more to increase your units allowance.')}>
            {`Add ${p.profile.exp * 1000}k Units`}
          </div>
        </div>
      </div>
    );
  }
};
// @ts-ignore
SaveEditorDropdownMenu = onClickOutside(SaveEditorDropdownMenu);

interface DropdownMenuProps extends BasicDropdownState {
  s: GlobalState;
}

export class DropdownMenu extends React.Component<DropdownMenuProps, BaseDropdownMenuState>  {
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

- djehmli
- Grimolfr
- z1sidcr1
- Ulyssis
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
- Hello Games

No Man's Connect - Online Location Manager
Copyright (C) 2018 Jason Hicks and Contributors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.
      `
    });
  }
  handleReleaseNotes = () => {
    openExternal('https://github.com/jaszhix/NoMansConnect/blob/master/CHANGELOG.md');
  }
  handleSupport = () => {
    openExternal('https://www.patreon.com/jaszhix');
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
  handleProfileClick = () => state.set({displayProfile: this.props.s.profile.id})
  render() {
    let p = this.props;
    return (
      <div
      className={`ui dropdown icon item noDrag cursorDefault${this.state.open ? ' visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-place="bottom"
      data-tip={tip('Options')}>
        <i className="wrench icon" />
        {p.s.username.length > 0 ? <span style={{paddingLeft: '12px'}}>{p.s.username}</span> : null}
        <div className={`menu transition dropdown__menuContainer ${this.state.open ? 'visible' : 'hidden'}`}>
          {this.props.s.profile ?
          <React.Fragment>
            <div
            className="item"
            onClick={this.handleProfileClick}
            data-place="left"
            data-tip={tip('Access your profile.')}>
              Profile
            </div>
            <div className="divider" />
          </React.Fragment>
          : null}
          <div
          className="item"
          onClick={this.handleSettings}
          data-place="left"
          data-tip={tip('Configure NMC.')}>
            Settings
          </div>
          <div className="divider" />
          <div
          className="item"
          onClick={this.handleAbout}
          data-place="left"
          data-tip={tip('NMC info.')}>
            About
          </div>
          <div
          className="item"
          onClick={this.handleReleaseNotes}
          data-place="left"
          data-tip={tip('Information about NMC changes.')}>
            Release Notes
          </div>
          <div
          className="item"
          onClick={this.handleSupport}
          data-place="left"
          data-tip={tip('Help pay for server time. :)')}>
            Support NMC on Patreon
          </div>
          <div
          className="item"
          onClick={this.handleBugReport}
          data-place="left"
          data-tip={tip('Bug reports are an important part of this app\'s development.')}>
            Report Bug
          </div>
          <div
          className="item"
          onClick={this.handleLog}
          data-place="left"
          data-tip={tip('View the NMC log.')}>
            Open Log
          </div>
          <div className="divider" />
          <div
          className="item"
          onClick={handleRestart}
          data-place="left"
          data-tip={tip('Restarts the NMC process.')}>
            Restart
          </div>
          <div
          className="item"
          onClick={window.close}
          data-place="left"
          data-tip={tip('Exit NMC.')}>
            Quit
          </div>
        </div>
      </div>
    );
  }
};
// @ts-ignore
DropdownMenu = onClickOutside(DropdownMenu);

export class BasicDropdown extends React.Component<BasicDropdownProps, BasicDropdownState> {
  static defaultProps = {
    options: [],
    selectedGalaxy: 0,
    icon: 'dropdown',
    showValue: true,
    persist: false,
    isGalaxies: true,
    height: 0,
    tipPlacement: 'left',
  };

  connectId: number;
  ref: HTMLElement;
  willUnmount: boolean;

  constructor(props) {
    super(props);
    this.state = {
      open: false,
      maxHeight: 0,
    };
  }
  componentDidMount() {
    ReactTooltip.rebuild();
    this.connectId = state.connect({
      height: ({height}) => this.calculateHeight(this.ref, height)
    });
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
    if (this.connectId) state.disconnect(this.connectId);
    cleanUp(this);
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
    } else if (typeof this.props.onOptionClick === 'function') {
      this.props.onOptionClick(option.id);
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
  getRef = (ref) => {
    if (!ref) return;
    this.ref = ref;

    if (!this.props.maxHeight) this.calculateHeight(ref, this.props.height);

  }
  calculateHeight = (ref, height) => {
    if (!ref) return;
    let {y} = ref.getBoundingClientRect();
    if (y && !isNaN(y)) {
      let maxHeight = Math.floor(Math.abs(height - y - ref.clientHeight));
      this.setState({maxHeight});
    }
  }
  render() {
    const {detailsOnly, className, showValue, options, isGalaxies, selectedGalaxy, icon, value, width, tipPlacement} = this.props;
    const {maxHeight, open} = this.state;

    return (
      <div
      ref={this.getRef}
      className={`ui dropdown ${className ? className : 'BasicDropdown__root'}${open ? ' active visible' : ''}${detailsOnly ? ' BasicDropdown__profile' : ''}`}
      onClick={this.handleToggleOpen}>
        {showValue && options.length > 0 ?
        <div className="text">
          {isGalaxies ? state.galaxies[selectedGalaxy] : value ? value : options[selectedGalaxy].label}
        </div> : null}
        <i className={`${icon} icon`} />
        <div
        style={{
          display: open ? 'block !important' : 'none',
          borderRadius: '0px',
          background: 'rgb(23, 26, 22)',
          maxHeight: `${this.props.maxHeight ? this.props.maxHeight : maxHeight}px`,
          minWidth: `${width || '132.469'}px`,
          overflowY: 'auto'
        }}
        className={`menu transition ${open ? 'visible' : 'hidden'}`}>
          {options.length > 0 ? map(options, (option, i) => {
            if (option.hidden) return null;

            let tooltip = '';
            if (option.tooltip) {
              tooltip = option.tooltip
            }
            return (
              <div
              key={i}
              className={`item${option.disabled ? ' disabled' : ''}`}
              onClick={option.disabled ? null : (e) => this.handleOptionClick(e, option)}
              data-place={tipPlacement}
              data-tip={tip(tooltip)}>
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
// @ts-ignore
BasicDropdown = onClickOutside(BasicDropdown);

interface NotificationDropdownProps extends BasicDropdownProps {
  machineId: string;
  username: string;
}

export class NotificationDropdown extends React.Component<NotificationDropdownProps, BaseDropdownMenuState> {
  static defaultProps = {
    options: [],
    selectedGalaxy: 0,
    icon: 'dropdown',
    showValue: true,
    persist: false
  };
  willUnmount: boolean;

  constructor(props) {
    super(props);
    this.state = {
      hover: -1,
      open: false
    };
  }
  componentDidMount() {
    ReactTooltip.rebuild();
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
    cleanUp(this);
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
    ajaxWorker.delete(`/nmsnotification/${option.id}/`, {
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
      className={`ui dropdown icon item noDrag cursorDefault${this.state.open ? ' active visible' : ''}`}
      onClick={this.handleToggleOpen}
      data-tip={!this.state.open ? tip(`${this.props.options.length} new message${this.props.options.length > 1 ? 's' : ''}`) : ''}>
        <i className="envelope icon" />
        <div
        style={{
          display: this.state.open ? 'block !important' : 'none',
          borderRadius: '0px',
          background: 'rgb(23, 26, 22)',
          maxHeight: `${height / 2}px`,
          width: '400px',
          overflowY: 'hidden',
          overflowX: 'hidden'
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
                    className="NotificationDropdown__trashIconContainer"
                    onClick={() => this.handleDelete(option)}
                    data-place="bottom"
                    data-tip={tip('Remove Notification')}>
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
// @ts-ignore
NotificationDropdown = onClickOutside(NotificationDropdown);
