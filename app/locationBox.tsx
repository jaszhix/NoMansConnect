import {clipboard} from 'electron';
import path from 'path';
import log from './log';
import state from './state';
import axios from 'axios';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactTooltip from 'react-tooltip';
import {truncate, upperFirst, isEqual, last} from 'lodash';
import moment from 'moment';

import {css, tip, cleanUp, formatForGlyphs, ajaxWorker, fsWorker, dirSep} from './utils';
import {each, map, tryFn} from './lang';

// @ts-ignore
import baseIcon from './assets/images/base_icon.png';
// @ts-ignore
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';
import Item from './item';
import Button from './buttons';
import {locationItemStyle} from './constants';

const glyphs = {};
const glyphsChars = ['A', 'B', 'C', 'D', 'E', 'F', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const glyphStyle: CSSProperties = {
  height: '16px',
  width: '16px'
};

const compactRemoteScrollBoxStyle: CSSProperties = {
  maxHeight: '500px',
  overflowY: 'hidden',
  paddingTop: '2px',
  paddingBottom: '2px'
};

each(glyphsChars, character => {
  glyphs[character] = require(`./assets/images/glyphs/${character}.png`);
});

interface LocationBoxProps {
  selectType: boolean;
  name: string;
  description: string;
  image: string;
  username: string;
  currentLocation: string;
  location: any; // TODO
  offline?: boolean;
  compactRemote?: boolean;
  detailsOnly?: boolean;
  isOwnLocation: boolean;
  edit: boolean;
  navLoad?: boolean;
  ps4User: boolean;
  isSelectedLocationRemovable: boolean;
  isVisible: boolean;
  updating: boolean;
  version: boolean;
  profile?: any;
  i?: number;
  width: number;
  height: number;
  favorites: string[];
  onCompactRemoteSwitch?: () => void;
  onEdit: () => void;
  onUpdate?: (dataId: string, data: any /* location */, remove?: boolean) => void;
  onSaveBase: (baseData: any) => void;
  onMarkCompatible: () => void;
  onDeleteScreen: () => void;
  onUploadScreen: () => void;
  onRemoveStoredLocation: () => void;
  onSubmit: (name: string, description: string) => void;
  onFav: (location: any) => void;
}

interface LocationBoxState {
  hover: string;
  limit: boolean;
  name: string;
  description: string;
  image: string;
  profile: any;
  location: any;
  positionSelect: boolean;
  positionEdit: boolean;
  positionEditHover: number;
  compactRemote: boolean;
}

class LocationBox extends React.Component<LocationBoxProps, LocationBoxState> {
  static getDerivedStateFromProps = (nextProps, nextState) => {
    let stateUpdate: GlobalState = {};
    if (nextProps.location.dataId !== nextState.location.dataId) {
      state.trigger('resetLocationScrollTop');
      stateUpdate.image = null;
      stateUpdate.location = nextProps.location;
      stateUpdate.profile = nextProps.profile ? nextProps.profile : nextProps.location.profile;

    }
    return stateUpdate;
  }

  connections: any[];
  scrollBox: HTMLElement;
  willUnmount: boolean;

  constructor(props) {
    super(props);
    this.state = {
      hover: '',
      limit: false,
      name: this.props.name,
      description: this.props.description,
      image: null,
      profile: props.profile,
      location: this.props.location,
      positionSelect: false,
      positionEdit: false,
      positionEditHover: -1,
      compactRemote: false
    };
  }
  componentDidMount() {
    this.connections = [
      state.connect({
        resetLocationScrollTop: () => this.scrollBox ? this.scrollBox.scrollTop = 0 : null,
        compactRemote: () => {
          if (!this.props.selectType && !this.willUnmount) {
            ReactTooltip.rebuild();
            this.setState({compactRemote: this.props.compactRemote}, this.props.onCompactRemoteSwitch);
          }
        },
        selectedLocation: ({selectedLocation}) => {
          if (!this.props || !this.props.selectType || this.willUnmount) return;
          setTimeout(() => {
            if (!this.props || !this.props.selectType || this.willUnmount) return;
            this.setState({positionEdit: false, positionSelect: false});
            this.getImage(selectedLocation.image)
          }, 0);
        },
        remoteChanged: ({remoteChanged}) => {
          if (!this.willUnmount
            && !this.props.offline
            && remoteChanged.includes(this.props.location.dataId)) {
            this.setState({location: this.props.location});
            this.getImage(this.props.image);
          }
        }
      })
    ];
    this.getImage(this.props.image);
    if (this.props.location && !this.props.offline) {
      this.updateLocation();
    }
  }
  componentWillUnmount = () => {
    this.willUnmount = true;
    each(this.connections, (connection) => {
      state.disconnect(connection);
    });
    cleanUp(this);
  }
  toggleEditDetails = () => {
    this.setState({positionEdit: false});
    this.props.onEdit();
  }
  togglePositionEdit = () => {
    this.setState({positionEdit: !this.state.positionEdit})
  }
  updateLocation = () => {
    let {onUpdate, location, profile} = this.props;
    if (state.offline || !location || !location.dataId || this.willUnmount) return;
    if (!onUpdate) {
      onUpdate = (...args) => state.trigger('updateRemoteLocation', ...args);
    }
    ajaxWorker.get(`/nmslocation/${location.dataId}/`).then((res) => {
      if (!this.willUnmount) {
        if (location.modified !== res.data.modified || !isEqual(profile, res.data.profile)) {
          onUpdate(location.dataId, res.data);
          this.setState({
            location: res.data,
            profile: res.data.profile
          });
        }
      }
    }).catch((err) => {
      if (!err.response) return;
      console.log(err)

      if (!this.props || (err.response && err.response.status === 404)) {
        // cleanUp was already called
        return;
      }

      onUpdate(location.dataId, null, true);
    });
  }
  getImage = (image) => {
    if (!image) {
      this.setState({image});
      return;
    }
    const {configDir} = state;
    let img = image.replace(/:/g, '~').replace(/NMSLocation-/, '');
    let file = path.resolve(`${configDir}${img}`);
    fsWorker.exists(file, (exists) => {
      if (!exists) {
        axios
        .get(`${state.staticBase}${image}`, {
          responseType: 'arraybuffer',
        })
        .then(res => {
          fsWorker.writeFile(file, Buffer.from(res.data, 'binary'), {flag: 'w'}, (err, data) => {
            if (!err && !this.willUnmount && this.scrollBox) {
              tryFn(() => this.setState({image: `${file}`}));
            } else {
              log.error('LocationBox.getImage: ', err);
            }
          });
        })
        .catch((err) => log.error('LocationBox.getImage: ', err));
      } else {
        this.setState({image: `${file}`});
      }
    });
  }
  handleNameChange = (e) => {
    this.setState({name: e.target.value});
  }
  handleDescriptionChange = (e) => {
    this.setState({description: e.target.value});
  }
  handlePositionNameChange = (e, index) => {
    let {location} = this.state;
    location.positions[index].name = e.target.value;
    this.setState({location});
  }
  handlePositionDelete = (index) => {
    let {location} = this.state;
    location.positions.splice(index, 1);
    this.setState({location});
  }
  handlePositionSave = () => {
    this.setState({positionEdit: false});
    state.trigger('updateLocation', this.state.location);
  }
  handleTeleport = (position?) => {
    let {location, positionSelect} = this.state;
    let {selectType, i} = this.props;
    if (positionSelect) {
      this.setState({positionSelect: false});
    }
    state.trigger('teleport', location, selectType ? 'selected' : i, position);
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
    let {location, image} = this.state;
    let scrollBoxStyle = p.compactRemote ? compactRemoteScrollBoxStyle : {};
    return (
      <div ref={this.getRef} style={scrollBoxStyle} className={`LocationBox__scrollBoxStyle${p.detailsOnly ? ' LocationBox__scrollBoxProfileStyle' : ''}`}>
        {image ?
        <div style={{textAlign: 'center'}}>
          <img className="LocationBox__imageStyle" src={image} onClick={() => state.set({selectedImage: image})} />
        </div> : null}
        {this.props.detailsOnly ? <Item label="Name" value={p.name || 'Unknown'} /> : null}
        {location.description || this.props.description ? <Item label="Description" value={this.props.description ? this.props.description : location.description} /> : null}
        <Item label="Galactic Address" value={location.translatedId} />
        <Item label="Universe Address" value={location.dataId} />
        <Item label="Portal Address">
          {map(formatForGlyphs(location.translatedId, location.PlanetIndex), (glyph, i) => {
            return <img key={i} src={glyphs[glyph]} style={glyphStyle} />;
          })}
        </Item>
        {location.galaxy !== undefined ? <Item label="Galaxy" value={state.galaxies[location.galaxy]} /> : null}
        {location.distanceToCenter ? <Item label="Distance to Center" value={`${location.distanceToCenter.toFixed(0)} LY / ${location.jumps} Jumps`} /> : null}
        {location.mode ? <Item label="Mode" value={upperFirst(location.mode)} /> : null}
        {(p.name.length > 0 || location.baseData) && !p.detailsOnly ? <Item label="Explored by" value={location.username} /> : null}
        {location.teleports ? <Item label="Teleports" value={location.teleports} /> : null}
        {location.score ? <Item label="Favorites" value={location.score} /> : null}
        {p.version != null ? <Item label="Version Compatibility" icon={p.version ? 'checkmark' : 'remove'} /> : null}
        <Item label="Created" value={moment(location.created).format('MMMM D, Y')} />
        {location.mods && location.mods.length > 0 && !p.compactRemote ? (
          <Item label={`Mods Used (${location.mods.length})`} dataPlace="top" dataTip={tip(this.getModMarkup(location.mods))} />
        ) : null}
      </div>
    );
  }
  handleBadgeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.set({displayProfile: this.state.profile.id});
  }
  render() {
    let p = this.props;
    let {location} = this.state;
    if (location.results || location.data) return null;
    let upvote = p.favorites.indexOf(location.dataId) > -1;
    let isOwnLocation = p.isOwnLocation && p.selectType && location.username === p.username;
    let deleteArg = location.image && location.image.length > 0;
    let compact = p.width && p.width <= 1212;
    let isSpaceStation = location.dataId[location.dataId.length - 1] === '0';
    let leftOptions = [];
    let name = p.edit && this.state.name.length > 0 ? this.state.name : location.username ? (p.name.length > 0 ? p.name : `${location.username} explored`) : 'Selected';

    if (this.state.positionSelect) {
      leftOptions.push({
        id: 'back',
        label: p.navLoad ? 'Working...' : 'Go back',
        disabled: p.navLoad,
        onClick: () => this.setState({positionSelect: false})
      });
      if (location.positions) {
        each(location.positions, (position, i) => {
          leftOptions.push({
            id: `position-${i}`,
            disabled: p.navLoad,
            label: position.name || `Location ${i + 1}`,
            onClick: () => this.handleTeleport(position)
          })
        });
      } else {
        leftOptions.push({
          id: 'legacyTeleport',
          label: `Initial Location`,
          onClick: () => this.handleTeleport()
        })
      }
    } else {
      if (location.dataId !== p.currentLocation && !p.ps4User) {
        let saveFileInfoTip = `<strong>Current save file: ${tryFn(() => last(state.saveFileName.split(dirSep)))}</strong><br /> Ensure the game is paused first, and afterwards, select "Reload current" from the game's options menu.`;
        leftOptions.push({
          id: 'teleport',
          tooltip: saveFileInfoTip,
          label: p.navLoad ? 'Working...' : 'Teleport To...',
          disabled: p.navLoad,
          onClick: () => this.setState({positionSelect: true})
        });
        leftOptions.push({
          id: 'waypoint',
          tooltip: saveFileInfoTip,
          label: 'Set Waypoint',
          disabled: p.navLoad,
          onClick: () => state.trigger('setWaypoint', location)
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
          onClick: this.toggleEditDetails
        });
        if (location.positions && location.positions.length > 0) {
          leftOptions.push({
            id: 'edit-positions',
            label: this.state.positionEdit ? 'Cancel' : 'Edit Places',
            onClick: this.togglePositionEdit
          });
        }
        if (!p.version) {
          leftOptions.push({
            id: 'markCompatibility',
            label: 'Mark as Compatible',
            onClick: () => p.onMarkCompatible()
          });
        }
        if (deleteArg) {
          leftOptions.push({
            id: 'deleteScreen',
            label: 'Delete Screenshot',
            onClick: () => p.onDeleteScreen()
          });
        } else {
          leftOptions.push({
            id: 'uploadScreen',
            label: 'Upload Screenshot',
            onClick: () => p.onDeleteScreen()
          });
        }
      }
      if (p.selectType && location.dataId !== p.currentLocation && p.isSelectedLocationRemovable) {
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
        onClick: () => clipboard.writeText(location.dataId)
      });
    }

    let visibleStyle: CSSProperties = {
      background: p.selectType ? 'rgba(23, 26, 22, 0.9)' : 'rgb(23, 26, 22)',
      display: p.detailsOnly ? 'WebkitBox' : 'inline-table',
      opacity: 1,
      borderTop: p.detailsOnly ? 'unset' : '2px solid #95220E',
      textAlign: 'left',
      marginTop: p.selectType ? '26px' : 'initial',
      marginBottom: p.detailsOnly ? 'unset' : '26px',
      marginRight: !p.selectType && p.i % 1 === 0 ? '26px' : 'initial',
      minWidth: p.detailsOnly ? 'unset' : `${compact ? 358 : 386}px`,
      maxWidth: p.detailsOnly ? 'unset' : '386px',
      minHeight: p.detailsOnly ? 'unset' : p.compactRemote ? '68px' : '245px',
      maxHeight: p.detailsOnly ? 'unset' : '289px',
      zIndex: p.selectType ? '91' : 'inherit',
      position: p.selectType ? 'fixed' : '', // TBD
      left: p.selectType ? '28px' : 'inherit',
      top: p.selectType ? `${p.height - 271}px` : 'inherit',
      WebkitUserSelect: 'none'
    };

    if (p.detailsOnly) {
      Object.assign(visibleStyle, {
        paddingTop: '0px',
        paddingLeft: '0px',
        paddingRight: '0px'
      });
    }

    let dropdown = (
      <BasicDropdown
      height={p.height}
      icon="ellipsis horizontal"
      showValue={null}
      persist={p.edit || this.state.positionSelect}
      options={leftOptions}
      detailsOnly={p.detailsOnly} />
    );

    return (
      <div
      className="ui segment"
      style={visibleStyle}
      data-place="left"
      data-tip={this.props.isVisible && !p.selectType && p.compactRemote ? ReactDOMServer.renderToString(this.renderDetails()) : null}>
        {this.props.isVisible && !p.detailsOnly ? (
          <h3
          style={{
            fontSize: name.length > 28 ? '14px' : '17.92px',
            textAlign: 'center',
            maxHeight: '23px',
            color: (location.playerPosition
              || (location.positions && location.positions.length > 0 && location.positions[0].playerPosition))
              && !location.manuallyEntered ? 'inherit' : '#7fa0ff',
            cursor: p.selectType ? 'default' : 'pointer'
          }}
          onClick={() => state.set({selectedLocation: location, selectedGalaxy: location.galaxy})}>
            {name}
            {this.state.profile ?
            <div onClick={this.handleBadgeClick} className="floating ui black label LocationBox__badge">{this.state.profile.exp}</div> : null}
          </h3>
        ) : null}

        {this.props.isVisible && !p.detailsOnly ? <i className={`${upvote ? '' : 'empty '}star icon LocationBox__starStyle`} onClick={() => p.onFav(location)} /> : null}
        {this.props.isVisible && !p.detailsOnly ? (
          <div
          style={{
            position: 'absolute',
            left: '17px',
            right: compact ? '143px' : 'initial',
            top: '16px'
          }}>
            {leftOptions.length > 0 ? dropdown : null}
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
        {this.state.positionEdit ?
        <div className="LocationBox__PositionEditContainer">
          <div className="ui segment LocationBox__uiSegmentEditStyle">
            {map(location.positions, (position, i) => {
              return (
                <div
                key={i}
                className="ui input"
                style={{width: '200px'}}
                onMouseEnter={() => this.setState({positionEditHover: i})}
                onMouseLeave={() => this.setState({positionEditHover: -1})}>
                  <div
                  className="row">
                    <input
                    className="LocationBox__inputStyle"
                    type="text"
                    value={position.name}
                    onChange={(e) => this.handlePositionNameChange(e, i)}
                    maxLength={30}
                    placeholder={`Location ${i + 1}`} />
                    {this.state.positionEditHover === i && location.positions.length > 1 ?
                    <i
                    className="trash icon LocationBox__PositionEditContainerTrash"
                    onClick={() => this.handlePositionDelete(i)} /> : null}
                  </div>
                </div>
              );
            })}

          </div>
          <div className="row">
            <div className="col-xs-6">
              <Button onClick={() => this.handlePositionSave()}>
                {p.updating ? 'Updating...' : 'Update Location'}
              </Button>
            </div>
          </div>
        </div>
        : p.edit && this.props.isVisible ? (
          <div>
            <div className="ui segment LocationBox__uiSegmentEditStyle">
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
          <div>
            {p.detailsOnly ? dropdown : null}
            {this.renderDetails()}
          </div>
        ) : null}
      </div>
    );
  }
}

export default LocationBox;
