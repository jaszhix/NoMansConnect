import {clipboard} from 'electron';
import path from 'path';
import log from './log';
import state from './state';
import axios from 'axios';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactTooltip from 'react-tooltip';
import {truncate, upperFirst, last} from 'lodash';
import moment from 'moment';
import {each, map, tryFn} from '@jaszhix/utils';

import {tip, cleanUp, formatForGlyphs, ajaxWorker, fsWorker, dirSep} from './utils';

// @ts-ignore
import baseIcon from './assets/images/base_icon.png';
// @ts-ignore
import spaceStationIcon from './assets/images/spacestation_icon.png';

import {BasicDropdown} from './dropdowns';
import {SearchField} from './search';
import Item from './item';
import Button from './buttons';

const glyphs = {};
const glyphsChars = ['A', 'B', 'C', 'D', 'E', 'F', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

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
  location: NMSLocation;
  offline?: boolean;
  compactRemote?: boolean;
  detailsOnly?: boolean;
  isOwnLocation: boolean;
  edit: boolean;
  positionEdit: boolean;
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
  onPositionEdit: (value?) => void;
  onUpdate?: (dataId: string, data: any /* location */, remove?: boolean) => void;
  onMarkCompatible: () => void;
  onDeleteScreen: () => void;
  onUploadScreen: () => void;
  onRemoveStoredLocation: () => void;
  onSubmit: (name: string, description: string, tags: string[]) => void;
  onFav: (location: any) => void;
}

interface LocationBoxState {
  hover?: string;
  limit?: boolean;
  name?: string;
  description?: string;
  tagName?: string;
  tags?: string[];
  image?: string;
  profile?: any;
  location?: NMSLocation;
  portalHex?: string[];
  positionSelect?: boolean;
  positionEditHover?: number;
  compactRemote?: boolean;
}

class LocationBox extends React.Component<LocationBoxProps, LocationBoxState> {
  static defaultProps = {
    name: '',
    description: '',
  };
  static getDerivedStateFromProps = (nextProps, nextState) => {
    const stateUpdate: LocationBoxState = {};
    let {location} = nextProps;

    if (location.dataId !== nextState.location.dataId) {
      state.trigger('resetLocationScrollTop');

      stateUpdate.image = null;
      stateUpdate.name = location.name || '';
      stateUpdate.description = location.description || '';
      stateUpdate.location = location;
      stateUpdate.portalHex = formatForGlyphs(location.translatedId, location.PlanetIndex);
      stateUpdate.profile = location.profile;
      stateUpdate.tags = location.tags || [];
    }

    return stateUpdate;
  }

  connections: any[];
  scrollBox: HTMLElement;
  willUnmount: boolean;

