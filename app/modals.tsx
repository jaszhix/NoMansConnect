import {clipboard, remote} from 'electron';
import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import ReactTooltip from 'react-tooltip';
import onClickOutside from 'react-onclickoutside';
import ReactMarkdown from 'react-markdown';
import moment from 'moment';
import {assignIn, pick, isString, orderBy, upperFirst, clone, last} from 'lodash';
import {each, findIndex, find, map, filter} from '@jaszhix/utils';

import state from './state';
import log from './log';
import {syncDiscoveries} from './poll';
import {validateEmail, fromHex, cleanUp, uaToObject, formatTranslatedID, fsWorker, ajaxWorker, tip, numberWithCommas, whichToShow} from './utils';
import {handleUsernameOverride, handleSetWallpaper, handleSelectInstallDirectory, handleSelectSaveDirectory, handleRestart} from './dialog';
import {modes} from './constants';

import {BasicDropdown} from './dropdowns';
import Button from './buttons';
import LocationBox from './locationBox';
import Item from './item';

const {dialog} = remote;

interface ImageModalProps {
  image: string;
}

export class ImageModal extends React.Component<ImageModalProps> {
  constructor(props) {
    super(props);
  }
  handleClickOutside = () => {
    state.set({selectedImage: null});
  }
  componentWillUnmount = () => {
    cleanUp(this);
  }
  render() {
    return (
      <div className="ui fullscreen modal active modal__full ImageModal__root">
        <i
        className="window close outline icon modal__full__close"
        onClick={this.handleClickOutside} />
        <img className="image content" src={this.props.image} />
      </div>
    );
  }
};
// @ts-ignore
ImageModal = onClickOutside(ImageModal);

interface UsernameOverrideModalProps {
  ps4User: boolean;
}

interface UsernameOverrideModalState {
  name: string;
}

export class UsernameOverrideModal extends React.Component<UsernameOverrideModalProps, UsernameOverrideModalState> {
  constructor(props) {
    super(props);

    this.state = {
      name: ''
    };

    assignIn(this.state, pick(state.get(), ['ps4User']))
  }
  componentWillUnmount = () => {
    cleanUp(this);
  }
  handleClickOutside = () => {
    state.set({usernameOverride: false});
  }
  handleChange = (e) => {
    this.setState({name: e.target.value})
  }
  handleSave = () => {
    if (this.props.ps4User) {
      state.set({username: this.state.name}, handleRestart);
      return;
    }
    handleUsernameOverride(this.state.name)
  }
  handleEnter = (e) => {
    if (e.keyCode === 13) this.handleSave();
  }
  render() {
    return (
      <div className="ui small modal active modal__compact UsernameOverrideModal__container">
        <span className="close" />
        <div className="modal__InputContainer">
          <input
          className="modal__InputStyle"
          type="text"
          value={this.state.name}
          onChange={this.handleChange}
          onKeyDown={this.handleEnter}
          maxLength={30}
          placeholder="Username" />
          <Button onClick={this.handleSave}>
            Save
          </Button>
        </div>
      </div>
    );
  }
};
// @ts-ignore
UsernameOverrideModal = onClickOutside(UsernameOverrideModal);

interface RecoveryModalProps {
  s: GlobalState;
  type: string;
  placeholder: string;
}

interface RecoveryModalState {
  value: string;
  address: string;
  error: string;
}

export class RecoveryModal extends React.Component<RecoveryModalProps, RecoveryModalState> {
  constructor(props) {
    super(props);
    this.state = {
      value: '',
      address: '',
      error: ''
    };
  }
  componentWillUnmount() {
    cleanUp(this);
  }
  handleClickOutside = () => {
    let obj = {};
    obj[this.props.type] = false;
    state.set(obj);
  }
  handleChange = (e) => {
    this.setState({value: e.target.value})
  }
  handleSave = () => {
    let errorMessage, url, prop;

    if (this.props.type === 'setEmail') {
      errorMessage = 'There was an error associating your email address.';
      url = '/nmssetemail/';
      prop = 'email'
      console.log(this.state.value)
      if (!validateEmail(this.state.value)) {
        this.setState({
          address: '',
          error: 'Invalid email address.'
        });
        return;
      }
    } else {
      errorMessage = 'Invalid recovery token.';
      url = '/nmsvalidaterecovery/';
      prop = 'recovery_token';
    }

    let request = {
      machineId: this.props.s.machineId,
      username: this.props.s.username
    };
    request[prop] = this.state.value;
    ajaxWorker.post(url, request).then((res) => {
      if (this.props.type === 'recoveryToken') {
        handleRestart();
        return;
      }
      this.props.s.profile[prop] = this.state.value;
      state.set({profile: this.props.s.profile}, this.handleClickOutside);
    }).catch((err) => {
      console.log(err);
      this.setState({
        address: '',
        error: errorMessage
      });
    });
  }
  handleEnter = (e) => {
    if (e.keyCode === 13) this.handleSave();
  }
  render() {
    return (
      <div className="ui small modal active modal__compact">
        <span className="close" />
        {this.state.error ? <div className="modal__error">{this.state.error}</div> : null}
        <div className="modal__InputContainer">
          <input
          className="modal__InputStyle"
          type="text"
          value={this.state.value}
          onChange={this.handleChange}
          onKeyDown={this.handleEnter}
          placeholder={this.props.placeholder} />
          <Button onClick={this.handleSave}>
            Save
          </Button>
        </div>
      </div>
    );
  }
};
// @ts-ignore
RecoveryModal = onClickOutside(RecoveryModal);

interface LocationRegistrationModalProps {
  s: GlobalState;
};

interface LocationRegistrationModalState {
  address: string;
  galaxies: any[];
  galaxy: number;
  selectedGalaxy: number;
  preventClose: boolean;
  error: string;
}

