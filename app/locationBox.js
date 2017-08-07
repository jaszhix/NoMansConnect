import {clipboard} from 'electron';
import fs from 'graceful-fs';
import path from 'path';
import {log} from './app';
import state from './state';
import axios from 'axios';
import React from 'react';
import ReactDOMServer from 'react-dom/server'
import autoBind from 'react-autobind';
import ReactTooltip from 'react-tooltip';
import _ from 'lodash';
import moment from 'moment';

import * as utils from './utils';
window.utils = utils

import baseIcon from './assets/images/base_icon.png';
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';
import Item from './item';
import {locationItemStyle} from './constants';

class LocationBox extends React.Component {
  static defaultProps = {
    selectType: false,
    name: '',
    description: ''
  };
  constructor(props) {
    super(props);
    this.state = {
      hover: '',
      limit: false,
      name: this.props.name,
      description: this.props.description,
      image: null
    };
    autoBind(this);
  }
  handleCancel(){
    this.props.onEdit();
  }
  componentDidMount(){
    if (this.props.image) {
      let img = this.props.image
        .replace(/:/g, '~')
        .replace(/NMSLocation-/, '');
      let file = path.resolve(`${this.props.configDir}${img}`)
      if (!fs.existsSync(file)) {
        axios.get(`https://neuropuff.com/${this.props.image}`, {
          responseType: 'arraybuffer'
        }).then((res)=>{
          fs.writeFile(file, new Buffer.from(res.data, 'binary'), {flag: 'w'}, (err, data)=>{
            if (!err) {
              this.setState({image: `${file}`});
            } else {
              log.error(err)
            }
          });
        }).catch(()=>{});
      } else {
        this.setState({image: `${file}`});
      }
    }
  }
  componentWillReceiveProps(nextProps){
    if (nextProps.selectType && !_.isEqual(nextProps.location, this.props.location) && this.refs.scrollBox
      || nextProps.updating !== this.props.updating && nextProps.updating) {
      if (this.refs.scrollBox) {
        this.refs.scrollBox.scrollTop = 0;
      }

      this.setState({name: '', description: ''});
    }

    if (nextProps.name !== this.props.name) {
      this.setState({name: nextProps.name});
    }

    if (nextProps.description !== this.props.description) {
      this.setState({description: nextProps.description});
    }

    if (nextProps.compactRemote !== this.props.compactRemote && !nextProps.selectType) {
      ReactTooltip.rebuild();
      this.setState({compactRemote: nextProps.compactRemote}, this.props.onCompactRemoteSwitch);
    }
  }
  shouldComponentUpdate(nextProps, nextState){
    let bool = (!_.isEqual(nextProps.location, this.props.location)
      || nextProps.favorites !== this.props.favorites
      || nextProps.updating !== this.props.updating
      || nextProps.enableVisibilityCheck !== this.props.enableVisibilityCheck
      || nextProps.selectType === true
      || nextProps.isVisible !== this.props.isVisible
      || nextProps.scrollTop !== this.props.scrollTop
      || nextProps.compactRemote !== this.props.compactRemote && nextState.isVisible
      || nextState.image !== this.state.image);
    if (!_.isBoolean(bool)) { // TBD
      return true;
    }
    return bool;
  }
  handleNameChange(e){
    this.setState({name: e.target.value})
  }
  handleDescriptionChange(e){
    this.setState({description: e.target.value})
  }
  renderDetails(){
    let p = this.props;
    let scrollBoxStyle = p.compactRemote ? {maxHeight: '500px'} : {};
    return (
      <div
      ref="scrollBox"
      style={scrollBoxStyle}
      className="LocationBox__scrollBoxStyle">
        {p.image && p.image.length > 0 ?
        <div style={{textAlign: 'center'}}>
          {this.state.image ?
          <img
          className="LocationBox__imageStyle"
          src={this.state.image}
          onClick={()=>state.set({selectedImage: this.state.image})} /> : null}
        </div> : null}
        {p.location.description ? <Item label="Description" value={p.location.description} /> : null }
        <Item label="Galactic Address" value={p.location.translatedId} />
        <Item label="Voxel Address" value={p.location.id} />
        {p.location.galaxy !== undefined ? <Item label="Galaxy" value={state.galaxies[p.location.galaxy]} /> : null}
        {p.location.distanceToCenter ? <Item label="Distance to Center" value={`${p.location.distanceToCenter.toFixed(3)} LY`} /> : null}
        <Item label="Jumps" value={p.location.jumps} />
        {p.location.mode ? <Item label="Mode" value={_.upperFirst(p.location.mode)} /> : null}
        {p.location.teleports ? <Item label="Teleports" value={p.location.teleports} /> : null}
        {p.location.score ? <Item label="Favorites" value={p.location.score} /> : null}
        {p.name.length > 0 || p.location.baseData ? <Item label="Explored by" value={p.location.username} /> : null}
        <Item label="Created" value={moment(p.location.timeStamp).format('MMMM D, Y')} />
        {p.location.mods && p.location.mods.length > 0 && !p.compactRemote ?
        <div
        className="ui segment"
        style={utils.css(locationItemStyle)}>
          <span style={{fontWeight: '600'}}>Mods Used ({p.location.mods.length})</span>:
          {_.map(p.location.mods, (mod, i)=>{
            return (
              <div
              key={i}
              className="ui segment"
              style={utils.css(locationItemStyle, {
                marginTop: i === 0 ? '14px' : '0px',
                marginBottom: '0px',
                fontSize: '14px'
              })}>
                {_.truncate(mod, {length: 43})}
              </div>
            );
          })}
        </div> : null}
      </div>
    );
  }
  render(){
    let p = this.props;
    let refFav = _.findIndex(p.favorites, (fav)=>{
      return fav === p.location.id;
    });
    let upvote = refFav !== -1 || location.update;
    let isOwnLocation = p.isOwnLocation && p.selectType && p.location.username === p.username;
    let deleteArg = p.location.image && p.location.image.length > 0;
    let compact = p.width && p.width <= 1212;
    let isSpaceStation = p.location.id[p.location.id.length - 1] === '0';
    let leftOptions = [];

    if (p.location.id !== p.currentLocation && !p.ps4User) {
      leftOptions.push({
        id: 'teleport',
        label: p.selectType && p.installing && p.installing === `tselected` || p.i && p.installing === `t${p.i}` ? 'Working...' : 'Teleport Here',
        onClick: ()=>p.onTeleport(p.location, p.selectType ? 'selected' : p.i)
      });
    }
    if (p.location.base && p.location.baseData) {
      leftOptions.push({
        id: 'storeBase',
        label: 'Store Base',
        onClick: ()=>p.onSaveBase(p.location.baseData)
      });
    }
    if (p.isOwnLocation && p.selectType && p.location.username === p.username) {
      leftOptions.push({
        id: 'edit',
        label: p.edit ? 'Cancel' : 'Edit Details',
        onClick: ()=>p.onEdit()
      });
    }
    if (isOwnLocation) {
      leftOptions.push({
        id: 'uploadScreen',
        label: 'Upload Screenshot',
        onClick: ()=>p.onUploadScreen()
      });
      if (deleteArg) {
        leftOptions.push({
          id: 'deleteScreen',
          label: 'Delete Screenshot',
          onClick: ()=>p.onDeleteScreen()
        });
      } else {
        let refLeftOption = _.findIndex(leftOptions, {id: 'deleteScreen'});
        _.pullAt(leftOptions, refLeftOption);
      }
    } else if (p.selectType && p.location.id !== p.currentLocation && p.isSelectedLocationRemovable) {
      leftOptions.push({
        id: 'removeStored',
        label: 'Remove From Storage',
        onClick: ()=>p.onRemoveStoredLocation()
      });
    }
    leftOptions.push({
      id: 'copyAddress',
      label: 'Copy Address to Clipboard',
      onClick: ()=>clipboard.writeText(p.location.translatedId)
    });

    let visibleStyle = {
      background: p.selectType ? 'rgba(23, 26, 22, 0.9)' : 'rgb(23, 26, 22)',
      display: 'inline-table',
      opacity: '1',
      borderTop: '2px solid #95220E',
      textAlign: 'left',
      marginTop: p.selectType ? '26px' : 'initial',
      marginBottom: '26px',
      marginRight: !p.selectType && p.i % 1 === 0 ? '26px' : 'initial',
      minWidth: `${compact ? 358 : 386}px`,
      maxWidth: '386px',
      minHeight: p.compactRemote ? '68px' : '245px',
      maxHeight: '289px',
      zIndex: p.selectType ? '91' : 'inherit',
      position: p.selectType ? 'fixed' : '',
      left: p.selectType ? '28px' : 'inherit',
      top: p.selectType ? `${p.height - 271}px` : 'inherit',
      WebkitUserSelect: 'none'
    };

    return (
      <div
      className="ui segment"
      style={visibleStyle}
      data-place="left"
      data-tip={this.props.isVisible && !p.selectType && p.compactRemote ? ReactDOMServer.renderToString(this.renderDetails()) : null}>
        {this.props.isVisible ?
        <h3 style={{
          textAlign: 'center',
          maxHeight: '23px',
          color:  p.location.playerPosition && !p.location.manuallyEntered ? 'inherit' : '#7fa0ff',
          cursor: p.selectType ? 'default' : 'pointer'
        }}
        onClick={()=>state.set({selectedLocation: p.location, selectedGalaxy: p.location.galaxy})}>
          {p.edit && this.state.name.length > 0 ? this.state.name : p.location.username ? p.name.length > 0 ? p.name : `${p.location.username} explored` : 'Selected'}
        </h3> : null}

        {this.props.isVisible ?
        <i
        className={`${upvote ? '' : 'empty '}star icon LocationBox__starStyle`}
        onClick={()=>p.onFav(p.location)} /> : null}
        {this.props.isVisible ?
        <div style={{
          position: 'absolute',
          left: '17px',
          right: compact ? '143px' : 'initial',
          top: '16px'
        }}>
          {leftOptions.length > 0 ?
          <BasicDropdown
          icon="ellipsis horizontal"
          showValue={null}
          persist={p.edit}
          options={leftOptions} /> : null}
          {p.location.base ?
          <span data-tip={utils.tip('Base')} style={{position: 'absolute', left: `${leftOptions.length > 0 ? 26 : 0}px`, top: '0px'}}>
            <img className="LocationBox__baseStyle" src={baseIcon} />
          </span> : null}
          {isSpaceStation ?
          <span data-tip={utils.tip('Space Station')} style={{position: 'absolute', left: `${leftOptions.length > 0 ? 26 : 0}px`, top: '0px'}}>
            <img className="LocationBox__baseStyle" src={spaceStationIcon} />
          </span> : null}
        </div> : null}
        {p.edit && this.props.isVisible ?
        <div>
          <div
          className="ui segment"
          className="LocationBox__uiSegmentEditStyle">
            <div className="ui input" style={{width: '200px'}}>
              <div className="row">
                <input
                className="LocationBox__inputStyle"
                type="text"
                value={this.state.name}
                onChange={this.handleNameChange}
                maxLength={30}
                placeholder="Name" />
              </div>
            </div>
            <div className="ui input" style={{width: '200px'}}>
              <div className="row">
                <textarea
                className="LocationBox__textareaStyle"
                type="text"
                value={this.state.description}
                onChange={this.handleDescriptionChange}
                maxLength={200}
                placeholder="Description... (200 character limit)" />
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xs-6">
              <Button onClick={()=>p.onSubmit(this.state.name, this.state.description)}>
                {p.updating ? 'Updating...' : this.state.limit ? `Limit exceeded (${this.state.description.length} characters)` : 'Update Location'}
              </Button>
            </div>
          </div>
        </div>
        : p.selectType || this.props.isVisible && !p.compactRemote ?
        <div>
          {this.renderDetails()}
        </div> : null}
      </div>

    );
  }
};

export default LocationBox;