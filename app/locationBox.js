import {clipboard} from 'electron';
import fs from 'graceful-fs';
import path from 'path';
import log from './log';
import state from './state';
import axios from 'axios';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactTooltip from 'react-tooltip';
import {defer, truncate, upperFirst, pullAt, isEqual} from 'lodash';
import moment from 'moment';

import {css, tip, cleanUp, formatForGlyphs, ajax} from './utils';
import {each, findIndex, map, tryFn} from './lang';

import baseIcon from './assets/images/base_icon.png';
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';
import Item from './item';
import Button from './buttons';
import {locationItemStyle} from './constants';

const glyphs = {};
const glyphsChars = ['A', 'B', 'C', 'D', 'E', 'F', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const glyphStyle = {
  height: '16px',
  width: '16px'
};

each(glyphsChars, character => {
  glyphs[character] = require(`./assets/images/glyphs/${character}.png`);
});

const compactRemoteScrollBoxStyle = {
  maxHeight: '500px',
  overflowY: 'hidden',
  paddingTop: '2px',
  paddingBottom: '2px'
};

class LocationBox extends React.Component {
  static defaultProps = {
    selectType: false,
    name: '',
    description: '',
  };
  constructor(props) {
    super(props);
    this.state = {
      hover: '',
      limit: false,
      name: this.props.name,
      description: this.props.description,
      image: null,
      profile: null,
      location: this.props.location,
    };
    this.connections = [
      state.connect({
        compactRemote: () => {
          if (!props.selectType && !this.willUnmount) {
            ReactTooltip.rebuild();
            this.setState({compactRemote: props.compactRemote}, props.onCompactRemoteSwitch);
          }
        }
      })
    ];
  }
  componentDidMount() {
    this.getImage(this.props);
    if (this.props.id && !this.props.offline) {
      this.updateLocation();
    }
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.location.id !== this.props.location.id) {
      if ((nextProps.selectType && this.scrollBox)
        || (nextProps.updating !== this.props.updating && nextProps.updating)) {
        if (this.scrollBox) {
          this.scrollBox.scrollTop = 0;
        }
        this.setState({name: '', description: '', image: ''});
      }
      this.setState({location: nextProps.location});
    }

    if (nextProps.name !== this.props.name) {
      this.setState({name: nextProps.name});
    }

    if (nextProps.description !== this.props.description) {
      this.setState({description: nextProps.description});
    }

    if (nextProps.image !== this.props.image) {
      this.getImage(nextProps);
    }

    if (nextProps.compactRemote !== this.props.compactRemote && !nextProps.selectType) {
      ReactTooltip.rebuild();
      this.setState({compactRemote: nextProps.compactRemote}, this.props.onCompactRemoteSwitch);
    }
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
    each(this.connections, (connection) => {
      state.disconnect(connection);
    });
    cleanUp(this);
  }
  handleCancel = () => {
    this.props.onEdit();
  }
  updateLocation = () => {
    ajax.get(`/nmslocation/${this.props.id}/`).then((res) => {
      if (!this.willUnmount) {
        if (!isEqual(this.props.location, res.data.data) || !isEqual(this.props.profile, res.data.profile)) {
          this.props.onUpdate(this.props.id, res.data);
          this.setState({
            location: res.data.data,
            profile: res.data.profile
          });
        }
      }
    }).catch((err) => {
      if (!this.props || err.response.status === 404) {
        // cleanUp was already called
        return;
      }
      this.props.onUpdate(this.props.id, null, true);
    })
  }
  getImage = (p) => {
    if (p.image) {
      let img = p.image.replace(/:/g, '~').replace(/NMSLocation-/, '');
      let file = path.resolve(`${this.props.configDir}${img}`);
      if (!fs.existsSync(file)) {
        defer(() => {
          axios
          .get(`https://neuropuff.com/${this.props.image}`, {
            responseType: 'arraybuffer'
          })
          .then(res => {
            fs.writeFile(file, new Buffer.from(res.data, 'binary'), {flag: 'w'}, (err, data) => {
              if (!err && !this.willUnmount && this.scrollBox) {
                tryFn(() => this.setState({image: `${file}`}));
              } else {
                log.error(err);
              }
            });
          })
          .catch(() => {});
        });
      } else {
        this.setState({image: `${file}`});
      }
    }
  }
  handleNameChange = (e) => {
    this.setState({name: e.target.value});
  }
  handleDescriptionChange = (e) => {
    this.setState({description: e.target.value});
  }
  getModMarkup = (mods) => {
    return ReactDOMServer.renderToString(
      map(mods, (mod, i) => {
        return (
          <div
          key={i}
          style={css(locationItemStyle, {
              marginBottom: '0px',
              fontSize: '14px',
              width: '300px'
            })}>
            {truncate(mod, {length: 43})}
          </div>
        );
      })
    );
  }
  getRef = (ref) => {
    this.scrollBox = ref;
  }
  renderDetails = () => {
    let p = this.props;
    let {location} = this.state;
    let scrollBoxStyle = p.compactRemote ? compactRemoteScrollBoxStyle : {};
    return (
      <div ref={this.getRef} style={scrollBoxStyle} className="LocationBox__scrollBoxStyle">
        {p.image && p.image.length > 0 ? (
          <div style={{textAlign: 'center'}}>
            {this.state.image ? <img className="LocationBox__imageStyle" src={this.state.image} onClick={() => state.set({selectedImage: this.state.image})} /> : null}
          </div>
        ) : null}
        {location.description || this.props.description ? <Item label="Description" value={this.props.description ? this.props.description : location.description} /> : null}
        <Item label="Galactic Address" value={location.translatedId} />
        <Item label="Universe Address" value={location.id} />
        <Item label="Portal Address">
          {map(formatForGlyphs(location.translatedId), (glyph, i) => {
              return <img key={i} src={glyphs[glyph]} style={glyphStyle} />;
          })}
        </Item>
        {location.galaxy !== undefined ? <Item label="Galaxy" value={state.galaxies[location.galaxy]} /> : null}
        {location.distanceToCenter ? <Item label="Distance to Center" value={`${location.distanceToCenter.toFixed(0)} LY / ${location.jumps} Jumps`} /> : null}
        {location.mode ? <Item label="Mode" value={upperFirst(location.mode)} /> : null}
        {p.name.length > 0 || location.baseData ? <Item label="Explored by" value={location.username} /> : null}
        {location.teleports ? <Item label="Teleports" value={location.teleports} /> : null}
        {location.score ? <Item label="Favorites" value={location.score} /> : null}
        {p.version != null ? <Item label="Version Compatibility" icon={p.version ? 'checkmark' : 'remove'} /> : null}
        <Item label="Created" value={moment(location.timeStamp).format('MMMM D, Y')} />
        {location.mods && location.mods.length > 0 && !p.compactRemote ? (
          <Item label={`Mods Used (${location.mods.length})`} dataPlace="top" dataTip={utils.tip(this.getModMarkup(location.mods))} />
        ) : null}
      </div>
    );
  }
  handleBadgeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.set({
      search: `user:${this.state.profile.username}`,
      displayProfile: this.state.profile.id,
    });
    this.props.onSearch();
  }
  render() {
    let p = this.props;
    let {location} = this.state;
    let refFav = findIndex(p.favorites, fav => {
      return fav === location.id;
    });
    let upvote = refFav !== -1 || location.update;
    let isOwnLocation = p.isOwnLocation && p.selectType && location.username === p.username;
    let deleteArg = location.image && location.image.length > 0;
    let compact = p.width && p.width <= 1212;
    let isSpaceStation = location.id[location.id.length - 1] === '0';
    let leftOptions = [];
    let name = p.edit && this.state.name.length > 0 ? this.state.name : location.username ? (p.name.length > 0 ? p.name : `${location.username} explored`) : 'Selected';

    if (location.id !== p.currentLocation && !p.ps4User) {
      leftOptions.push({
        id: 'teleport',
        label: (p.selectType && p.installing && p.installing === `tselected`) || (p.i && p.installing === `t${p.i}`) ? 'Working...' : 'Teleport Here',
        onClick: () => p.onTeleport(location, p.selectType ? 'selected' : p.i)
      });
    }
    if (location.base && location.baseData) {
      leftOptions.push({
        id: 'storeBase',
        label: 'Store Base',
        onClick: () => p.onSaveBase(location.baseData)
      });
    }
    if (isOwnLocation) {
      leftOptions.push({
        id: 'edit',
        label: p.edit ? 'Cancel' : 'Edit Details',
        onClick: () => p.onEdit()
      });
      if (!p.version) {
        leftOptions.push({
          id: 'markCompatibility',
          label: 'Mark as Compatible',
          onClick: () => p.onMarkCompatible()
        });
      }
      leftOptions.push({
        id: 'uploadScreen',
        label: 'Upload Screenshot',
        onClick: () => p.onUploadScreen()
      });
      if (deleteArg) {
        leftOptions.push({
          id: 'deleteScreen',
          label: 'Delete Screenshot',
          onClick: () => p.onDeleteScreen()
        });
      } else {
        let refLeftOption = findIndex(leftOptions, opt => opt.id === 'deleteScreen');
        pullAt(leftOptions, refLeftOption);
      }
    }
    if (p.selectType && location.id !== p.currentLocation && p.isSelectedLocationRemovable) {
      leftOptions.push({
        id: 'removeStored',
        label: `${isOwnLocation ? location.isHidden ? 'Show In' : 'Hide From' : 'Remove From'} Storage`,
        onClick: () => p.onRemoveStoredLocation()
      });
    }
    leftOptions.push({
      id: 'copyAddress',
      label: 'Copy Galactic Address to Clipboard',
      onClick: () => clipboard.writeText(location.translatedId)
    });
    leftOptions.push({
      id: 'copyAddress',
      label: 'Copy Universe Address to Clipboard',
      onClick: () => clipboard.writeText(location.id)
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
        {this.props.isVisible ? (
          <h3
          style={{
              fontSize: name.length > 28 ? '14px' : '17.92px',
              textAlign: 'center',
              maxHeight: '23px',
              color: location.playerPosition && !location.manuallyEntered ? 'inherit' : '#7fa0ff',
              cursor: p.selectType ? 'default' : 'pointer'
            }}
          onClick={() => state.set({selectedLocation: location, selectedGalaxy: location.galaxy})}>
            {name}
            {this.state.profile ?
            <div onClick={this.handleBadgeClick} className="floating ui black label LocationBox__badge">{this.state.profile.exp}</div> : null}
          </h3>
        ) : null}

        {this.props.isVisible ? <i className={`${upvote ? '' : 'empty '}star icon LocationBox__starStyle`} onClick={() => p.onFav(location)} /> : null}
        {this.props.isVisible ? (
          <div
          style={{
              position: 'absolute',
              left: '17px',
              right: compact ? '143px' : 'initial',
              top: '16px'
            }}>
            {leftOptions.length > 0 ? <BasicDropdown icon="ellipsis horizontal" showValue={null} persist={p.edit} options={leftOptions} /> : null}
            {location.base ? (
              <span data-tip={tip('Base')} style={{position: 'absolute', left: `${leftOptions.length > 0 ? 26 : 0}px`, top: '0px'}}>
                <img className="LocationBox__baseStyle" src={baseIcon} />
              </span>
            ) : null}
            {isSpaceStation ? (
              <span data-tip={tip('Space Station')} style={{position: 'absolute', left: `${leftOptions.length > 0 ? 26 : 0}px`, top: '0px'}}>
                <img className="LocationBox__baseStyle" src={spaceStationIcon} />
              </span>
            ) : null}
          </div>
        ) : null}
        {p.edit && this.props.isVisible ? (
          <div>
            <div className="ui segment LocationBox__uiSegmentEditStyle">
              <div className="ui input" style={{width: '200px'}}>
                <div className="row">
                  <input className="LocationBox__inputStyle" type="text" value={this.state.name} onChange={this.handleNameChange} maxLength={30} placeholder="Name" />
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
                <Button onClick={() => p.onSubmit(this.state.name, this.state.description)}>
                  {p.updating ? 'Updating...' : this.state.limit ? `Limit exceeded (${this.state.description.length} characters)` : 'Update Location'}
                </Button>
              </div>
            </div>
          </div>
        ) : p.selectType || (this.props.isVisible && !p.compactRemote) ? (
          <div>{this.renderDetails()}</div>
        ) : null}
      </div>
    );
  }
}

export default LocationBox;