export class LocationRegistrationModal extends React.Component<LocationRegistrationModalProps, LocationRegistrationModalState> {
  constructor(props) {
    super(props);

    this.state = {
      address: '',
      galaxies: [],
      galaxy: 0,
      selectedGalaxy: 0,
      preventClose: false,
      error: '',
    };
  }
  componentDidMount() {
    each(state.galaxies, (galaxy, i) => {
      this.state.galaxies.push({
        id: galaxy,
        label: galaxy,
        onClick: () => this.setState({
          galaxy: i as number,
          preventClose: false
        })
      });
    });
    this.setState({galaxies: this.state.galaxies});
  }
  componentWillUnmount() {
    cleanUp(this);
  }
  handleClickOutside = () => {
    state.set({registerLocation: false});
  }
  handleChange = (e) => {
    this.setState({address: e.target.value})
  }
  handleSave = () => {
    let location = fromHex(this.state.address, this.props.s.username, this.state.galaxy);
    if (!location) {
      this.setState({
        address: '',
        error: 'Invalid coordinate format.'
      });
      return;
    }
    let {storedLocations} = this.props.s;
    let refLocation = findIndex(storedLocations, (location) => {
      return location && location.translatedId === this.state.address && location.galaxy === this.state.galaxy;
    });

    if (refLocation > -1) {
      this.setState({
        address: '',
        error: 'This location has already been registered.'
      });
      return;
    }

    storedLocations.push(location);
    each(storedLocations, (storedLocation, i) => {
      if (!storedLocation || !storedLocation.created) return;
      if (isString(storedLocation.created)) {
        storedLocations[i].created = new Date(storedLocation.created).getTime()
      }
    });
    storedLocations = orderBy(storedLocations, 'created', 'desc');

    state.set({storedLocations}, () => {
      ajaxWorker.post('/nmslocation/', {
        machineId: this.props.s.machineId,
        username: location.username,
        ...location
      }).then((res) => {
        state.trigger('fetchRemoteLocations');
        state.trigger('markStoredLocationsDirty');
        this.handleClickOutside();
      }).catch((err) => {
        this.setState({
          address: '',
          error: 'There was an error registering this location.'
        });
      });
    });
  }
  handleEnter = (e) => {
    if (e.keyCode === 13) this.handleSave();
  }
  render() {
    return (
      <div className="ui small modal active modal__compact">
        <span className="close" />
        <div onClick={() => this.setState({preventClose: true})}>
          <BasicDropdown
          height={this.props.s.height}
          options={this.state.galaxies}
          selectedGalaxy={this.state.galaxy} />
        </div>
        {this.state.error ? <div className="modal__error">{this.state.error}</div> : null}
        <div className="LocationRegistrationModal__inputContainer">
          <input
          className="modal__InputStyle"
          type="text"
          value={this.state.address}
          onChange={this.handleChange}
          onKeyDown={this.handleEnter}
          maxLength={30}
          placeholder="Galactic Address" />
          <Button onClick={this.handleSave}>
            Save
          </Button>
        </div>
      </div>
    );
  }
};

interface NotificationProps {
  notification: NotificationInfo;
}

// @ts-ignore
LocationRegistrationModal = onClickOutside(LocationRegistrationModal);

