import state from './state';
import React from 'react';
import onClickOutside from 'react-onclickoutside';
import ReactMarkdown from 'react-markdown';
import {assignIn, pick, isString, orderBy} from 'lodash';

import {validateEmail, ajax, fromHex, cleanUp} from './utils';
import {each, findIndex} from './lang';

import {BasicDropdown} from './dropdowns';
import Button from './buttons';

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
      zIndex: '1001',
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