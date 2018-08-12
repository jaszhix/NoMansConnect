import {clipboard, remote} from 'electron';
import state from './state';
import React from 'react';
import PropTypes from 'prop-types';
import onClickOutside from 'react-onclickoutside';
import ReactMarkdown from 'react-markdown';
import moment from 'moment';
import {assignIn, pick, isString, orderBy, upperFirst} from 'lodash';

import {validateEmail, ajax, fromHex, cleanUp} from './utils';
import {handleUsernameOverride, handleSetWallpaper, handleSelectInstallDirectory, handleSelectSaveDirectory, handleRestart} from './dialog';
import {each, findIndex, map, filter} from './lang';

import {BasicDropdown} from './dropdowns';
import Button from './buttons';
import LocationBox from './locationBox';
import Item from './item';

const {dialog} = remote;

export class ImageModal extends React.Component {
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

ImageModal = onClickOutside(ImageModal);

export class UsernameOverrideModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: ''
    };
    assignIn(this.state, pick(state.get(), ['ps4User']))
    this.modalStyle = {
      padding: '8px',
      textAlign: 'center',
      zIndex: '1001',
      WebkitTransformOrigin: '50% 25%',
      boxShadow: 'none',
      borderTop: '2px solid #95220E',
      border: '1px solid #DA2600',
      width: '400px'
    };
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
  componentWillUnmount = () => {
    cleanUp(this);
  }
  render() {
    return (
      <div className="ui small modal active modal__compact" style={this.modalStyle}>
        <span className="close" />
        <div className="modal__InputContainer">
          <input
          className="modal__InputStyle"
          type="text"
          value={this.state.name}
          onChange={this.handleChange}
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

UsernameOverrideModal = onClickOutside(UsernameOverrideModal);

export class RecoveryModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: '',
    };
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
    ajax.post(url, request).then((res)=>{
      if (this.props.type === 'recoveryToken') {
        handleRestart();
        return;
      }
      this.props.s.profile[prop] = this.state.value;
      state.set({profile: this.props.s.profile}, this.handleClickOutside);
    }).catch((err)=>{
      console.log(err);
      this.setState({
        address: '',
        error: errorMessage
      });
    });
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
          placeholder={this.props.placeholder} />
          <Button onClick={this.handleSave}>
            Save
          </Button>
        </div>
      </div>
    );
  }
};

RecoveryModal = onClickOutside(RecoveryModal);