export class Notification extends React.Component<NotificationProps> {
  componentWillUnmount() {
    cleanUp(this);
  }
  handleDismiss = () => {
    state.set({
      notification: {
        message: '',
        type: 'info'
      }
    });
  }
  handleClick() {
    const {onClick} = this.props.notification;

    if (typeof onClick === 'function') onClick();
  }
  render() {
    const {type, message, onClick} = this.props.notification;
    let renderedMessage = <ReactMarkdown className="md-p" source={message} />;
    return (
      <div
      className={`ui small modal active Notification__root${onClick ? ' cursorPointer' : ''}`}>
        <span className="close" />
        <div
        className={type === 'error' ? 'modal__error' : null}
        onClick={onClick}>
          {renderedMessage}
        </div>
        <div style={{width: '50px', position: 'absolute', right: '46px', bottom: '10px'}}>
          <Button onClick={this.handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }
};

const planetIcon = require('./assets/images/planet_discovery.png').default;
const organicIcon = require('./assets/images/organic_discovery.png').default;
const mineralIcon = require('./assets/images/mineral_discovery.png').default;
const interactableIcon = require('./assets/images/interactable_discovery.png').default;

const discoveryIconMap = {
  Animal: organicIcon,
  Flora: organicIcon,
  Mineral: mineralIcon,
  Planet: planetIcon,
  SolarSystem: planetIcon,
  Sector: planetIcon,
  Interactable: interactableIcon
};
const discoveryLevelMap = {
  Animal: 1,
  Flora: 1,
  Mineral: 1,
  Planet: 2,
  SolarSystem: 3,
  Sector: 4,
  Interactable: 1
};

interface EvenItemProps {
  profile: any;
  name: string;
  type: string;
  created: string | number;
  image: string;
  dataId: string;
  score: number;
  version: string;
  shouldShowPlanetType: boolean;
  isStart: boolean;
  isEnd: boolean;
  isLocation: boolean;
  location: any;
}

class EventItem extends React.Component<EvenItemProps> {
  static defaultProps = {
    shouldShowPlanetType: true,
  };

  componentDidMount() {
    ReactTooltip.rebuild();
  }

  componentWillUnmount() {
    cleanUp(this);
  }

  render() {
    let {profile, type, created, image, dataId, score, version, shouldShowPlanetType, isStart, isEnd, isLocation, location} = this.props;
    let isOwnLocation = profile ? profile.username === state.username : false;
    if (type === 'Planet' && !shouldShowPlanetType) {
      return null;
    }
    let groupClass = `label ProfileModal__eventGroupCommon ProfileModal__eventGroupIs${type !== 'Planet' ? 'Non' : ''}Planet`;
    groupClass += ` ProfileModal__eventGroupMid${isLocation ? 'Solid' : 'Dashed'}`;
    if (isStart) {
      groupClass += ` ProfileModal__eventGroupStart${isLocation ? 'Solid' : 'Dashed'}`;
    }
    if (isEnd) {
      groupClass += ` ProfileModal__eventGroupEnd${isLocation ? 'Solid' : 'Dashed'}`;
    }
    return (
      <div className="event">
        <div className={groupClass}>
          <img src={discoveryIconMap[type]} />
        </div>
        <div className="content">
          <div className="summary">
            {`${isLocation ? 'Registered' : 'Discovered'} ${type === 'SolarSystem' ? 'Solar System' : type}`}
            <div className="date">
              {moment(created).format('MMMM D, Y')}
            </div>
            <div className="meta ProfileModal__meta">
              {dataId ?
              <div
              className={`like${state.favorites.indexOf(dataId) > -1 ? ' active' : ''}`}
              onClick={() => state.trigger('handleFavorite', this.props)}>
                <i className="like icon" /> {`${score || ''}`}
              </div> : null}
            </div>
          </div>
          {dataId || (type === 'Planet' && location) ?
          <LocationBox
          username={profile ? profile.username : ''}
          selectType={false}
          currentLocation={state.currentLocation}
          isOwnLocation={isOwnLocation}
          isVisible={true}
          location={dataId ? this.props : location}
          updating={false}
          edit={false}
          favorites={state.favorites}
          image={image}
          version={version === state.saveVersion}
          width={800}
          height={800}
          isSelectedLocationRemovable={false}
          onUploadScreen={null}
          onDeleteScreen={null}
          onFav={null}
          onEdit={null}
          onMarkCompatible={null}
          onRemoveStoredLocation={null}
          onSubmit={null}
          ps4User={false}
          detailsOnly={true} /> : null}
        </div>
      </div>
    );
  }
}

interface ProfileModalPaginationProps {
  discoveriesPage: number;
  discoveriesCount: number;
  onPrevious: () => void;
  onNext: () => void;
}

interface ProfileModalPaginationState {}

class ProfileModalPagination extends React.Component<ProfileModalPaginationProps, ProfileModalPaginationState> {
  render() {
    const {discoveriesPage, discoveriesCount, onPrevious, onNext} = this.props;

    return (
      <div className="ui three column grid">
        <div className="column">
          {discoveriesPage > 1 ?
          <Button onClick={onPrevious}>
            Previous
          </Button> : null}
        </div>
        <div className="column textCentered ProfileModal__paginationCount">
          {`Page ${discoveriesPage} of ${Math.round(discoveriesCount / 60)}`}
        </div>
        {discoveriesCount > 60 && discoveriesPage < Math.ceil(discoveriesCount / 60) ?
        <div className="column">
          <Button onClick={onNext}>
            Next
          </Button>
        </div> : null}
      </div>
    );
  }
}

interface ProfileModalProps {
  height: number;
  profileId: string;
  username: string;
  machineId: string;
  profile: any; /* TODO */
}

interface ProfileModalState {
  profile: any;
  height: number;
  discoveriesPage: number;
  error: string;
}

export class ProfileModal extends React.Component<ProfileModalProps, ProfileModalState> {
  static propTypes = {
    profileId: PropTypes.string.isRequired
  }
  static defaultProps = {
    profileId: ''
  }

  connections: any[];
  willUnmount: boolean;
  ref: HTMLElement;
  eventRef: HTMLElement;

  constructor(props) {
    super(props);
    this.state = {
      profile: null,
      height: this.props.height / 1.2,
      discoveriesPage: 1,
      error: ''
    };
  }
  componentDidMount() {
    this.fetchProfile();
    this.connections = [
      state.connect({favorites: () => {
        if (this.willUnmount) return;
        this.fetchProfile(undefined, this.state.discoveriesPage);
      }})
    ];
  }
  componentWillUnmount() {
    this.willUnmount = true;
    this.ref.removeEventListener('resize', this.handleResize);
    each(this.connections, (id) => state.disconnect(id));
    cleanUp(this);
  }
  fetchProfile = (id = this.props.profileId, discoveriesPage = 1, isPagination = false) => {
    ajaxWorker.get(`/nmsprofile/${id}/`, {
      params: {
        apiVersion: state.apiVersion,
        machineId: state.machineId,
        username: state.username,
        discoveriesPage
      }
    }).then((profile) => {
      this.setState({
        profile: profile.data,
        discoveriesPage
      }, () => {
        if (isPagination) {
          this.eventRef.scrollTop = 0;
        }
      });
    }).catch((err) => {
      console.log(err);
    });
  }
  handleFriendRequest = (isFriend) => {
    if (isFriend) {
      ajaxWorker.post('/nmsfriendremove/', {
        username: this.props.username,
        machineId: this.props.machineId,
        friend: this.state.profile.username,
      }).then((profile) => {
        profile = Object.assign(this.state.profile, profile.data)
        this.setState({profile});
      }).catch((err) => {
        if (err.response && err.response.data && err.response.data.status) {
          this.setState({error: err.response.data.status});
        }
      });
    } else {
      ajaxWorker.post('/nmsfriendrequest/', {
        from: {
          username: this.props.username
        },
        to: {
          username: this.state.profile.username
        },
        machineId: this.props.machineId
      }).then((profile) => {
        profile = Object.assign(this.state.profile, profile.data)
        this.setState({profile});
      }).catch((err) => {
        if (err.response && err.response.data && err.response.data.status) {
          this.setState({error: err.response.data.status});
        }
      });
    }
  }
  handleClickOutside = () => {
    if (state.selectedImage) {
      return;
    }
    state.set({
      displayProfile: null
    });
  }
  handleResize = () => {
    this.setState({height: this.ref.clientHeight});
  }
  handleNextPage = () => {
    this.fetchProfile(
      undefined,
      this.state.discoveriesPage + 1,
      true
    );
  }
  handlePreviousPage = () => {
    this.fetchProfile(
      undefined,
      this.state.discoveriesPage - 1,
      true
    );
  }
  handleSwitchProfile = (friend) => {
    this.fetchProfile(friend.id);
  }
  getRef = (ref) => {
    if (this.willUnmount) return;
    if (!this.ref) {
      this.ref = ref;
      this.setState({height: ref.clientHeight});
      ref.addEventListener('resize', this.handleResize);
    }
  }
  getEventRef = (ref) => {
    if (ref && !this.eventRef) this.eventRef = ref;
  }
  render() {
    const {profile, error, discoveriesPage, height} = this.state;

    if (!profile || !this.props.profile) return null;

    const pagination = (
      <ProfileModalPagination
      discoveriesPage={discoveriesPage}
      discoveriesCount={profile.discoveriesCount}
      onNext={this.handleNextPage}
      onPrevious={this.handlePreviousPage} />
    );
    let isFriend = false;
    let isOwnProfile = this.props.profile.id === profile.id;
    let locations = [];
    let isStart;

    if (!isOwnProfile) {
      each(this.props.profile.friends, (friend) => {
        if (friend.username === profile.username) {
          isFriend = true;
          return false;
        }
      });
    }

    // Group discoveries by location
    each(profile.discoveries, (discovery) => {
      discovery = clone(discovery);
      if (!discovery.location) {
        if (discovery.type === 'Planet') {
          // Reconstruct the location data so teleporting works
          let uaObject = uaToObject(discovery.universe_address);
          let {RealityIndex} = clone(uaObject);
          let data = formatTranslatedID(uaObject);
          discovery.location = {
            ...data,
            manuallyEntered: true,
            galaxy: RealityIndex,
            unidentified: true
          }
        } else {
          discovery.location = {}
        }
      }
      let refLocation = find(locations, (location) => {
        return location.dataId === discovery.location.dataId
      });
      if (refLocation) {
        if (discovery.type !== 'Planet') {
          refLocation.discoveries.push(discovery);
        }

      } else {
        locations.push({
          ...discovery.location,
          discoveries: [discovery]
        });
      }
      if (discovery.type !== 'Planet') delete discovery.location;
    });

    return (
      <div ref={this.getRef} className="ui large modal active modal__large">
        <i
        className="window close outline icon modal__full__close"
        onClick={this.handleClickOutside} />
        <div
        className="ui segment ProfileModal__content"
        style={{maxHeight: `${height}px`}}>
          <div className="ui four column grid">
            <div
            className="ui feed eight wide column left floated segment ProfileModal__container ProfileModal__lgColumn"
            style={{maxHeight: `${height - 1}px`}}>
              <div className="ui">
                <h3>{`${profile.username}'s Profile`}</h3>
                {!isOwnProfile ?
                <Button
                className="ProfileModal__friendButton"
                onClick={() => this.handleFriendRequest(isFriend)} >
                  {error ? error : isFriend ? 'Remove Friend' : 'Send Friend Request'}
                </Button> : null}
              </div>
              <div className="ui segment">
                {profile.supporter ? <span title="Gravitino" className="ProfileModal__badge"><img src={require('./static/gravitino.png').default} /></span> : null}
                <Item className="Item__marginBottom" label="Joined" value={moment(profile.created).format('MMMM D, Y')} />
                <Item className="Item__marginBottom" label="Registered Locations" value={numberWithCommas(profile.exp)} />
                {profile.discoveriesCount > 0 ?
                <Item label="Discoveries" value={numberWithCommas(profile.discoveriesCount)} /> : null}
                {profile.discoveriesCount > 0 ?
                <div className="ui segment ProfileModal__content">
                  {map(profile.counts, (item) => {
                    const {type, count} = item;

                    if (!count) return null;

                    return (
                      <Item
                      key={type}
                      label={type}
                      value={numberWithCommas(count)} />
                    )
                  })}
                </div> : null}
                {profile.friends.length > 0 ?
                <Item label="Friends" /> : null}
                {profile.friends.length > 0 ?
                <div className="ui segment ProfileModal__content">
                  {map(profile.friends, (friend) => {
                    return (
                      <Item
                      key={friend.id}
                      label="Name"
                      value={friend.username}
                      onValueClick={() => this.handleSwitchProfile(friend)} />
                    );
                  })}
                </div> : null}
              </div>
            </div>
            <div
            ref={this.getEventRef}
            className="ui eight wide column right floated ProfileModal__container ProfileModal__mdColumn"
            style={{maxHeight: `${height - 1}px`}}>
              <Fragment>
                {profile.discoveries && profile.discoveries.length > 0 ? pagination : null}

                <div className="ui feed ProfileModal__feed">
                  {map(locations, (location, i) => {
                    let locationsLen = locations.length;
                    let discoveriesLen = location.discoveries.length;
                    let nextLocation = locations[i + 1];
                    let previousLocation = locations[i - 1];
                    let nextDiscovery = null;
                    let previousDiscovery = null;

                    if (nextLocation) {
                      nextDiscovery = filter(nextLocation.discoveries, (d) => d.type !== 'Planet')[0];
                    }

                    previousDiscovery = filter(location.discoveries, (d) => d.type !== 'Planet')[0]

                    isStart = !previousDiscovery || discoveryLevelMap[previousDiscovery.type] > 1;
                    let isEnd = i === locationsLen - 1
                      || !nextDiscovery
                      || discoveryLevelMap[nextDiscovery.type] < 2;

                    return (
                      <Fragment key={i}>
                        {map(location.discoveries, (discovery, d) => {
                          let nextDiscovery = location.discoveries[d + 1];
                          let previousDiscovery = location.discoveries[d - 1];

                          let thisLevel = discoveryLevelMap[discovery.type];
                          let nextLevel = 0;
                          let prevLevel = 0;
                          if (nextDiscovery) {
                            nextLevel = discoveryLevelMap[nextDiscovery.type];
                          } else  {
                            nextLevel = 2;
                          }
                          if (previousDiscovery) {
                            prevLevel = discoveryLevelMap[previousDiscovery.type];
                          } else if (previousLocation) {
                            let previousLocationDiscovery = last(previousLocation.discoveries);
                            if (previousLocationDiscovery) {
                              // @ts-ignore
                              prevLevel = discoveryLevelMap[previousLocationDiscovery.type];
                            }
                          }

                          let dIsStart = d === 0 || prevLevel > thisLevel || (thisLevel > 2 && thisLevel === prevLevel);
                          let dIsEnd = nextLevel < thisLevel
                            || (thisLevel > 1 && thisLevel === nextLevel)
                            || (d === discoveriesLen - 1 && isStart);
                          return (
                            <EventItem
                            key={d}
                            {...discovery}
                            profile={pick(profile, 'username', 'exp', 'id')}
                            shouldShowPlanetType={location.unidentified}
                            isStart={dIsStart}
                            isEnd={dIsEnd}
                            isLocation={discovery.type === 'Planet' && !location.unidentified} />
                          );
                        })}
                        {location.id ?
                        <EventItem
                        {...location}
                        isStart={isStart}
                        isEnd={isEnd}
                        type="Planet"
                        isLocation={location.id != null} /> : null}
                      </Fragment>
                    );
                  })}
                </div>

                {profile.discoveries && profile.discoveries.length > 0 ? pagination : null}
              </Fragment>
            </div>
          </div>
        </div>
      </div>
    );
  }
};
// @ts-ignore
ProfileModal = onClickOutside(ProfileModal);

interface FriendRequestModalProps {
  username: string;
  machineId: string;
  notification: any; /* TODO */
}

interface FriendRequestModalState {
  error: string;
}

export class FriendRequestModal extends React.Component<FriendRequestModalProps, FriendRequestModalState> {
  constructor(props) {
    super(props);
    this.state = {
      error: ''
    };
  }
  componentWillUnmount() {
    cleanUp(this);
  }
  handleClickOutside = () => {
    state.set({displayFriendRequest: null});
  }
  handleFriendRequest = () => {
    ajaxWorker.post('/nmsfriendaccept/', {
      to: {
        username: this.props.username,
      },
      from: {
        username: this.props.notification.fromProfile.username
      },
      machineId: this.props.machineId
    }).then(() => {
      state.trigger('pollSaveData');
      state.set({displayFriendRequest: null});
    }).catch((err) => {
      if (err.response && err.response.data && err.response.data.status) {
        this.setState({error: err.response.data.status});
      }
    });
  }
  render() {
    return (
      <div className="ui small modal active modal__compact">
        {this.state.error ? <div className="modal__error">{this.state.error}</div> : null}
        <div className="FriendRequestModal__description">
          {`Do you want to accept ${this.props.notification.fromProfile.username}'s friend request?`}
        </div>
        <div className="FriendRequestModal__buttonContainer">
          <div className="ui two column grid">
            <div className="column">
              <Button onClick={this.handleFriendRequest}>
                Accept
              </Button>
            </div>
            <div className="column">
              <Button onClick={this.handleClickOutside}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
};
// @ts-ignore
FriendRequestModal = onClickOutside(FriendRequestModal);

interface BaseData {
  savedBases: any[];
  restoreBase: any;
}

interface BaseRestorationModalProps {
  baseData: BaseData;
  height: number;
}

interface BaseRestorationModalState {
  baseOptions: any[];
  selectedBase: [any, number];
  preventClose: boolean;
}

export class BaseRestorationModal extends React.Component<BaseRestorationModalProps, BaseRestorationModalState> {
  static defaultProps = {
    baseData: {
      savedBases: [],
      restoreBase: null
    }
  };
  constructor(props) {
    super(props);
    this.state = {
      baseOptions: [],
      selectedBase: [null, 0],
      preventClose: false
    };
  }
  componentDidMount() {
    let {baseOptions} = this.state;
    let elgibleBases = filter(this.props.baseData.savedBases, (base) => {
      return base.GalacticAddress
      && base.Name
      && base.BaseType.PersistentBaseTypes === 'HomePlanetBase'
    });
    each(elgibleBases, (base, i: number) => {
      baseOptions.push({
        id: base.Name,
        label: base.Name,
        onClick: () => this.setState({selectedBase: [base, i + 1]})
      });
    });
    baseOptions = [{
      id: '',
      label: 'Select',
      onClick: null
    }].concat(baseOptions);
    this.setState({baseOptions});
  }
  componentWillUnmount() {
    cleanUp(this);
  }
  handleClickOutside = () => {
    state.set({displayBaseRestoration: null});
  }
  handleConfirm = () => {
    state.trigger('restoreBase', this.props.baseData.restoreBase, this.state.selectedBase[0]);
  }
  render() {
    return (
      <div className="ui small modal active modal__compact">
        <span className="close" />
        <div>
          {`Select which base will be overwritten by ${this.props.baseData.restoreBase.Name}. At least one base item must be placed for the import to work.`}
        </div>
        <div onClick={() => this.setState({preventClose: true})}>
          <BasicDropdown
          height={this.props.height}
          options={this.state.baseOptions}
          isGalaxies={false}
          selectedGalaxy={this.state.selectedBase[1]} />
        </div>
        <div style={{position: 'absolute', bottom: '10px', left: '145px'}}>
          <Button
          disabled={state.navLoad}
          onClick={this.handleConfirm}>
            {state.navLoad ? 'Working...' : 'Confirm'}
          </Button>
        </div>
      </div>
    );
  }
};
// @ts-ignore
BaseRestorationModal = onClickOutside(BaseRestorationModal);

interface LogModalProps {}

interface LogModalState {
  log: string;
  height: number;
}

export class LogModal extends React.Component<LogModalProps, LogModalState> {
  willUnmount: boolean;
  ref: any;
  constructor(props) {
    super(props);
    this.state = {
      log: null,
      height: 0
    };
  }
  componentDidMount() {
    fsWorker.readFile(`${remote.app.getPath('userData')}/NMC.log`, {encoding: 'utf-8'}, (err, log) => {
      this.setState({log});
      console.log('Log loaded...');
    });
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
    cleanUp(this);
  }
  handleClickOutside = () => {
    state.set({displayLog: null});
  }
  handleCopy = () => clipboard.writeText(this.state.log)
  handleResize = () => {
    this.setState({height: this.ref.clientHeight});
  }
  getRef = (ref) => {
    if (this.willUnmount) return;
    if (!this.ref) {
      this.ref = ref;
      this.setState({height: ref.clientHeight});
      ref.addEventListener('resize', this.handleResize);
    }
  }
  render() {
    return (
      <div ref={this.getRef} className="ui fullscreen modal active modal__full ImageModal__root">
        <div className="ui segment LogModal__container" style={{maxHeight: `${this.state.height - 54}px`}}>
          <i
          className="window close outline icon modal__full__close modal__log__close"
          onClick={this.handleClickOutside} />
          {this.state.log ?
          map(this.state.log.split(/[\r\n$]+/), (line, i) => {
            return <div key={i}>{line}</div>
          })
          :
          <div>Loading, please wait...</div>}
        </div>
        {this.state.log ?
        <div className="LogModal__button">
          <Button
          onClick={this.handleCopy}>
            Copy
          </Button>
        </div> : null}
      </div>
    );
  }
};

// @ts-ignore
LogModal = onClickOutside(LogModal);

interface SettingsModalProps {
  s: GlobalState;
  onSync: () => void;
  onUsernameOverride: () => void;
}

interface SettingsModalState {
  pollRate: number;
}

export class SettingsModal extends React.Component<SettingsModalProps, SettingsModalState> {
  willUnmount: boolean;
  autoCaptureBackendOptions: any[];
  pollRateOptions: any[];

  constructor(props) {
    super(props);

    let pollRate;

    switch (props.s.pollRate) {
      case 15000:
        pollRate = 0;
        break;
      case 30000:
        pollRate = 1;
        break;
      case 45000:
        pollRate = 2;
        break;
      case 60000:
        pollRate = 3;
        break;
      case 90000:
        pollRate = 4;
        break;
    }

    this.state = {
      pollRate,
    }

    this.autoCaptureBackendOptions = [
      {
        id: 'steam',
        label: 'Steam',
        onClick: () => state.set({autoCaptureBackend: 'steam'})
      },
      {
        id: 'legacy',
        label: 'Legacy',
        onClick: () => state.set({autoCaptureBackend: 'legacy'})
      }
    ];

    this.pollRateOptions = [
      {
        id: '15',
        label: '15 Seconds',
        onClick: () => this.setState({pollRate: 0})
      },
      {
        id: '30',
        label: '30 Seconds',
        onClick: () => this.setState({pollRate: 1})
      },
      {
        id: '45',
        label: '45 Seconds',
        onClick: () => this.setState({pollRate: 2})
      },
      {
        id: '60',
        label: '60 Seconds',
        onClick: () => this.setState({pollRate: 3})
      },
      {
        id: '90',
        label: '90 Seconds',
        onClick: () => this.setState({pollRate: 4})
      }
    ];
  }
  componentDidMount() {
    ReactTooltip.rebuild();
  }
  componentDidUpdate(pP, pS) {
    if (pS.pollRate !== this.state.pollRate) {
      this.handlePollRate();
    }
  }
  componentWillUnmount() {
    this.willUnmount = true;
    cleanUp(this);
  }
  handleClickOutside = () => {
    if (this.props.s.setEmail) {
      return;
    }
    state.set({displaySettings: false});
  }
  handleLocationSync = () => {
    state.set({navLoad: true});
    this.props.onSync();
  }
  handleAutoCapture = (e) => {
    e.stopPropagation();
    state.set({autoCapture: !this.props.s.autoCapture}, () => setTimeout(() => ReactTooltip.rebuild(), 0));
  }
  handleAutoCaptureSpaceStations = (e) => {
    e.stopPropagation();
    state.set({autoCaptureSpaceStations: !this.props.s.autoCaptureSpaceStations});
  }
  handleResetRemoteCache = () => {
    window.jsonWorker.postMessage({
      method: 'remove',
      key: 'remoteLocations'
    });

    handleRestart();
  }
  handleResetAllCache = () => {
    window.jsonWorker.postMessage({
      method: 'remove',
      key: 'remoteLocations'
    });
    window.settingsWorker.postMessage({
      method: 'remove',
      key: 'storedLocations'
    });

    handleRestart();
  }
  handleUsernameProtection = () => {
    const {profile, username, machineId} = this.props.s;
    let helpMessage = 'When you protect your username, the app will associate your computer with your username to prevent impersonation. If you plan on using the app on another computer, you will need to disable protection before switching.';

    if (profile.protected) {
      helpMessage = 'Are you sure you want to unprotect your username?'
    }

    dialog.showMessageBox({
      // @ts-ignore
      title: 'Important Information',
      message: helpMessage,
      buttons: ['Cancel', `${profile.protected ? 'Unp' : 'P'}rotect Username`]
    }, result=>{
      if (result === 1) {
        ajaxWorker.post('/nmsprofile/', {
          username,
          machineId,
          protected: !profile.protected,
        }).then((res) => {
          profile.protected = !profile.protected;
          state.set({profile}, true);
        }).catch((err) => {
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
    state.set({ps4User: !this.props.s.ps4User}, handleRestart);
  }
  handleModeSwitch = (mode) => {
    state.set({mode: mode});
  }
  handlePollRate = () => {
    const {pollRate} = this.state

    let rate;

    switch (pollRate) {
      case 0:
        rate = 15000;
        break;
      case 1:
        rate = 30000;
        break;
      case 2:
        rate = 45000;
        break;
      case 3:
        rate = 60000;
        break;
      case 4:
        rate = 90000;
        break;
    }

    state.set({pollRate: rate});
  }
  handleOfflineModeToggle = (e) => {
    e.stopPropagation();
    state.set({
      title: `${state.updateAvailable ? 'OLD' : 'NO'} MAN'S ${!this.props.s.offline ? 'DIS' : ''}CONNECT`,
      offline: !this.props.s.offline
    }, handleRestart);
  }
  handleShowMapToggle = () => {
    state.set({showMap: !this.props.s.showMap});
  }
  handleFocusKeyToggle = () => {
    state.set({focusKey: !this.props.s.focusKey}, handleRestart);
  }
  handleBackupToggle = (e) => {
    e.stopPropagation();
    state.set({backupSaveFile: !this.props.s.backupSaveFile});
  }
  render() {
    const p = this.props;
    let autoCaptureTip;

    if (!p.s.ps4User && !p.s.offline) {
      autoCaptureTip = 'Automatically grabs your screen when NMS is running and the game is saved. Only works when NMS is in (borderless) window mode.';

      if (p.s.nmsIsFullscreen) {
        autoCaptureTip += ' <strong>NMC detected fullscreen mode is enabled in the game\'s settings, so this feature is automatically disabled.</strong>';
      }
    }

    return (
      <div className="ui medium modal active modal__medium SettingsModal__root">
        <i
        className="window close outline icon modal__medium__close"
        onClick={this.handleClickOutside} />
        <div className="ui segment">
          <Item label="Difficulty" />
          <div className="ui segment SettingsModal__child">
            {!p.s.ps4User ? map(modes, (mode, i) => {
              return (
                <Item
                key={i}
                className="Item__hover"
                dataTip={tip('Controls which save file is loaded and saved.')}
                onValueClick={() => this.handleModeSwitch(mode)}
                label={upperFirst(mode)}
                icon={p.s.mode === mode ? 'check' : 'remove'} />
              );
            }) : null}
          </div>
          {!p.s.ps4User ? <div className="divider" /> : null}

          {!p.s.ps4User && !p.s.offline ?
          <Item
          disabled={p.s.nmsIsFullscreen}
          className="Item__hover"
          dataTip={tip(autoCaptureTip)}
          onValueClick={!p.s.nmsIsFullscreen ? this.handleAutoCapture : null}
          label="Screenshot Capturer"
          value={p.s.autoCapture ? 'Auto' : 'Manual'} /> : null}
          {!p.s.ps4User && !p.s.offline && p.s.autoCapture ?
          <div className="ui segment SettingsModal__child">
            <Item
            disabled={p.s.nmsIsFullscreen}
            className="Item__hover"
            dataTip={tip('Steam capturer works in fullscreen mode, unlike legacy. Make sure F12 is mapped as your screenshot capture key in Steam settings.')}
            label="Screenshot Capturer Backend"
            value={
              <BasicDropdown
              height={p.s.height}
              isGalaxies={false}
              selectedGalaxy={p.s.autoCaptureBackend === 'steam' ? 0 : 1}
              options={this.autoCaptureBackendOptions}  />
            } />
            <Item
            disabled={p.s.nmsIsFullscreen}
            className="Item__hover"
            dataTip={tip('Disable this to prevent the screenshot capturer from taking screenshots of space stations, atlas stations, and freighters.')}
            onValueClick={this.handleAutoCaptureSpaceStations}
            label="Capture Screenshots of Space Stations"
            icon={p.s.autoCaptureSpaceStations ? 'check' : 'remove'} />
          </div> : null}
          {!p.s.ps4User ? <div className="divider" /> : null}
          <Item
          disabled={p.s.navLoad}
          className="Item__hover"
          dataTip={tip('Select which platform you play NMS on')}
          onValueClick={this.handlePlatformToggle}
          label="Platform"
          value={p.s.ps4User ? 'PS4' : 'PC'} />
          {!p.s.ps4User ?
          <Item
          disabled={p.s.navLoad}
          className="Item__hover"
          dataTip={tip('Optional. Select the location NMS is installed in. This is used to associate your mods with a location, so other players can see a location which may not load properly for them.')}
          onValueClick={handleSelectInstallDirectory}
          label="NMS Install Directory"
          value={p.s.installDirectory}
          icon="remove" />
           : null}
          {!p.s.ps4User ?
          <Item
          disabled={p.s.navLoad}
          className="Item__hover"
          dataTip={tip('Required. Select the location the save files are in.')}
          onValueClick={handleSelectSaveDirectory}
          label="NMS Save Directory"
          value={p.s.saveDirectory}
          icon="remove" /> : null}
          <Item
          className="Item__hover"
          onValueClick={this.handleBackupToggle}
          dataTip={tip('When enabled, the current save file will be backed up automatically to a sub-directory inside the save data directory before any changes are written.')}
          label="Automatically Backup Save File"
          icon={p.s.backupSaveFile ? 'check' : 'remove'} />
          {!p.s.offline ?
          <Item
          className="Item__hover"
          dataTip={tip('Controls how often the client will check the server for new locations. If you experience performance issues, consider increasing this value.')}
          label="Polling Rate"
          value={
            <BasicDropdown
            height={p.s.height}
            isGalaxies={false}
            selectedGalaxy={this.state.pollRate}
            options={this.pollRateOptions}  />
          } /> : null}
          {p.s.profile ?
          <Item
          className="Item__hover"
          onValueClick={p.s.profile.email ? this.handleUsernameProtection : null}
          dataTip={
            p.s.profile.email ?
            tip('Highly recommended! Anyone can claim your username and impersonate you if this is not enabled. This associates your username with your Windows installation\'s cryptographic signature, so be sure to disable this when switching computers, upgrading hardware, or reinstalling Windows.')
            :
            tip('Please associate an email address with your profile in order to use username protection.')}
          label="Username Protection"
          icon={p.s.profile.protected ? 'check' : 'remove'} /> : null}
          {p.s.profile ?
          <Item
          className="Item__hover"
          onValueClick={this.handleSetEmail}
          dataTip={tip(`Incase you get locked out of your profile, setting a recovery email can assist in unprotecting your username, when enabled. ${p.s.profile.email ? ' Current recovery email: ' + p.s.profile.email : ''}`)}
          label="Recovery Email"
          value={p.s.profile.email}
          icon="remove" /> : null}
          {!p.s.offline ?
          <Item
          className="Item__hover"
          onValueClick={this.props.onUsernameOverride}
          dataTip={tip('Changes your username. This will update all of your locations. You must disable username protection before setting this.')}
          label="Override Username"
          value={p.s.username} /> : null}
          <Item
          className="Item__hover"
          onValueClick={handleSetWallpaper}
          dataTip={tip('Changes the NMC background.')}
          label={p.s.wallpaper ? 'Reset Wallpaper' : 'Set Wallpaper'}
          value={p.s.wallpaper || 'Default'} />
          <Item
          disabled={p.s.navLoad}
          className="Item__hover"
          onValueClick={this.handleOfflineModeToggle}
          dataTip={tip(`Prevents NMC from making network requests to the server, and attempts to keep most features in a functional state.`)}
          label="Offline Mode"
          icon={p.s.offline ? 'check' : 'remove'} />
          <Item
          className="Item__hover"
          onValueClick={this.handleShowMapToggle}
          dataTip={tip(`Toggles the map on or off.`)}
          label="Show Map"
          icon={p.s.showMap ? 'check' : 'remove'} />
          <Item
          className="Item__hover"
          onValueClick={this.handleFocusKeyToggle}
          dataTip={tip(`When enabled, pressing Insert focuses the NMC window.`)}
          label="Focus Key"
          icon={p.s.focusKey ? 'check' : 'remove'} />
          <Item
          className="SettingsModal__childHeader"
          label="Maintenance" />
          <div className="ui segment SettingsModal__child">
            {!p.s.offline ?
            <Item
            disabled={p.s.navLoad}
            className="Item__hover"
            onValueClick={this.handleLocationSync}
            dataTip={tip('Downloads stored locations belonging to you, that are available on the server, and uploads locations missing on the server.')}
            label="Sync Locations" /> : null}
            {!p.s.offline ?
            <Item
            disabled={p.s.navLoad}
            className="Item__hover"
            onValueClick={syncDiscoveries}
            dataTip={tip('Uploads missing discoveries from your save file. This process may take a while depending on how many are stored in the save file.')}
            label="Sync Discoveries" /> : null}
            <Item
            className="Item__hover"
            onValueClick={this.handleResetRemoteCache}
            dataTip={tip('This clears the remote locations list that is stored locally in AppData/Roaming/NoMansConnect on Windows and ~/.config/NoMansConnect on Linux.')}
            label="Reset Remote Cache" />
            <Item
            className="Item__hover"
            onValueClick={this.handleResetAllCache}
            dataTip={tip('This clears all locations that are stored locally in AppData/Roaming/NoMansConnect on Windows and ~/.config/NoMansConnect on Linux.')}
            label="Reset All Cache" />
          </div>
        </div>
      </div>
    );
  }
};
// @ts-ignore
SettingsModal = onClickOutside(SettingsModal);

interface StatsModalProps {
  onClose: () => void
}

interface StatsModalState {
  height: number;
  stats: any;
  selected: number;
  leaderboardType: number;
  loading: boolean;
}

class StatsModal extends React.Component<StatsModalProps, StatsModalState> {
  willUnmount: boolean;
  ref: any;
  rightColumnRef: any;
  periodOptions: any[];
  leaderboardTypeOptions: any[];
  range: VisibleRange;
  scrollTimeout: NodeJS.Timeout;

  constructor(props) {
    super(props);
    this.state = {
      height: 0,
      stats: null,
      selected: 1,
      leaderboardType: 0,
      loading: true,
    };

    this.range = {start: 0, length: 0};

    this.periodOptions = [
      {
        id: 'day',
        label: 'Time Period: Past Day',
        onClick: () => this.setState({selected: 0})
      },
      {
        id: 'week',
        label: 'Time Period: Past Week',
        onClick: () => this.setState({selected: 1})
      },
      {
        id: 'month',
        label: 'Time Period: Past Month',
        onClick: () => this.setState({selected: 2})
      },
      {
        id: 'year',
        label: 'Time Period: Past Year',
        onClick: () => this.setState({selected: 3})
      },
      {
        id: 'all',
        label: 'Time Period: All',
        onClick: () => this.setState({selected: 4})
      }
    ];

    this.leaderboardTypeOptions = [
      {
        id: 'locations',
        label: 'Locations',
        onClick: () => this.setState({leaderboardType: 0})
      },
      {
        id: 'locations',
        label: 'Discoveries',
        onClick: () => this.setState({leaderboardType: 1})
      }
    ];
  }
  componentDidMount() {
    this.fetchStats();
  }
  componentDidUpdate(pP, pS) {
    const {selected} = this.state;

    if (pS.selected !== this.state.selected) {
      this.fetchStats(selected);
    }
  }
  componentWillUnmount = () => {
    this.willUnmount = true;

    if (this.ref) this.ref.removeEventListener('resize', this.handleResize);
    if (this.rightColumnRef) this.rightColumnRef.removeEventListener('scroll', this.handleScroll);

    cleanUp(this);
  }
  fetchStats = (period = 1) => {
    this.setState({loading: true});
    ajaxWorker.get('/nmsstats/', {
      params: {
        apiVersion: state.apiVersion,
        period,
      }
    }).then((res) => {
      if (this.willUnmount) return;
      this.setState({stats: res.data, loading: false}, () => {
        if (this.rightColumnRef) this.setViewableRange(this.rightColumnRef);
      });
    });
  }
  setViewableRange = (node) => {
    if (!node) {
      return;
    }
    this.range = whichToShow({
      outerHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      itemHeight: 23,
      columns: 1
    });
    this.forceUpdate();
  }
  handleScroll = (timeout = 25) => {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(this.scrollListener, timeout);
  }
  scrollListener = () => {
    this.setViewableRange(this.rightColumnRef);
  }
  handleClickOutside = () => {
    this.props.onClose();
  }
  getRef = (ref) => {
    if (this.willUnmount) return;
    if (!this.ref) {
      this.ref = ref;
      this.setState({height: ref.clientHeight});
      ref.addEventListener('resize', this.handleResize);
    }
  }
  getRightColumnRef = (ref) => {
    if (ref && !this.rightColumnRef) {
      ref.addEventListener('scroll', this.handleScroll);
      this.setViewableRange(ref);
    }

    this.rightColumnRef = ref;
  }
  handleResize = () => {
    this.setState({height: this.ref.clientHeight});
  }
  render() {
    const {selected, leaderboardType, height, stats, loading} = this.state;

    return (
      <div ref={this.getRef} className="ui large modal active modal__large">
        <i
        className="window close outline icon modal__full__close"
        onClick={this.handleClickOutside} />
        <div
        className="ui segment ProfileModal__content"
        style={{maxHeight: `${height}px`}}>
          {stats ?
          <div
          className="ui two column grid"
          style={{opacity: loading ? 0.4 : 1, transition: 'opacity 0.1s'}}>
            <div
            className="StatsModal__header"
            data-place="bottom"
            data-tip="Stats update every hour.">
              <h3>{loading ? 'Loading...' : 'Global Stats'}</h3>
            </div>
            <div className="StatsModal__dropdown">
              <BasicDropdown
              height={height}
              isGalaxies={false}
              selectedGalaxy={selected}
              options={this.periodOptions} />
            </div>
            <div className="StatsModal__dropdownRight">
              <BasicDropdown
              height={height}
              isGalaxies={false}
              selectedGalaxy={leaderboardType}
              options={this.leaderboardTypeOptions} />
            </div>
            <div
            className="ui feed eight wide column left floated segment ProfileModal__container ProfileModal__lgColumn StatsModal__leftColumn"
            style={{maxHeight: `${height - 40}px`}}>
              {stats.discoveries.count ?
              <div className="ui segment StatsModal__segment">
                <Item
                label="Discoveries"
                value={numberWithCommas(stats.discoveries.count)} />
                <div className="ui segment ProfileModal__content">
                  {map(stats.discoveries.types, (type) => {
                    const {name, count} = type;

                    if (!count) return null;

                    return (
                      <Item
                      key={name}
                      label={name}
                      value={numberWithCommas(count)} />
                    );
                  })}
                </div>
              </div> : null}
              <div className="ui segment StatsModal__segment">
                <Item
                label="Registered Locations"
                value={numberWithCommas(stats.locations.count)} />
                <div className="ui segment ProfileModal__content">
                  <Item
                  className="Item__marginBottom"
                  label="Bases"
                  value={numberWithCommas(stats.locations.bases)} />
                  {map(stats.locations.galaxies, (galaxy, i) => {
                    const {name, count} = galaxy;

                    if (!count) return null;

                    return (
                      <Item
                      key={i}
                      label={name}
                      value={numberWithCommas(count)} />
                    );
                  })}
                </div>
              </div>
            </div>
            <div
            ref={this.getRightColumnRef}
            className="ui eight wide column right floated ProfileModal__container ProfileModal__mdColumn StatsModal__rightColumn"
            style={{maxHeight: `${height - 40}px`}}>
              {map(stats[leaderboardType ? 'discoveries' : 'locations'].leaderboard, (item, i) => {
                const {username, count} = item;
                const isVisible = i >= this.range.start && i <= this.range.start + this.range.length;

                if (isVisible) {
                  return (
                    <Item
                    key={i}
                    className="StatsModal__item"
                    label={username}
                    value={numberWithCommas(count)}
                    onValueClick={() => state.set({displayProfile: username})} />
                  );
                }

                return (
                  <div
                  key={i}
                  className="StatsModal__spacer" />
                );

              })}
            </div>
          </div> : <div>Loading fresh stats, this may take a few moments...</div>}
        </div>
      </div>
    );
  }
};

// @ts-ignore
StatsModal = onClickOutside(StatsModal);

interface StatsContainerProps {
  height: number;
}

interface StatsContainerState {
  open: boolean;
}

export class StatsContainer extends React.Component<StatsContainerProps, StatsContainerState> {
  willUnmount: boolean;
  ref: any;
  periodOptions: any[];

  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
    cleanUp(this);
  }
  handleOpen = () => {
    this.setState({open: true});
  }
  handleClose = () => {
    this.setState({open: false});
  }
  render() {

    return (
      <Fragment>
        <div
        className="ui dropdown icon item noDrag cursorDefault"
        data-place="bottom"
        data-tip={tip('Global Stats')}
        onClick={this.handleOpen}>
          <i className="chart area icon" />
        </div>
        {this.state.open ?
        <StatsModal onClose={this.handleClose} /> : null}
      </Fragment>
    );
  }
};
