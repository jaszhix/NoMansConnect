import state from './state';
import React from 'react';
import PropTypes from 'prop-types';
import onClickOutside from 'react-onclickoutside';
import ReactMarkdown from 'react-markdown';
import moment from 'moment';
import {assignIn, pick, isString, orderBy} from 'lodash';

import {validateEmail, ajax, fromHex, cleanUp} from './utils';
import {each, findIndex, map} from './lang';

import {BasicDropdown} from './dropdowns';
import Button from './buttons';
import LocationBox from './locationBox';
import Item from './item';

const errorStyle = {
  fontFamily: 'geosanslight-nmsregular',
  fontSize: '15px',
  fontWeight: 600,
  letterSpacing: '2px',
  color: 'rgb(218, 38, 0)'
};

export class ImageModal extends React.Component {
  constructor(props) {
    super(props);
    this.modalStyle = {
      background: 'rgb(23, 26, 22)',
      borderTop: '2px solid #95220E',
      position: 'fixed',
      left: '13%',
      top: '6%',
      zIndex: '1002',
      WebkitTransformOrigin: '50% 25%',
      boxShadow: 'none',
      border: '1px solid #DA2600',
      maxWidth: '75%'
    };
  }
  handleClickOutside = () => {
    state.set({selectedImage: null});
  }
  componentWillUnmount = () => {
    cleanUp(this);
  }
  render() {
    return (
      <div className="ui fullscreen modal active" style={this.modalStyle}>
        <span className="close" />
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
    this.inputStyle = {
      width: '300px',
      position: 'relative',
      top: '7px',
      color: '#FFF',
      background: 'rgb(23, 26, 22)',
      padding: '0.67861429em',
      borderRadius: '0px',
      border: '1px solid #DA2600',
      fontFamily: 'geosanslight-nmsregular',
      fontSize: '15px',
      letterSpacing: '2px'
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
      state.set({username: this.state.name}, this.props.onRestart);
      return;
    }
    this.props.onSave(this.state.name)
  }
  componentWillUnmount = () => {
    cleanUp(this);
  }
  render() {
    return (
      <div className="ui small modal active" style={this.modalStyle}>
        <span className="close" />
        <input
        style={this.inputStyle}
        type="text"
        value={this.state.name}
        onChange={this.handleChange}
        maxLength={30}
        placeholder="Username" />
        <Button onClick={this.handleSave}>
          Save
        </Button>
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
      left: '0px',
      right: '0px',
      top: '45%',
      margin: '0px auto'
    };
    this.inputStyle = {
      width: '300px',
      position: 'relative',
      top: '7px',
      color: '#FFF',
      background: 'rgb(23, 26, 22)',
      padding: '0.67861429em',
      borderRadius: '0px',
      border: '1px solid #DA2600',
      fontFamily: 'geosanslight-nmsregular',
      fontSize: '15px',
      letterSpacing: '2px'
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
        this.props.onSuccess();
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
      <div className="ui small modal active" style={this.modalStyle}>
        <span className="close" />
        {this.state.error ? <div style={errorStyle}>{this.state.error}</div> : null}
        <div style={{position: 'absolute', top: '50px', left: '50px'}}>
          <input
          style={this.inputStyle}
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
      left: '0px',
      right: '0px',
      top: '45%',
      margin: '0px auto'
    };
    this.inputStyle = {
      width: '300px',
      position: 'relative',
      top: '7px',
      color: '#FFF',
      background: 'rgb(23, 26, 22)',
      padding: '0.67861429em',
      borderRadius: '0px',
      border: '1px solid #DA2600',
      fontFamily: 'geosanslight-nmsregular',
      fontSize: '15px',
      letterSpacing: '2px'
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
      <div className="ui small modal active" style={this.modalStyle}>
        <span className="close" />
        <div onClick={()=>this.setState({preventClose: true})}>
          <BasicDropdown
          height={this.props.s.height}
          options={this.state.galaxies}
          selectedGalaxy={this.state.galaxy} />
        </div>
        {this.state.error ? <div style={errorStyle}>{this.state.error}</div> : null}
        <div style={{position: 'absolute', top: '50px', left: '50px'}}>
          <input
          style={this.inputStyle}
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
        <div style={errorStyle}>
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
      discoveriesPage: 1
    };
    this.modalStyle = {
      background: 'rgb(23, 26, 22)',
      borderTop: '2px solid #95220E',
      position: 'fixed',
      left: '0px',
      top: '6%',
      zIndex: '1001',
      WebkitTransformOrigin: '50% 25%',
      boxShadow: 'none',
      border: '1px solid #DA2600',
      maxWidth: '75%'
    };
  }
  componentDidMount() {
    this.fetchProfile();
  }
  componentWillUnmount() {
    this.ref.removeEventListener('resize', this.handleResize);
  }
  fetchProfile = (discoveriesPage = 1) => {
    utils.ajax.get(`/nmsprofile/${this.props.profileId}/`, {
      params: {discoveriesPage}
    }).then((profile) => {
      this.setState({
        profile: profile.data,
        discoveriesPage
      });
    });
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
  getRef = (ref) => {
    if (!this.ref) {
      this.ref = ref;
      this.setState({height: ref.clientHeight});
      ref.addEventListener('resize', this.handleResize);
    }
  }
  render() {
    const {profile} = this.state;
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
      <div ref={this.getRef} className="ui fullscreen modal active" style={this.modalStyle}>
        <span className="close" />
        <div
        className="ui segment ProfileModal__content"
        style={{maxHeight: `${this.state.height}px`}}>
          <div className="ui four column grid">
            <div className="ui feed eight wide column left floated segment ProfileModal__left_container">
              <div className="ui">
                <h3>{`${profile.username}'s Profile (Beta)`}</h3>
                {!isOwnProfile ?
                <Button onClick={this.onClickOutside} style={{position: 'absolute', top: '-4px', right: '0px', left: 'unset'}}>
                  {isFriend ? 'Remove Friend' : 'Send Friend Request'}
                </Button> : null}
              </div>
              <div className="ui segment">
                <Item label="XP" value={profile.exp} />
                <Item label="Discoveries" value={profile.discoveriesCount} />
                {profile.friends.length > 0 ?
                <Item
                label="Friends"
                value={
                  <React.Fragment>
                    {map(profile.friends, (friend) => {
                      return <Item label="Name" value={friend.username} />
                    })}
                  </React.Fragment>
                } /> : null}
              </div>
            </div>
            <div
            className="ui feed six wide column right floated ProfileModal__right_container"
            style={{maxHeight: `${this.state.height - 77}px`}}>
              <React.Fragment>
                {map(profile.discoveries, (discovery, i) => {
                  let name = discovery.name ? discovery.name
                  : discovery.type === 'planet' && discovery.location && discovery.location.name ? discovery.location.name
                  : 'Unknown';
                  return (
                    <div key={i} className="event">
                      <div className="label">
                        <img src={discoveryIconMap[discovery.type]} />
                      </div>
                      <div className="content">
                        <div className="summary">
                          {`Discovered ${discovery.type}`}
                          <div className="date">
                            {moment(discovery.created).format('MMMM D, Y')}
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
                          installing={false}
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
                        <div className="meta">
                          {discovery.location && discovery.location.score ?
                          <div className="like">
                            <i className="like icon" /> {`${discovery.location.score}`}
                          </div> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {profile.discoveries && profile.discoveries.length > 0 ?
                <div className="ui two column grid">
                  <div className="column">
                    {this.state.discoveriesPage > 1 ?
                    <Button onClick={this.handlePreviousPage}>
                      Previous
                    </Button> : null}
                  </div>
                  <div className="column">
                    <Button onClick={this.handleNextPage}>
                      Next
                    </Button>
                  </div>
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