export class LocationRegistrationModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      address: '',
      galaxies: [],
      galaxy: 0,
      selectedGalaxy: 0,
      preventClose: false
    };
  }
  componentDidMount() {
    each(state.galaxies, (galaxy, i)=>{
      this.state.galaxies.push({
        id: galaxy,
        label: galaxy,
        onClick: ()=>this.setState({
          galaxy: i,
          preventClose: false
        })
      });
    });
    this.setState({galaxies: this.state.galaxies});
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

    let refLocation = findIndex(this.props.s.storedLocations, location => location.translatedId === this.state.address);

    if (refLocation > -1) {
      this.setState({
        address: '',
        error: 'This location has already been registered.'
      });
      return;
    }

    this.props.s.storedLocations.push(location);
    each(this.props.s.storedLocations, (storedLocation, i)=>{
      if (isString(storedLocation.timeStamp)) {
        this.props.s.storedLocations[i].timeStamp = new Date(storedLocation.timeStamp).getTime()
      }
    });
    this.props.s.storedLocations = orderBy(this.props.s.storedLocations, 'timeStamp', 'desc');

    state.set({storedLocations: this.props.s.storedLocations}, ()=>{
      ajax.post('/nmslocation/', {
        machineId: this.props.s.machineId,
        username: location.username,
        data: location
      }).then((res)=>{
        state.trigger('fetchRemoteLocations');
        this.handleClickOutside();
      }).catch((err)=>{
        this.setState({
          address: '',
          error: 'There was an error registering this location.'
        });
      });
    });
  }
  render() {
    return (
      <div className="ui small modal active modal__compact">
        <span className="close" />
        <div onClick={()=>this.setState({preventClose: true})}>
          <BasicDropdown
          height={this.props.s.height}
          options={this.state.galaxies}
          selectedGalaxy={this.state.galaxy} />
        </div>
        {this.state.error ? <div className="modal__error">{this.state.error}</div> : null}
        <div style={{position: 'absolute', top: '50px', left: '50px'}}>
          <input
          className="modal__InputStyle"
          type="text"
          value={this.state.name}
          onChange={this.handleChange}
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

LocationRegistrationModal = onClickOutside(LocationRegistrationModal);

export class Notification extends React.Component {
  constructor(props) {
    super(props);
    this.modalStyle = {
      padding: '8px',
      textAlign: 'center',
      zIndex: '1001',
      WebkitTransformOrigin: '50% 25%',
      boxShadow: 'none',
      borderTop: '2px solid #95220E',
      border: '1px solid #DA2600',
      width: '400px',
      height: '145px',
      position: 'absolute',
      top: 'unset',
      left: 'unset',
      right: '30px',
      bottom: '30px',
      margin: 'auto'
    };
  }
  handleDismiss = () => {
    state.set({
      notification: {
        message: '',
        type: 'info'
      }
    });
  }
  render() {
    const {type, message} = this.props.notification;
    let renderedMessage = <ReactMarkdown className="md-p" source={message} />;
    return (
      <div className="ui small modal active" style={this.modalStyle}>
        <span className="close" />
        {type === 'error' ?
        <div className="modal__error">
          {renderedMessage}
        </div> : renderedMessage}
        <div style={{width: '50px', position: 'absolute', right: '46px', bottom: '10px'}}>
          <Button onClick={this.handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }
};

const planetIcon = require('./assets/images/planet_discovery.png');
const organicIcon = require('./assets/images/organic_discovery.png');
const mineralIcon = require('./assets/images/mineral_discovery.png');
const interactableIcon = require('./assets/images/interactable_discovery.png');

const discoveryIconMap = {
  Animal: organicIcon,
  Flora: organicIcon,
  Mineral: mineralIcon,
  Planet: planetIcon,
  SolarSystem: planetIcon,
  Sector: planetIcon,
  Interactable: interactableIcon
};

export class ProfileModal extends React.Component {
  static propTypes = {
    profileId: PropTypes.string.isRequired
  }
  static defaultProps = {
    profileId: ''
  }
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
      state.connect({favorites: () => this.fetchProfile(this.state.discoveriesPage)})
    ];
  }
  componentWillUnmount() {
    this.ref.removeEventListener('resize', this.handleResize);
    each(this.connections, (id) => state.disconnect(id));
  }
  fetchProfile = (discoveriesPage = 1) => {
    utils.ajax.get(`/nmsprofile/${this.props.profileId}/`, {
      params: {discoveriesPage}
    }).then((profile) => {
      this.setState({
        profile: profile.data,
        discoveriesPage
      });
    }).catch((err) => {
      console.log(err);
    });
  }
  handleFriendRequest = (isFriend) => {
    if (isFriend) {
      utils.ajax.post('/nmsfriendremove/', {
        username: this.props.profile.username,
        machineId: this.props.profile.machine_id,
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
      utils.ajax.post('/nmsfriendrequest/', {
        from: {
          username: this.props.profile.username
        },
        to: {
          username: this.state.profile.username
        },
        machineId: this.props.profile.machine_id
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
    state.set({
      displayProfile: null
    });
  }
  handleResize = () => {
    this.setState({height: this.ref.clientHeight});
  }
  handleNextPage = () => {
    this.fetchProfile(
      this.state.discoveriesPage + 1
    );
  }
  handlePreviousPage = () => {
    this.fetchProfile(
      this.state.discoveriesPage - 1
    );
  }
  handleSwitchProfile = (friend) => {
    setTimeout(() => state.set({displayProfile: friend.id}), 0);
    state.set({displayProfile: ''});
  }
  getRef = (ref) => {
    if (!this.ref) {
      this.ref = ref;
      this.setState({height: ref.clientHeight});
      ref.addEventListener('resize', this.handleResize);
    }
  }
  render() {
    const {profile, error, discoveriesPage, height} = this.state;
    if (!profile) {
      return null;
    }
    let isFriend = false;
    let isOwnProfile = this.props.profile.id === profile.id;
    if (!isOwnProfile) {
      each(this.props.profile.friends, (friend) => {
        if (friend.username === profile.username) {
          isFriend = true;
          return false;
        }
      });
    }
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
                <h3>{`${profile.username}'s Profile (Beta)`}</h3>
                {!isOwnProfile ?
                <Button
                style={{position: 'absolute', top: '-4px', right: '0px', left: 'unset'}}
                onClick={() => this.handleFriendRequest(isFriend)} >
                  {error ? error : isFriend ? 'Remove Friend' : 'Send Friend Request'}
                </Button> : null}
              </div>
              <div className="ui segment">
                <Item label="XP" value={profile.exp} />
                {profile.discoveriesCount > 0 ?
                <Item label="Discoveries" value={profile.discoveriesCount} /> : null}
                {profile.discoveriesCount > 0 ?
                <div className="ui segment ProfileModal__content">
                  <Item label="Systems" value={profile.solarSystemCount} />
                  <Item label="Planets" value={profile.planetCount} />
                  <Item label="Interactables" value={profile.interactableCount} />
                  <Item label="Fauna" value={profile.animalCount} />
                  <Item label="Flora" value={profile.floraCount} />
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
            className="ui six wide column right floated ProfileModal__container ProfileModal__mdColumn"
            style={{maxHeight: `${height - 1}px`}}>
              <React.Fragment>
                {map(profile.discoveries, (discovery, i) => {
                  let name = discovery.name ? discovery.name
                  : discovery.type === 'planet' && discovery.location && discovery.location.name ? discovery.location.name
                  : 'Unknown';
                  return (
                    <div key={i} className="ui feed ProfileModal__feed">
                      <div className="event">
                        <div className="label">
                          <img src={discoveryIconMap[discovery.type]} />
                        </div>
                        <div className="content">
                          <div className="summary">
                            {`Discovered ${discovery.type === 'SolarSystem' ? 'Solar System' : discovery.type}`}
                            <div className="date">
                              {moment(discovery.created).format('MMMM D, Y')}
                            </div>
                            <div className="meta ProfileModal__meta">
                              {discovery.location && discovery.location.score ?
                              <div
                              className={`like${this.props.favorites.indexOf(discovery.location.data.id) > -1 ? ' active' : ''}`}
                              onClick={() => state.trigger('handleFavorite', discovery.location.data)}>
                                <i className="like icon" /> {`${discovery.location.score}`}
                              </div> : null}
                            </div>
                          </div>
                          {discovery.location && discovery.location.image ?
                          <div className="extra images">
                            <a onClick={() => state.set({selectedImage: `https://neuropuff.com/${discovery.location.image}`})}>
                              <img src={`https://neuropuff.com/${discovery.location.image}`} />
                            </a>
                          </div> : null}
                          <div className="extra text">
                            <Item label="Name" value={name} />
                          </div>
                          {discovery.location ?
                          <LocationBox
                          name={discovery.location.name}
                          description={discovery.location.description}
                          username={discovery.profile.username}
                          selectType={false}
                          currentLocation={''}
                          isOwnLocation={false}
                          isVisible={true}
                          location={discovery.location.data}
                          updating={false}
                          edit={false}
                          favorites={this.props.favorites}
                          image={discovery.location.image}
                          version={/* p.s.selectedLocation.version === p.s.saveVersion */true}
                          width={800}
                          height={800}
                          isSelectedLocationRemovable={false}
                          onUploadScreen={null}
                          onDeleteScreen={null}
                          onFav={null}
                          onEdit={null}
                          onMarkCompatible={null}
                          onRemoveStoredLocation={null}
                          onTeleport={null}
                          onSubmit={null}
                          onSaveBase={null}
                          ps4User={false}
                          configDir={''}
                          detailsOnly={true} /> : null}

                        </div>
                      </div>
                    </div>
                  );
                })}
                {profile.discoveries && profile.discoveries.length > 0 ?
                <div className="ui two column grid">
                  <div className="column">
                    {discoveriesPage > 1 ?
                    <Button onClick={this.handlePreviousPage}>
                      Previous
                    </Button> : null}
                  </div>
                  {profile.discoveriesCount > 60 && discoveriesPage < Math.ceil(profile.discoveriesCount / 60) ?
                  <div className="column">
                    <Button onClick={this.handleNextPage}>
                      Next
                    </Button>
                  </div> : null}
                </div> : null}
              </React.Fragment>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

ProfileModal = onClickOutside(ProfileModal);

export class FriendRequestModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: ''
    };
  }
  handleClickOutside = () => {
    state.set({displayFriendRequest: null});
  }
  handleFriendRequest = () => {
    utils.ajax.post('/nmsfriendaccept/', {
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

FriendRequestModal = onClickOutside(FriendRequestModal);

export class BaseRestorationModal extends React.Component {
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
      selectedBase: [null, 0]
    };
  }
  componentDidMount() {
    let {baseOptions} = this.state;
    let elgibleBases = filter(this.props.baseData.savedBases, (base) => {
      return base.GalacticAddress
      && base.Name
      && base.BaseType.PersistentBaseTypes === 'HomePlanetBase'
    });
    each(elgibleBases, (base, i)=>{
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
        <div onClick={()=>this.setState({preventClose: true})}>
          <BasicDropdown
          height={this.props.height}
          options={this.state.baseOptions}
          isGalaxies={false}
          selectedGalaxy={this.state.selectedBase[1]} />
        </div>
        <div style={{position: 'absolute', bottom: '10px', left: '145px'}}>
          <Button onClick={this.handleConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    );
  }
};

BaseRestorationModal = onClickOutside(BaseRestorationModal);

export class LogModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      log: null,
      height: 0
    };
  }
  componentDidMount() {
    let fs = require('fs');
    fs.readFile(`${remote.app.getPath('userData')}/NMC.log`, {encoding: 'utf-8'}, (err, log) => {
      this.setState({log});
      console.log('Log loaded...')
    });
  }
  componentWillUnmount = () => {
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

LogModal = onClickOutside(LogModal);

const menuContainerStyle = {
  minWidth: '183px',
  borderBottomLeftRadius: '0px',
  borderBottomRightRadius: '0px',
  borderTop: '1px solid rgb(149, 34, 14)'
};

export class SettingsModal extends React.Component {
  constructor(props) {
    super(props);
  }
  handleClickOutside = () => {
    if (this.props.s.setEmail) {
      return;
    }
    state.set({displaySettings: false});
  }
  handleSync = () => {
    this.props.onSync();
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

    handleRestart();
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
    state.set({ps4User: !this.props.s.ps4User}, handleRestart);
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
      style={menuContainerStyle}
      className="ui medium modal active modal__medium">
        <i
        className="window close outline icon modal__medium__close"
        onClick={this.handleClickOutside} />
        <div className="ui segment">
          <Item label="Difficulty" />
          <div className="ui segment SettingsModal__child">
            {!p.s.ps4User ? map(modes, (mode, i)=>{
              return (
                <Item
                key={i}
                className="Item__hover"
                dataTip={utils.tip('Controls which save file is loaded and saved.')}
                onValueClick={() => this.handleModeSwitch(mode)}
                label={upperFirst(mode)}
                icon={p.s.mode === mode ? 'check' : 'remove'} />
              );
            }) : null}
          </div>
          {!p.s.ps4User ? <div className="divider" /> : null}

          {!p.s.ps4User && !p.s.offline ?
          <Item
          className="Item__hover"
          dataTip={utils.tip('Automatically grabs your screen when NMS is running and the game is saved. Only works when NMS is in window mode.')}
          onValueClick={this.handleAutoCapture}
          label="Screenshot Capturer"
          value={p.s.autoCapture ? 'Auto' : 'Manual'} /> : null}
          {!p.s.ps4User ? <div className="divider" /> : null}
          <Item
          className="Item__hover"
          dataTip={utils.tip('Select which platform you play NMS on')}
          onValueClick={this.handlePlatformToggle}
          label="Platform"
          value={p.s.ps4User ? 'PS4' : 'PC'} />
          {!p.s.ps4User ?
          <Item
          className="Item__hover"
          dataTip={utils.tip('Optional. Select the location NMS is installed in. This is used to associate your mods with a location, so other players can see a location which may not load properly for them.')}
          onValueClick={handleSelectInstallDirectory}
          label="NMS Install Directory"
          value={p.s.installDirectory}
          icon="remove" />
           : null}
          {!p.s.ps4User ?
          <Item
          className="Item__hover"
          dataTip={utils.tip('Required. Select the location the save files are in.')}
          onValueClick={handleSelectSaveDirectory}
          label="NMS Save Directory"
          value={p.s.saveDirectory}
          icon="remove" />
           : null}
          {!p.s.offline ?
          <Item
          className="Item__hover"
          onValueClick={this.handlePollRate}
          dataTip={utils.tip('Controls how often the client will check the server for new locations. If you experience performance issues, consider increasing this value.')}
          label="Polling Rate"
          value={`${p.s.pollRate / 1000} Seconds`} /> : null}
          {p.s.profile ?
          <Item
          className="Item__hover"
          onValueClick={p.s.profile.email ? this.handleUsernameProtection : null}
          dataTip={
            p.s.profile.email ?
            utils.tip('Highly recommended! Anyone can claim your username and impersonate you if this is not enabled. This associates your username with your Windows installation\'s cryptographic signature, so be sure to disable this when switching computers, upgrading hardware, or reinstalling Windows.')
            :
            utils.tip('Please associate an email address with your profile in order to use username protection.')}
          label="Username Protection"
          icon={p.s.profile.protected ? 'check' : 'remove'} /> : null}
          {p.s.profile ?
          <Item
          className="Item__hover"
          onValueClick={this.handleSetEmail}
          dataTip={utils.tip(`Incase you get locked out of your profile, setting a recovery email can assist in unprotecting your username, when enabled. ${p.s.profile.email ? ' Current recovery email: ' + p.s.profile.email : ''}`)}
          label="Recovery Email"
          value={p.s.profile.email}
          icon="remove" /> : null}
          {!p.s.offline ?
          <Item
          className="Item__hover"
          onValueClick={this.props.onUsernameOverride}
          dataTip={utils.tip('Changes your username. This will update all of your locations. You must disable username protection before setting this.')}
          label="Override Username"
          value={p.s.username} /> : null}
          <Item
          className="Item__hover"
          onValueClick={handleSetWallpaper}
          dataTip={utils.tip('Changes the NMC background.')}
          label={p.s.wallpaper ? 'Reset Wallpaper' : 'Set Wallpaper'}
          value={p.s.wallpaper || 'Default'} />
          <Item
          className="Item__hover"
          onValueClick={this.handleOfflineModeToggle}
          dataTip={utils.tip(`Prevents NMC from making network requests to the server, and attempts to keep most features in a functional state.`)}
          label="Offline Mode"
          icon={p.s.offline ? 'check' : 'remove'} />
          <Item
          className="SettingsModal__childHeader"
          label="Maintenance" />
          <div className="ui segment SettingsModal__child">
            {!p.s.offline ?
            <Item
            className="Item__hover"
            onValueClick={this.handleSync}
            dataTip={utils.tip('Downloads stored locations belonging to you, that are available on the server, and uploads locations missing on the server.')}
            label="Sync Locations" /> : null}
            <Item
            className="Item__hover"
            onValueClick={this.handleResetRemoteCache}
            dataTip={utils.tip('This clears the remote locations list that is stored locally in Roaming/NoMansConnect.')}
            label="Reset Remote Cache" />
          </div>
        </div>
      </div>
    );
  }
};

SettingsModal = onClickOutside(SettingsModal);