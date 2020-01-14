import watch from 'watch';
import React from 'react';
import {find} from '@jaszhix/utils';

import state from './state';
import Loader from './loader';
import {tip} from './utils';
// @ts-ignore
import baseIcon from './assets/images/base_icon.png';

import {DropdownMenu, SaveEditorDropdownMenu, BaseDropdownMenu, NotificationDropdown} from './dropdowns';
import {StatsContainer} from './modals';
import {Search} from './search';

const headerItemClasses = 'ui dropdown icon item App__titleBarControls';

interface TitleBarProps {
  s: GlobalState;
  monitor: watch.Monitor | void;
}

interface TitleBarState {}

class TitleBar extends React.Component<TitleBarProps, TitleBarState> {
  handleMaximize = () => {
    let win = state.trigger('window');
    let {maximized} = this.props.s;

    if (maximized) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
  handleMinimize = () => {
    let win = state.trigger('window');
    win.minimize();
  }
  handleClose = () => {
    let win = state.trigger('window');
    let {monitor} = this.props;

    if (monitor && !module.hot) {
      monitor.stop();
    }
    state.set({closing: true});
    setTimeout(() => win.close(), 500);
  }
  handleCheat = (dataId, n) => {
    const {storedLocations, currentLocation} = this.props.s;

    let location = find(storedLocations, (location) => location.dataId === currentLocation);
    if (location) {
      state.trigger('teleport', location, 0, dataId, n);
    }
  }
  handleLocationRegistrationToggle = () => {
    state.set({registerLocation: !this.props.s.registerLocation});
  }
  render() {
    const {s} = this.props;

    return (
      <div
      className="ui top attached menu App__topAttachedMenu"
      onDoubleClick={this.handleMaximize}>
        <h2 className="App__title">{s.title}</h2>
        <div className="right menu">
          {!s.init && s.navLoad ? <Loader loading={null} /> : null}
          {!s.init ?
          <Search search={s.search} /> : null}
          {!s.offline ?
          <StatsContainer height={s.height} /> : null}
          {s.profile && s.profile.notifications && s.profile.notifications.length > 0 ?
          <NotificationDropdown
          machineId={s.machineId}
          username={s.username}
          options={s.profile.notifications}
          height={s.height} /> : null}
          {!s.ps4User ?
          <BaseDropdownMenu
          baseIcon={baseIcon}
          storedBases={s.storedBases} /> : null}
          {s.profile && !s.ps4User && s.displaySaveEditor ?
          <SaveEditorDropdownMenu
          profile={s.profile}
          onCheat={this.handleCheat} /> : null}
          <a
          className="ui icon item noDrag cursorDefault"
          onClick={this.handleLocationRegistrationToggle}
          data-place="bottom"
          data-tip={tip('Manually Register Location')}>
            <i className="location arrow icon" />
          </a>
          <DropdownMenu s={s} />
        </div>
        <div className={headerItemClasses}>
          <div className="titlebar-controls">
            <div className="titlebar-minimize" onClick={this.handleMinimize}>
              <svg x="0px" y="0px" viewBox="0 0 10 1">
                <rect fill="#FFFFFF" width="10" height="1" />
              </svg>
            </div>
            <div className="titlebar-resize" onClick={this.handleMaximize}>
              {!s.maximized ?
              <svg className="fullscreen-svg" x="0px" y="0px" viewBox="0 0 10 10">
                <path fill="#FFFFFF" d="M 0 0 L 0 10 L 10 10 L 10 0 L 0 0 z M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 z " />
              </svg>
              :
              <svg className="maximize-svg" x="0px" y="0px" viewBox="0 0 10 10">
                <mask id="Mask">
                  <path fill="#FFFFFF" d="M 3 1 L 9 1 L 9 7 L 8 7 L 8 2 L 3 2 L 3 1 z" />
                  <path fill="#FFFFFF" d="M 1 3 L 7 3 L 7 9 L 1 9 L 1 3 z" />
                </mask>
                <path fill="#FFFFFF" d="M 2 0 L 10 0 L 10 8 L 8 8 L 8 10 L 0 10 L 0 2 L 2 2 L 2 0 z" mask="url(#Mask)" />
              </svg>}
            </div>
            <div className="titlebar-close" onClick={this.handleClose}>
              <svg x="0px" y="0px" viewBox="0 0 10 10">
                <polygon fill="#FFFFFF" points="10,1 9,0 5,4 1,0 0,1 4,5 0,9 1,10 5,6 9,10 10,9 6,5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default TitleBar;
