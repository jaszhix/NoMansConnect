import {clipboard} from 'electron';
import fs from 'graceful-fs';
import path from 'path';
import log from './log';
import state from './state';
import axios from 'axios';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import autoBind from 'react-autobind';
import ReactTooltip from 'react-tooltip';
import {isEqual, isBoolean, defer, truncate, upperFirst, pullAt} from 'lodash';
import moment from 'moment';

import {css, tip, cleanUp, formatForGlyphs} from './utils';
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
  handleCancel() {
    this.props.onEdit();
  }
  componentDidMount() {
    this.getImage(this.props);
  }
  componentWillReceiveProps(nextProps) {
    if ((nextProps.selectType && !isEqual(nextProps.location, this.props.location) && this.scrollBox) || (nextProps.updating !== this.props.updating && nextProps.updating)) {
      if (this.scrollBox) {
        this.scrollBox.scrollTop = 0;
      }

      this.setState({name: '', description: '', image: ''});
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
  shouldComponentUpdate(nextProps, nextState) {
    let bool =
      !isEqual(nextProps.location, this.props.location) ||
      nextProps.favorites !== this.props.favorites ||
      nextProps.updating !== this.props.updating ||
      nextProps.enableVisibilityCheck !== this.props.enableVisibilityCheck ||
      nextProps.selectType === true ||
      nextProps.isVisible !== this.props.isVisible ||
      nextProps.scrollTop !== this.props.scrollTop ||
      (nextProps.compactRemote !== this.props.compactRemote && nextProps.isVisible) ||
      nextState.image !== this.state.image;
    if (!isBoolean(bool)) {
      // TBD
      return true;
    }
    return bool;
  }
  componentWillUnmount() {
    this.willUnmount = true;
    cleanUp(this);
  }
  getImage(p) {
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
  handleNameChange(e) {
    this.setState({name: e.target.value});
  }
  handleDescriptionChange(e) {
    this.setState({description: e.target.value});
  }
  getModMarkup(mods) {
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
  getRef(ref) {
    this.scrollBox = ref;
  }
  renderDetails() {
    let p = this.props;
    let scrollBoxStyle = p.compactRemote ? compactRemoteScrollBoxStyle : {};
    return (
      <div ref={this.getRef} style={scrollBoxStyle} className="LocationBox__scrollBoxStyle">
        {p.image && p.image.length > 0 ? (
          <div style={{textAlign: 'center'}}>
            {this.state.image ? <img className="LocationBox__imageStyle" src={this.state.image} onClick={() => state.set({selectedImage: this.state.image})} /> : null}
          </div>
        ) : null}
        {p.location.description ? <Item label="Description" value={p.location.description} /> : null}
        <Item label="Galactic Address" value={p.location.translatedId} />
        <Item label="Universe Address" value={p.location.id} />
        <Item label="Portal Address">
          {map(formatForGlyphs(p.location.translatedId), (glyph, i) => {
              return <img key={i} src={glyphs[glyph]} style={glyphStyle} />;
          })}
        </Item>
        {p.location.galaxy !== undefined ? <Item label="Galaxy" value={state.galaxies[p.location.galaxy]} /> : null}
        {p.location.distanceToCenter ? <Item label="Distance to Center" value={`${p.location.distanceToCenter.toFixed(0)} LY / ${p.location.jumps} Jumps`} /> : null}
        {p.location.mode ? <Item label="Mode" value={upperFirst(p.location.mode)} /> : null}
        {p.location.teleports ? <Item label="Teleports" value={p.location.teleports} /> : null}
        {p.location.score ? <Item label="Favorites" value={p.location.score} /> : null}
        {p.name.length > 0 || p.location.baseData ? <Item label="Explored by" value={p.location.username} /> : null}
        <Item label="Created" value={moment(p.location.timeStamp).format('MMMM D, Y')} />
        {p.version != null ? <Item label="Version Compatibility" icon={p.version ? 'checkmark' : 'remove'} /> : null}
        {p.location.mods && p.location.mods.length > 0 && !p.compactRemote ? (
          <Item label={`Mods Used (${p.location.mods.length})`} dataPlace="top" dataTip={utils.tip(this.getModMarkup(p.location.mods))} />
        ) : null}
      </div>
    );
  }
  render() {
    let p = this.props;
    let refFav = findIndex(p.favorites, fav => {
      return fav === p.location.id;
    });
    let upvote = refFav !== -1 || location.update;
    let isOwnLocation = p.isOwnLocation && p.selectType && p.location.username === p.username;
    let deleteArg = p.location.image && p.location.image.length > 0;
    let compact = p.width && p.width <= 1212;
    let isSpaceStation = p.location.id[p.location.id.length - 1] === '0';
    let leftOptions = [];
    let name = p.edit && this.state.name.length > 0 ? this.state.name : p.location.username ? (p.name.length > 0 ? p.name : `${p.location.username} explored`) : 'Selected';

    if (p.location.id !== p.currentLocation && !p.ps4User) {
      leftOptions.push({
        id: 'teleport',
        label: (p.selectType && p.installing && p.installing === `tselected`) || (p.i && p.installing === `t${p.i}`) ? 'Working...' : 'Teleport Here',
        onClick: () => p.onTeleport(p.location, p.selectType ? 'selected' : p.i)
      });
    }
    if (p.location.base && p.location.baseData) {
      leftOptions.push({
        id: 'storeBase',
        label: 'Store Base',
        onClick: () => p.onSaveBase(p.location.baseData)
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
    } else if (p.selectType && p.location.id !== p.currentLocation && p.isSelectedLocationRemovable) {
      leftOptions.push({
        id: 'removeStored',
        label: 'Remove From Storage',
        onClick: () => p.onRemoveStoredLocation()
      });
    }
    leftOptions.push({
      id: 'copyAddress',
      label: 'Copy Address to Clipboard',
      onClick: () => clipboard.writeText(p.location.translatedId)
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
              color: p.location.playerPosition && !p.location.manuallyEntered ? 'inherit' : '#7fa0ff',
              cursor: p.selectType ? 'default' : 'pointer'
            }}
          onClick={() => state.set({selectedLocation: p.location, selectedGalaxy: p.location.galaxy})}>
            {name}
          </h3>
        ) : null}

        {this.props.isVisible ? <i className={`${upvote ? '' : 'empty '}star icon LocationBox__starStyle`} onClick={() => p.onFav(p.location)} /> : null}
        {this.props.isVisible ? (
          <div
          style={{
              position: 'absolute',
              left: '17px',
              right: compact ? '143px' : 'initial',
              top: '16px'
            }}>
            {leftOptions.length > 0 ? <BasicDropdown icon="ellipsis horizontal" showValue={null} persist={p.edit} options={leftOptions} /> : null}
            {p.location.base ? (
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