  constructor(props) {
    super(props);

    const {location} = props;

    this.state = {
      hover: '',
      limit: false,
      name: location.name || '',
      description: location.description || '',
      tagName: '',
      tags: location.tags || [],
      image: null,
      profile: location.profile,
      location: location,
      portalHex: formatForGlyphs(location.translatedId, location.PlanetIndex),
      positionSelect: false,
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
          if (!this.props
            || this.willUnmount
            || !this.props.selectType
            || !selectedLocation) return;

          this.getImage(selectedLocation.image, {positionEdit: false, positionSelect: false});
          if (!this.props.offline) this.updateLocation();
        },
        remoteChanged: ({remoteChanged}) => {
          if (!this.willUnmount
            && !this.props.offline
            && remoteChanged.includes(this.props.location.dataId)) {
            this.setState({location: this.props.location});
            this.getImage(this.props.image);
          }
        },
        updateScreenshot: (selectedLocation) => {
          if (this.props.selectType || selectedLocation.dataId !== this.state.location.dataId) return;

          this.getImage(selectedLocation.image);
        },
        deleteScreenshot: (dataId) => {
          if (this.state && this.state.location && this.state.location.dataId === dataId) {
            this.setState({image: null});
          }
        }
      }),
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
    const {location, positionEdit, edit, onEdit} = this.props;

    if (positionEdit) this.togglePositionEdit();

    if (edit) {
      this.setState({
        name: location.name,
        description: location.description,
      }, onEdit);
      return;
    }

    this.props.onEdit();
  }
  togglePositionEdit = () => {
    if (this.props.edit) this.toggleEditDetails();

    this.props.onPositionEdit();
  }
  unmarkBaseLocation = () => {
    const {location} = this.props;

    Object.assign(location, {
      base: false,
      baseData: null
    });

    state.trigger('markStoredLocationsDirty');
    state.trigger('updateLocation', location);
  }
  updateLocation = () => {
    let {location, profile, detailsOnly} = this.props;

    if (state.offline || !location || !location.dataId || this.willUnmount) return;

    ajaxWorker.get(`/nmslocation/${location.dataId}/`).then((res) => {
      if (this.willUnmount) return;

      if (location.modified !== res.data.modified || profile.modified !== res.data.profile.modified) {
        state.trigger('updateCachedLocation', location.dataId, res.data);
      }
    }).catch((err) => {
      if (!err.response) return;

      const notFound = err.response && err.response.status === 404;

      if (!this.props || notFound) {
        location.apiVersion = 3;
        if (!detailsOnly && !state.offline && notFound) state.trigger('updateLocation', location);
        // cleanUp was already called
        return;
      }

      state.trigger('updateCachedLocation', location.dataId, null, true);
    });
  }
  getImage = (image, stateUpdate = {}) => {
    if (!image) {
      this.setState({image: null, ...stateUpdate});
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
          fsWorker.writeFile(file, Buffer.from(res.data, 'binary'), {flag: 'w'}, (err/* , data */) => {
            if (!err && !this.willUnmount && this.scrollBox) {
              tryFn(() => this.setState({image: `${file}`, ...stateUpdate}));
            } else {
              log.error('LocationBox.getImage: ', err);
              setTimeout(this.removeImageFromSelected, 0);
            }
          });
        })
        .catch((err) => {
          log.error('LocationBox.getImage: ', err);
          setTimeout(this.removeImageFromSelected, 0);
        });
      } else if (!this.willUnmount) {
        this.setState({image: `${file}`, ...stateUpdate});
      }
    });
  }
  // Remove screenshot from local cache
  removeImage = (cb) => {
    const {image} = this.state.location;
    const {configDir} = state;
    const img = image.replace(/:/g, '~').replace(/NMSLocation-/, '');
    const file = path.resolve(`${configDir}${img}`);

    fsWorker.exists(file, (exists) => {
      if (!exists) {
        cb();
        return;
      }
      fsWorker.unlink(file, (err) => {
        if (err) log.error(err);
        cb();
      });
    });
  }
  removeImageFromSelected = () => {
    if (this.props.selectType) {
      const {selectedLocation} = state;
      selectedLocation.image = null;
      state.set({selectedLocation});
      state.trigger('markStoredLocationsDirty');
    }
  }
  handleNameChange = (e) => {
    this.setState({name: e.target.value});
  }
  handleDescriptionChange = (e) => {
    this.setState({description: e.target.value});
  }
  handleTagNameChange = (tagName) => {
    this.setState({tagName});
  }
  handleAddTag = () => {
    const {tagName, tags} = this.state;

    if (!tagName.trim()) return;

    if (tags.indexOf(tagName) === -1) {
      tags.push(tagName);
    };

    this.setState({
      tags,
      tagName: '',
    })
  }
  handleRemoveTag = (tag) => {
    const {tags} = this.state;
    const index = tags.indexOf(tag);

    if (index > -1) {
      tags.splice(index, 1);
    }

    this.setState({tags});
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
    this.props.onPositionEdit(false);
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
  handleUploadScreenshot = () => {
    this.props.onUploadScreen();
  }
  handleDeleteScreenshot = () => {
    this.removeImage(() => {
      state.trigger('deleteScreenshot', this.state.location.dataId);
      this.props.onDeleteScreen();
    });
  }
  handleTagClick = (tag) => {
    state.set({search: `tag:${tag}`});
    state.trigger('handleSearch');
  }
  getModMarkup = (mods) => {
    return ReactDOMServer.renderToString(
      map(mods, (mod, i) => {
        return (
          <div
          key={i}
          className="LocationBox__modsMarkup">
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
    const {
      version,
      detailsOnly,
      compactRemote,
      selectType,
      edit,
      positionEdit,
    } = this.props;
    let {location, portalHex, image} = this.state;

    let className = 'LocationBox__scrollBoxStyle';

    if (detailsOnly) className += ' LocationBox__scrollBoxProfileStyle';
    if (compactRemote) className += ' LocationBox__compactRemoteScrollBox';

    return (
      <div
      ref={this.getRef}
      style={selectType && (image || edit || positionEdit) ? {maxHeight: '338px'} : null}
      className={className}>
        {image ?
        <div className="textCentered">
          <img className="LocationBox__imageStyle" src={image} onClick={() => state.set({selectedImage: image})} />
        </div> : null}

        {map(location.tags, (tag) => {
          return (
            <div
            key={tag}
            className="ui black label LocationBox__tag"
            onClick={() => this.handleTagClick(tag)}>
              {tag}
            </div>
          )
        })}

        {this.props.detailsOnly ?
        <Item
        label="Name"
        value={location.name || 'Unknown'} /> : null}

        {location.description || this.props.description ?
        <Item
        label="Description"
        value={this.props.description ? this.props.description : location.description} /> : null}

        <Item label="Galactic Address" value={location.translatedId} />
        <Item label="Universe Address" value={location.dataId} />
        <Item label="Portal Address">
          {map(portalHex, (glyph, i) => {
            return <img key={i} src={glyphs[glyph]} className="LocationBox__glyphs" />;
          })}
        </Item>
        {location.galaxy !== undefined ? <Item label="Galaxy" value={state.galaxies[location.galaxy]} /> : null}
        {location.distanceToCenter ? <Item label="Distance to Center" value={`${location.distanceToCenter.toFixed(0)} LY / ${location.jumps} Jumps`} /> : null}
        {location.mode ? <Item label="Mode" value={upperFirst(location.mode)} /> : null}
        {(location.name || location.baseData) && !detailsOnly ? <Item label="Explored by" value={location.username} /> : null}
        {location.teleports ? <Item label="Teleports" value={location.teleports} /> : null}
        {location.score ? <Item label="Favorites" value={location.score} /> : null}
        {version != null ? <Item label="Version Compatibility" icon={version ? 'checkmark' : 'remove'} /> : null}
        <Item label="Created" value={moment(location.created).format('MMMM D, Y')} />
        {location.mods && location.mods.length > 0 && !compactRemote ? (
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
    let {
      i,
      version,
      width,
      height,
      detailsOnly,
      compactRemote,
      navLoad,
      updating,
      selectType,
      edit,
      positionEdit,
      isOwnLocation,
      currentLocation,
      isSelectedLocationRemovable,
      username,
      ps4User,
      favorites,
      onMarkCompatible,
      onRemoveStoredLocation,
      onFav,
      onSubmit,
    } = this.props;
    const {location, portalHex, image, tags} = this.state;

    const needsExpand = selectType && (image || edit || positionEdit);

    if (location.results || location.data) return null;

    let upvote = favorites.indexOf(location.dataId) > -1;
    isOwnLocation = isOwnLocation && selectType && location.username === username;
    let deleteArg = location.image && location.image.length > 0;
    let compact = width && width <= 1212;
    let isSpaceStation = location.dataId && location.dataId[location.dataId.length - 1] === '0';
    let leftOptions = [];
    let name = edit && this.state.name.length > 0 ? this.state.name
      : location.username ? (location.name && location.name.length > 0 ? location.name : `${location.username} explored`)
      : 'Selected';

    if (this.state.positionSelect) {
      leftOptions.push({
        id: 'back',
        label: navLoad ? 'Working...' : 'Go back',
        disabled: navLoad,
        onClick: () => this.setState({positionSelect: false})
      });
      if (location.positions) {
        each(location.positions, (position, i) => {
          leftOptions.push({
            id: `position-${i}`,
            disabled: navLoad,
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
      if (location.dataId !== currentLocation && !ps4User) {
        let saveFileInfoTip = `<strong>Current save file: ${tryFn(() => last(state.saveFileName.split(dirSep)))}</strong><br /> Ensure the game is paused first, and afterwards, select "Reload current" from the game's options menu.`;
        leftOptions.push({
          id: 'teleport',
          tooltip: saveFileInfoTip,
          label: navLoad ? 'Working...' : 'Teleport To...',
          disabled: navLoad,
          onClick: () => this.setState({positionSelect: true})
        });
        leftOptions.push({
          id: 'waypoint',
          tooltip: saveFileInfoTip,
          label: 'Set Waypoint',
          disabled: navLoad,
          onClick: () => state.trigger('setWaypoint', location)
        });
      }
      if (location.base && location.baseData) {
        leftOptions.push({
          id: 'storeBase',
          label: 'Store Base',
          onClick: () => state.trigger('saveBase', location.baseData)
        });

        if (isOwnLocation) {
          leftOptions.push({
            id: 'unmarkBaseLocation',
            label: 'Unmark as Base Location',
            onClick: this.unmarkBaseLocation
          });
        }
      }
      if (isOwnLocation) {
        leftOptions.push({
          id: 'edit',
          label: edit ? 'Cancel Details Edit' : 'Edit Details',
          onClick: this.toggleEditDetails
        });
        if (location.positions && location.positions.length > 0) {
          leftOptions.push({
            id: 'edit-positions',
            label: positionEdit ? 'Cancel Places Edit' : 'Edit Places',
            onClick: this.togglePositionEdit
          });
        }
        if (!version) {
          leftOptions.push({
            id: 'markCompatibility',
            label: 'Mark as Compatible',
            onClick: () => onMarkCompatible()
          });
        }
        if (deleteArg) {
          leftOptions.push({
            id: 'deleteScreen',
            label: 'Delete Screenshot',
            onClick: this.handleDeleteScreenshot
          });
        } else {
          leftOptions.push({
            id: 'uploadScreen',
            label: 'Upload Screenshot',
            onClick: this.handleUploadScreenshot
          });
        }
      }
      if (selectType && location.dataId !== currentLocation && isSelectedLocationRemovable) {
        leftOptions.push({
          id: 'removeStored',
          label: `${isOwnLocation ? location.isHidden ? 'Show In' : 'Hide From' : 'Remove From'} Storage`,
          onClick: () => onRemoveStoredLocation()
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
      leftOptions.push({
        id: 'copyPortalHex',
        label: 'Copy Portal Address to Clipboard',
        onClick: () => clipboard.writeText(portalHex.join(''))
      });
    }

    let visibleStyle: React.CSSProperties = {
      background: selectType ? 'rgba(23, 26, 22, 0.9)' : 'rgb(23, 26, 22)',
      display: detailsOnly ? 'WebkitBox' : 'inline-table',
      opacity: 1,
      borderTop: detailsOnly ? 'unset' : '2px solid #95220E',
      textAlign: 'left',
      marginTop: selectType ? '26px' : 'initial',
      marginBottom: detailsOnly ? 'unset' : '26px',
      marginRight: !selectType && i % 1 === 0 ? '26px' : 'initial',
      minWidth: detailsOnly ? 'unset' : `${compact ? 358 : 386}px`,
      maxWidth: detailsOnly ? 'unset' : '386px',
      minHeight: detailsOnly ? 'unset' : compactRemote ? '68px' : '245px',
      maxHeight: detailsOnly ? 'unset' : needsExpand ? '500px' : '289px',
      zIndex: selectType ? 92 : 'inherit',
      position: selectType ? 'fixed' : 'inherit',
      left: selectType ? '28px' : 'inherit',
      top: selectType ? `${height - (needsExpand ? 432 : 271)}px` : 'inherit',
      WebkitUserSelect: 'none'
    };

    if (detailsOnly) {
      Object.assign(visibleStyle, {
        paddingTop: '0px',
        paddingLeft: '0px',
        paddingRight: '0px'
      });
    }

    let dropdown = (
      <BasicDropdown
      height={height}
      icon="ellipsis horizontal"
      showValue={null}
      persist={edit || this.state.positionSelect}
      options={leftOptions}
      detailsOnly={detailsOnly} />
    );

    return (
      <div
      className="ui segment"
      style={visibleStyle}
      data-place="left"
      data-tip={this.props.isVisible && !selectType && compactRemote ? ReactDOMServer.renderToString(this.renderDetails()) : null}>
        {this.props.isVisible && !detailsOnly ? (
          <h3
          style={{
            fontSize: name.length > 28 ? '14px' : '17.92px',
            textAlign: 'center',
            maxHeight: '23px',
            color: (location.playerPosition
              || (location.positions && location.positions.length > 0 && location.positions[0].playerPosition))
              && !location.manuallyEntered ? 'inherit' : '#7fa0ff',
            cursor: selectType ? 'default' : 'pointer'
          }}
          onClick={() => state.set({selectedLocation: location, selectedGalaxy: location.galaxy})}>
            {name}
            {this.state.profile ?
            <div onClick={this.handleBadgeClick} className="floating ui black label LocationBox__badge">{this.state.profile.exp}</div> : null}
          </h3>
        ) : null}

        {this.props.isVisible && !detailsOnly ? <i className={`${upvote ? '' : 'empty '}star icon LocationBox__starStyle`} onClick={() => onFav(location)} /> : null}
        {this.props.isVisible && !detailsOnly ? (
          <div
          className="LocationBox__iconsContainer"
          style={{
            right: compact ? '143px' : 'initial',
          }}>
            {leftOptions.length > 0 ? dropdown : null}
            {location.base ? (
              <span
              data-tip={tip('Base')}
              className="LocationBox__iconsSpan"
              style={{left: `${leftOptions.length > 0 ? 26 : 0}px`}}>
                <img className="LocationBox__baseStyle" src={baseIcon} />
              </span>
            ) : null}
            {isSpaceStation ? (
              <span
              data-tip={tip('Space Station')}
              className="LocationBox__iconsSpan"
              style={{left: `${leftOptions.length > 0 ? 26 : 0}px`}}>
                <img className="LocationBox__baseStyle" src={spaceStationIcon} />
              </span>
            ) : null}
          </div>
        ) : null}
        {positionEdit ?
        <div
        className="LocationBox__PositionEditContainer">
          <div className="ui segment LocationBox__uiSegmentEditStyle">
            {map(location.positions, (position, i) => {
              return (
                <div
                key={i}
                className="ui input"
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
            <div className="col-xs-12 LocationBox__inputCol">
              <div className="row">
                <div className="col-xs-6">
                  <Button onClick={this.handlePositionSave}>
                    {updating ? 'Updating...' : 'Update Location'}
                  </Button>
                </div>
                <div className="col-xs-6">
                  <Button onClick={this.togglePositionEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        : edit && this.props.isVisible ? (
          <div>
            <div className="ui segment LocationBox__uiSegmentEditStyle">
              <div className="ui input">
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
              <div className="ui input">
                <div className="row">
                  <textarea
                  className="LocationBox__textareaStyle"
                  value={this.state.description}
                  onChange={this.handleDescriptionChange}
                  maxLength={200}
                  placeholder="Description... (200 character limit)" />
                </div>
              </div>
              <div className="ui input">
                <div className="row">
                  <div className="col-xs-8 LocationBox__inputCol">
                    <SearchField
                    className="LocationBox__inputStyle"
                    resultsClassName="LocationBox__tagResultsContainer"
                    resultClassName="LocationBox__tagItem"
                    value={this.state.tagName}
                    placeholder="Tag Name"
                    resultsPrefix=""
                    onChange={this.handleTagNameChange}
                    onEnter={this.handleAddTag} />
                  </div>
                  <div className="col-xs-4 LocationBox__addTagButtonContainer">
                    <Button
                    className="LocationBox__addTagButton"
                    onClick={this.handleAddTag}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
              <div className="ui input">
                <div className="row LocationBox__tagRow">
                  {map(tags, (tag) => {
                    return (
                      <div
                      key={tag}
                      className="ui black label LocationBox__tag">
                        {tag}
                        <span onClick={() => this.handleRemoveTag(tag)}>x</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-xs-12 LocationBox__inputCol">
                <div className="row">
                  <div className="col-xs-6">
                    <Button onClick={() => onSubmit(this.state.name, this.state.description, this.state.tags)}>
                      {updating ? 'Updating...' : this.state.limit ? `Limit exceeded (${this.state.description.length} characters)` : 'Update Location'}
                    </Button>
                  </div>
                  <div className="col-xs-6">
                    <Button onClick={this.toggleEditDetails}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : selectType || (this.props.isVisible && !compactRemote) ? (
          <div>
            {detailsOnly ? dropdown : null}
            {this.renderDetails()}
          </div>
        ) : null}
      </div>
    );
  }
}

export default LocationBox;
