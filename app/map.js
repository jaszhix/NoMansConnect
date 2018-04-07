import state from './state';
import React from 'react';
import {ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend} from 'recharts';
import {isArray, cloneDeep, uniqBy, filter, defer, delay, isEqual} from 'lodash';
import v from 'vquery';
import {BasicDropdown} from './dropdowns';
import Map3D from './map3d';
import {uuidV4, cleanUp} from './utils';
import {each, map, findIndex} from './lang';

const toolTipHeaderStyle = {
  padding: '3px 5px',
  fontWeight: '600',
  borderBottom: '1px solid rgb(149, 34, 14)'
};
const toolTipChildStyle = {
  fontWeight: '500'
}
const toolTipExploredStyle = {
  padding: '0px 5px'
};
const toolTipContainerStyle = {
  display: 'inline-table',
  textAlign: 'left',
  fontFamily: 'geosanslight-nmsregular',
  fontSize: '16px',
  borderTop: '2px solid rgb(149, 34, 14)',
  letterSpacing: '3px',
};

const travelCurrentLocation = () => {
  window.travelToCurrent = true;
};

class TooltipChild extends React.Component {
  constructor(props) {
    super(props);
  }
  componentWillReceiveProps() {
    cleanUp(this);
  }
  render() {
    if (this.props.active || this.props.isSelected) {
      return (
        <div className="ui segments" style={toolTipContainerStyle}>
          {this.props.payload[0].payload.user ?
          <div
          className="ui segment"
          style={toolTipHeaderStyle}>
            {`${this.props.payload[0].payload.user}`}
          </div> : null}
          {this.props.payload[0].payload.planetData ? map(this.props.payload[0].payload.planetData, (sector, i) => {
            return (
              <div
              key={i}
              className="ui segment"
              style={toolTipHeaderStyle}>
                {sector.username}
                {map(sector.entries, (id, z) => {
                  return (
                    <div
                    style={toolTipChildStyle}
                    key={z}>
                      {id}
                    </div>
                  );
                })}
              </div>
            );
          }) : map(this.props.payload, (item, i) => {
            return (
              <div
              key={i}
              className="ui segment"
              style={toolTipExploredStyle}>
                {`${item.name}: ${item.name === 'Z' ? (0, 4096) - item.value : item.value}`}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }
};

class ThreeDimScatterChart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentLocation: [],
      locations: [],
      remoteLocations: [],
      selectedLocation: [],
      favLocations: [],
      baseLocations: [],
      ps4Locations: [],
      center: [{
        x: 2047,
        y: 2047,
        z: 127
      }],
      size: 480,
      zRange: [14, 64],
      ticks: [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096],
      range: [0, 4096]
    };
    this.legendStyle = {
      fontFamily: 'geosanslight-nmsregular',
      fontSize: '16px',
      right: '0px'
    };
    this.tooltipCursor = {strokeDasharray: '3 3'};
    this.chartMargin = {
      top: 20,
      right: 20,
      bottom: 20
    };
    this.tickFormatter = () => '';
  }
  componentDidMount() {
    this.connections = [
      state.connect(['width', 'height', 'remoteLocationsColumns'], () => this.handlePostMessageSize()),
      state.connect(['selectedGalaxy', 'storedLocations', 'remoteLocations'], () => this.handlePostMessage()),
      state.connect({
        selectedLocation: () => this.handlePostMessageSelect()
      })
    ];
    this.handleMapWorker();
    this.handlePostMessage();
    this.handlePostMessageSize();
  }
  componentWillUnmount() {
    this.willUnmount = true;
    each(this.connections, (connection) => {
      state.disconnect(connection);
    });
    cleanUp(this);
  }
  shouldComponentUpdate(nP, nS) {
    return isEqual(this.props, nP) || !isEqual(this.state, nS)
  }
  getLocationsByTranslatedId = (locations) => {
    if (isArray(locations)) {
      locations = {results: locations}
    }
    let systems = uniqBy(locations.results, (location) => {
      location = location.data ? location : {data: location};
      return location.data.translatedX && location.data.translatedY && location.data.translatedZ;
    });
    each(systems, (location, i) => {
      systems[i] = location.data ? location : {data: location};
      location = systems[i];
      let planets = filter(locations.results, (planet) => {
        planet = planet.data ? planet : {data: planet};
        return (location.data.translatedX === planet.data.translatedX
          && location.data.translatedY === planet.data.translatedY
          && location.data.translatedZ === planet.data.translatedZ);
      });
      let planetData = [];
      each(planets, (planet) => {
        planet = planet.data ? planet : {data: planet};
        if (!planetData[planet.data.username]) {
          planetData[planet.data.username] = [];
        }
        let label = planet.data.name ? planet.data.name : planet.data.id;
        let refPlanetData = findIndex(planetData, item => item.username === planet.data.username);
        if (refPlanetData > -1) {
          let refEntry = planetData[refPlanetData].entries.indexOf(label);
          if (refEntry === -1) {
            planetData[refPlanetData].entries.push(label);
          }
        } else {
          planetData.push({
            username: planet.data.username,
            entries: [label]
          });
        }
      });
      location.data.planetData = planetData;
    });
    locations.results = systems;
    return locations;
  }
  handlePostMessage = () => {
    if (!state.navLoad) {
      state.set({navLoad: true});
    }
    window.mapWorker.postMessage({
      selectOnly: false,
      p: {
        remoteLocations: state.remoteLocations,
        selectedLocation: state.selectedLocation,
        selectedGalaxy: state.selectedGalaxy,
        currentLocation: state.currentLocation,
        username: state.username,
        show: state.show
      },
      opts: {
        locations: true
      }
    });
  }
  handlePostMessageSize = () => {
    window.mapWorker2.postMessage({
      selectOnly: false,
      p: {
        width: state.width,
        height: state.height,
        remoteLocationsColumns: state.remoteLocationsColumns,
        show: state.show
      },
      opts: {
        size: true
      }
    });
  }
  handlePostMessageSelect = () => {
    window.mapWorker2.postMessage({
      p: {
        selectedLocation: state.selectedLocation,
        selectedGalaxy: state.selectedGalaxy,
        remoteLocations: state.remoteLocations,
        show: state.show
      },
      opts: {
        selectedLocation: true
      }
    });
  }
  handleMapWorker = () => {
    const handler = (e) => {
      if (this.willUnmount) {
        return;
      }
      let setState = (data) => {
        this.setState(data, () => {
          if (this.props.init) {
            defer(() => {
              v('.recharts-legend-item-text').css({position: 'relative', top: '3px'});
              each(this.props.show, (type, key) => {
                v('.recharts-legend-item').each(function(el){
                  let _el = v(el);
                  if (_el.text()[0] === key) {
                    _el.addClass(key);
                  }
                });
              });
              this.handleUpdateLegend();
            });
            this.props.onInit();
          }
          state.set({navLoad: false});
        });
      };
      if (e.data.fromSelected) {
        if (e.data.fromSelected.globalState) {
          state.set(e.data.fromSelected.globalState, () => setState({selectedLocation: e.data.fromSelected.selectedLocation}));
        } else {
          setState({selectedLocation: e.data.fromSelected.selectedLocation})
        }
      } else {
        setState(e.data);
      }
    };
    window.mapWorker.onmessage = handler;
    window.mapWorker2.onmessage = handler;
  }
  handleSelect = (symbol) => {
    let stateUpdate = {};
    let sector;
    let hexSector;
    let results = [];

    each(state.remoteLocations.results, (location) => {
      if (!location) {
        return;
      }
      location = location.data ? location : {
        data: location,
        teleports: location.teleports ? location.teleports : 0,
        id: uuidV4(),
        image: location.image ? location.image : '',
        name: location.name ? location.name : '',
        description: location.description ? location.description : ''
      };
      sector = `${location.data.translatedZ}:${location.data.translatedY}:${location.data.translatedX}`;
      let hexArr = location.data.translatedId.split(':');
      hexArr.pop();
      hexSector = hexArr.join(':');
      if (sector === symbol.id) {
        results.push(location);
      }
    });
    let remoteLen = results.length;
    stateUpdate = {selectedLocation: results[0].data ? results[0].data : results[0]};
    if (remoteLen > 1) {
      stateUpdate = {
        searchCache: {
          results: results,
          count: remoteLen,
          multipleSelectedLocations: true
        },
        searchInProgress: true,
        search: `Sector ${hexSector}`
      };
    }
    state.set(stateUpdate);
  }
  handleUpdateLegend = () => {
    each(this.props.show, (bool, name) => {
      v(`.${name}`).css({
        opacity: bool ? '1' : '0.5'
      });
    });
  }
  handleLegendClick = (e) => {
    this.props.show[e.payload.name] = !this.props.show[e.payload.name];
    state.set({show: this.props.show, navLoad: true}, () => {
      if (e.payload.name === 'Center') {
        this.handlePostMessageSize(this.props);
      } else if (e.payload.name.indexOf('Selected') > -1) {
        this.handlePostMessageSelect(this.props);
      } else {
        this.handlePostMessage(this.props);
      }
      this.handleUpdateLegend();
    });
  }
  render = () => {
    return (
      <ScatterChart width={this.state.size} height={this.state.size} margin={this.chartMargin}>
        <XAxis tickLine={false} tickFormatter={this.tickFormatter} ticks={this.state.ticks} domain={[0, 4096]} type="number" dataKey="x" range={this.state.range} name="X" label="X"/>
        <YAxis tickLine={false} tickFormatter={this.tickFormatter} ticks={this.state.ticks} domain={[0, 4096]} type="number" dataKey="y" range={this.state.range} name="Z" label="Z"/>
        <ZAxis dataKey="z" range={this.state.zRange} name="Y" />
        <CartesianGrid />
        <Tooltip cursor={this.tooltipCursor} content={<TooltipChild />} selectedLocation={this.props.selectedLocation}/>
        <Legend align="right" wrapperStyle={this.legendStyle} iconSize={12} onClick={this.handleLegendClick}/>
        <Scatter name="Shared" data={this.state.remoteLocations} fill="#0080db" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="PS4" data={this.state.ps4Locations} fill="#0039db" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Explored" data={this.state.locations} fill="#5fcc93" shape="circle" line={this.props.mapLines} isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Center" data={this.state.center} fill="#ba3935" shape="circle" isAnimationActive={false}/>
        <Scatter name="Base" data={this.state.baseLocations} fill="#9A9D99" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
        <Scatter name="Favorite" data={this.state.favLocations} fill="#9c317c" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
        <Scatter name="Current" data={this.state.currentLocation} fill="#FFF" shape="circle" isAnimationActive={false} onClick={this.handleSelect} />
        <Scatter name="Selected" data={this.state.selectedLocation} fill="#ffc356" shape="circle" isAnimationActive={false}/>
      </ScatterChart>
    );
  }
};

class GalacticMap extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      init: true
    };
    this.mapWrapper = {
      position: 'relative',
      left: '-18px'
    };
    this.leftDropdownWrapper = {
      position: 'absolute',
      right: this.props.map3d ? '38px' : '54px',
      top: '16px'
    };

  }
  componentWillMount() {
    window.mapWorker3.onmessage = (e) => {
      state.set(e.data.buildGalaxyOptions, () => {
        if (e.data.init) {
          travelCurrentLocation();
        }
      });
    };
    state.set({navLoad: true});
    this.connections = [
      state.connect(['storedLocations', 'remoteLocations', 'selectedLocation'], () => this.buildGalaxyOptions(false)),
      state.connect(['selectedGalaxy', 'selectedLocation'], () => {
        if (this.props.map3d) {
          this.travelToCenter();
        }
      })
    ];
  }
  componentWillUnmount() {
    each(this.connections, (connection) => {
      state.disconnect(connection);
    });
  }
  buildGalaxyOptions = (init) => {
    window.mapWorker3.postMessage({
      buildGalaxyOptions: {
        init,
        storedLocations: state.storedLocations,
        remoteLocations: state.remoteLocations,
        selectedLocation: state.selectedLocation,
        selectedGalaxy: state.selectedGalaxy,
        currentLocation: state.currentLocation,
        ps4User: state.ps4User,
        galaxies: state.galaxies
      }
    });
  }
  handleInit = () => {
    if (!state.currentLocation && !state.ps4User) {
      delay(() => this.handleInit(), 25);
      return;
    }
    this.setState({init: false}, () => defer(() => this.buildGalaxyOptions(true)));
  }
  travelToCenter = () => {
    window.travelTo = [0, 2, 0];
  }
  travelToGalacticHub = () => {
    this.props.onSearch();
    window.travelTo = [-3474, 865, 5516];
  }
  travelToAGT = () => {
    this.props.onSearch();
    window.travelTo = [2934, 71, -5277];
  }
  travelToPilgrimStar = () => {
    this.props.onSearch();
    window.travelTo = [-1770, 492, -6420];
  }
  render() {
    let p = this.props;
    if (!p.selectedGalaxy < 0) {
      return null;
    }
    let compact = p.width <= 1212 || p.height <= 850;
    let leftOptions = [
      {
        id: 'map3d',
        label: `3D Map (BETA): ${p.map3d ? 'On' : 'Off'}`,
        onClick: () => state.set({map3d: !p.map3d})
      }
    ];
    if (p.map3d) {
      leftOptions.push({
        id: 'mapDrawDistance',
        label: `Draw Distance: ${p.mapDrawDistance ? 'High' : 'Medium'}`,
        onClick: () => state.set({mapDrawDistance: !p.mapDrawDistance}, p.onRestart)
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Go to Center`,
        onClick: this.travelToCenter
      });
      leftOptions.push({
        id: 'travelToCurrent',
        label: `Travel to Current Location`,
        onClick: travelCurrentLocation
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Travel to Galactic Hub`,
        onClick: () => {
          state.set({
            selectedGalaxy: 0,
            search: '0469:0081:0D6D:0211'
          }, this.travelToGalacticHub);
        }
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Travel to Pilgrim Star`,
        onClick: () => {
          state.set({
            selectedGalaxy: 0,
            search: '064A:0082:01B9:009A'
          }, this.travelToPilgrimStar);
        }
      });
      leftOptions.push({
        id: 'travelTo',
        label: `Travel to Alliance of Galactic Travellers HQ`,
        onClick: () => {
          state.set({
            selectedGalaxy: 0,
            search: '0B11:0081:02EB:01F2'
          }, this.travelToAGT);
        }
      });
    } else {
      leftOptions.push({
        id: 'mapLines',
        label: `Show Path: ${p.mapLines ? 'On' : 'Off'}`,
        onClick: () => state.set({mapLines: !p.mapLines})
      });
    }

    let remoteLocationsWidth;
    if (p.remoteLocationsColumns === 1) {
      remoteLocationsWidth = 441;
    } else if (p.remoteLocationsColumns === 2) {
      remoteLocationsWidth = 902;
    } else {
      remoteLocationsWidth = 1300;
    }

    let size = p.width - (remoteLocationsWidth + 438);
    let maxSize = p.height - 105;
    size = size > maxSize ? maxSize : size < 260 ? 260 : size;

    return (
      <div
      className="ui segment"
      style={{
        background: 'rgba(23, 26, 22, 0.9)',
        display: 'inline-table',
        borderTop: '2px solid #95220E',
        textAlign: 'center',
        position: 'absolute',
        top: '-11px',
        left: '15px',
        WebkitTransition: 'left 0.1s, background 0.1s, opacity 0.2s',
        zIndex: p.map3d ? '0' : '90',
        WebkitUserSelect: 'none',
        minWidth: '360px',
        minHeight: '360px',
        opacity: this.state.init && !p.map3d ? '0' : '1'
      }}>
        <h3 style={{textAlign: compact ? 'left' : 'inherit'}}>Galactic Map</h3>
        {p.galaxyOptions.length > 0 ?
        <div style={this.leftDropdownWrapper}>
          <BasicDropdown
          height={p.height}
          options={p.galaxyOptions}
          selectedGalaxy={p.selectedGalaxy} />
        </div> : null}
        <div style={{
          position: 'absolute',
          left: compact ? 'initial' : p.map3d ? '16px' : '48px',
          right: compact ? '143px' : 'initial',
          top: '16px'
        }}>
          <BasicDropdown
          icon="ellipsis horizontal"
          showValue={null}
          persist={true}
          options={leftOptions} />
        </div>
        <div style={this.mapWrapper}>
          {p.map3d ?
          <Map3D
          size={size}
          selectedGalaxy={p.selectedGalaxy}
          storedLocations={p.storedLocations}
          remoteLocationsColumns={p.remoteLocationsColumns}
          remoteLocations={p.remoteLocations}
          selectedLocation={p.selectedLocation}
          searchCache={p.searchCache}
          currentLocation={p.currentLocation}
          mapDrawDistance={p.mapDrawDistance} />
          :
          <ThreeDimScatterChart
          size={size}
          mapLines={p.mapLines}
          show={p.show}
          selectedGalaxy={p.selectedGalaxy}
          storedLocations={p.storedLocations}
          width={p.width}
          height={p.height}
          remoteLocationsColumns={p.remoteLocationsColumns}
          remoteLocations={p.remoteLocations}
          selectedLocation={p.selectedLocation}
          currentLocation={p.currentLocation}
          username={p.username}
          init={this.state.init}
          onInit={this.handleInit} />}
        </div>
      </div>
    );
  }
};

export default GalacticMap;