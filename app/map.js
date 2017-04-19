import state from './state';
import React from 'react';
import autoBind from 'react-autobind';
import {ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend} from 'recharts';
import _ from 'lodash';
import $ from 'jquery';
import each from './each';
import {BasicDropdown} from './dropdowns';
import Loader from './loader';

class TooltipChild extends React.Component {
  constructor(props) {
    super(props);
  }
  render(){
    if (this.props.active) {
      return (
        <div className="ui segments" style={{
          display: 'inline-table',
          textAlign: 'left',
          fontFamily: 'geosanslight-nmsregular',
          fontSize: '16px'
        }}>
          {this.props.payload[0].payload.user ?
          <div
          className="ui segment"
          style={{padding: '3px 5px', fontWeight: '600'}}>
            {`${this.props.payload[0].payload.user}`}
          </div> : null}
          {_.map(this.props.payload, (item, i)=>{
            return (
              <div
              key={i}
              className="ui segment"
              style={{padding: '0px 5px'}}>
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
      center: [{
        x: 2047,
        y: 2047,
        z: 127
      }],
      size: 480,
      zRange: this.props.mapZoom ? [14, 64] : [22, 64],
      ticks: this.props.mapZoom ? [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096] : [0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4096],
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
    this.tickFormatter = ()=>'';
    autoBind(this);
  }
  componentDidMount(){
    this.handleMapWorker();
    this.handlePostMessage(this.props);
    this.handlePostMessageSize(this.props);
    this.handlePostMessageSelect(this.props);
  }
  componentWillReceiveProps(nextProps){
    if (nextProps.mapZoom !== this.props.mapZoom
      || nextProps.width !== this.props.width
      || nextProps.height !== this.props.height) {
      this.handlePostMessageSize(nextProps);
    } else if (nextProps.selectedGalaxy !== this.props.selectedGalaxy
      || nextProps.storedLocations !== this.props.storedLocations
      || nextProps.remoteLocations !== this.props.remoteLocations) {
      this.handlePostMessage(nextProps);
    } else if (!_.isEqual(nextProps.selectedLocation, this.props.selectedLocation)) {
      this.handlePostMessageSelect(nextProps);
    }
  }
  handlePostMessage(p){
    window.mapWorker.postMessage({
      selectOnly: false,
      p: {
        mapZoom: p.mapZoom,
        storedLocations: p.storedLocations,
        remoteLocations: p.remoteLocations,
        selectedLocation: p.selectedLocation,
        selectedGalaxy: p.selectedGalaxy,
        currentLocation: p.currentLocation,
        username: p.username,
        width: p.width,
        height: p.height,
        show: p.show
      },
      opts: {
        locations: true,
        selectedLocation: true
      }
    });
  }
  handlePostMessageSize(p){
    window.mapWorker.postMessage({
      selectOnly: false,
      p: {
        mapZoom: p.mapZoom,
        width: p.width,
        height: p.height,
        show: p.show
      },
      opts: {
        size: true
      }
    });
  }
  handlePostMessageSelect(p){
    window.mapWorker.postMessage({
      p: {
        selectedLocation: p.selectedLocation,
        selectedGalaxy: p.selectedGalaxy,
        storedLocations: p.storedLocations,
        remoteLocations: p.remoteLocations,
        show: p.show
      },
      opts: {
        selectedLocation: true
      }
    });
  }
  handleMapWorker(){
    window.mapWorker.onmessage = (e)=>{
      console.log('MAP WORKER: ', e.data)
      this.setState(e.data, ()=>{
        if (this.props.init) {
          _.defer(()=>{
            $('.recharts-legend-item-text').css({position: 'relative', top: '3px'});
            each(this.props.show, (type, key)=>{
              $('.recharts-legend-item').each(function(){
                if ($(this).text() === key) {
                  $(this).addClass(key.split(' ').join('_'));
                }
              });
            });
            this.handleUpdateLegend();
          });
          this.props.onInit();
        }
      });
    }
  }
  handleSelect(symbol){
    let stateUpdate = {};
    let refStoredLocation = _.findIndex(this.props.storedLocations, {id: symbol.id});
    if (refStoredLocation !== -1) {
      stateUpdate = {selectedLocation: this.props.storedLocations[refStoredLocation]};
    }
    let refRemoteLocation = _.findIndex(this.props.remoteLocations.results, {id: symbol.id});
    if (refStoredLocation === -1 && refRemoteLocation !== -1) {
      stateUpdate = {selectedLocation: this.props.remoteLocations.results[refRemoteLocation].data}
    }

    state.set(stateUpdate, ()=>{
      _.defer(()=>this.handlePostMessageSelect(this.props));
    });
  }
  handleUpdateLegend(){
    each(this.props.show, (bool, name)=>{
      $(`.${name.split(' ').join('_')}`).css({
        opacity: bool ? '1' : '0.5'
      });
    });
  }
  handleLegendClick(e){
    this.props.show[e.payload.name] = !this.props.show[e.payload.name];
    state.set({show: this.props.show}, ()=>{
      if (e.payload.name === 'Center') {
        this.handlePostMessageSize(this.props);
      } else if (e.payload.name === 'Selected') {
        this.handlePostMessageSelect(this.props);
      } else {
        this.handlePostMessage(this.props);
      }
      this.handleUpdateLegend();
    });
  }
  render () {
    console.log('map render');
    return (
      <ScatterChart width={this.state.size} height={this.state.size} margin={this.chartMargin}>
        <XAxis tickLine={false} tickFormatter={this.tickFormatter} ticks={this.state.ticks} domain={[0, 4096]} type="number" dataKey="x" range={this.state.range} name="X" label="X"/>
        <YAxis tickLine={false} tickFormatter={this.tickFormatter} ticks={this.state.ticks} domain={[0, 4096]} type="number" dataKey="y" range={this.state.range} name="Z" label="Z"/>
        <ZAxis dataKey="z" range={this.state.zRange} name="Y" />
        <CartesianGrid />
        <Tooltip cursor={this.tooltipCursor} content={<TooltipChild />}/>
        <Legend align="right" wrapperStyle={this.legendStyle} iconSize={12} onClick={this.handleLegendClick}/>
        <Scatter name="Shared" data={this.state.remoteLocations} fill="#0080db" shape="circle" isAnimationActive={false} onClick={this.handleSelect}/>
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
      right: '54px',
      top: '16px'
    };
    autoBind(this);
  }
  componentDidMount(){
    this.buildGalaxyOptions(this.props, true);
  }
  componentWillReceiveProps(nextProps){
    if (nextProps.storedLocations !== this.props.storedLocations
      || nextProps.remoteLocations !== this.props.remoteLocations
      || !_.isEqual(nextProps.selectedLocation, this.props.selectedLocation)) {
      this.buildGalaxyOptions(nextProps, false);
    }
  }
  shouldComponentUpdate(nextProps, nextState){
    return (nextProps.mapZoom !== this.props.mapZoom
      || nextProps.mapLines !== this.props.mapLines
      || nextProps.galaxyOptions !== this.props.galaxyOptions
      || nextProps.selectedGalaxy !== this.props.selectedGalaxy
      || nextProps.storedLocations !== this.props.storedLocations
      || nextProps.width !== this.props.width
      || nextProps.height !== this.props.height
      || nextProps.remoteLocations.results !== this.props.remoteLocations.results
      || !_.isEqual(nextProps.selectedLocation, this.props.selectedLocation)
      || nextProps.currentLocation !== this.props.currentLocation
      || nextState.init !== this.state.init)
  }
  buildGalaxyOptions(p, init){
    let options = [];
    let currentGalaxy = 0;
    each(p.storedLocations, (location)=>{
      if (location.id === p.currentLocation && location.galaxy) {
        currentGalaxy = location.galaxy;
      }
      options.push({id: location.galaxy});
    });
    if (p.remoteLocations && p.remoteLocations.results) {
      each(p.remoteLocations.results, (location)=>{
        if (location.data.galaxy) {
          options.push({id: location.data.galaxy});
        }
      });
    }
    if (p.selectedLocation && p.selectedLocation.galaxy) {
      options.push({id: p.selectedLocation.galaxy});
    }
    options = _.chain(options).uniqBy('id').orderBy('id', 'asc').value();
    each(options, (option, i)=>{
      options[i].label = state.galaxies[option.id];
      options[i].onClick = (id)=>state.set({selectedGalaxy: id});
    });
    state.set({
      galaxyOptions: options,
      selectedGalaxy: init ? currentGalaxy : p.selectedGalaxy
    });
  }
  handleInit(){
    this.setState({init: false});
  }
  render(){
    let p = this.props;
    let compact = p.width <= 1212 || p.height <= 850;
    let leftOptions = [
      {
        id: 'mapLines',
        label: `Show Path: ${p.mapLines ? 'On' : 'Off'}`,
        onClick: ()=>state.set({mapLines: !p.mapLines})
      },
      {
        id: 'mapZoom',
        label: `Enlarge Map: ${p.mapZoom ? 'On' : 'Off'}`,
        onClick: ()=>state.set({mapZoom: !p.mapZoom})
      }
    ];

    return (
      <div className="ui segment" style={{
        background: p.mapZoom && (p.width > 1804 && p.selectedLocation || p.width > 1698 && !p.selectedLocation) ? `rgba(23, 26, 22, 0.9)` : 'rgb(23, 26, 0.95)',
        display: 'inline-table',
        borderTop: '2px solid #95220E',
        textAlign: 'center',
        position: p.mapZoom ? 'absolute' : 'inherit',
        top: p.mapZoom ? '-11px' : 'inherit',
        left: p.mapZoom ? p.selectedLocation ? '123px' : '15px' : 'inherit',
        WebkitTransition: 'left 0.1s, background 0.1s',
        zIndex: p.mapZoom ? '90' : 'inherit',
        WebkitUserSelect: 'none',
        minWidth: '360px',
        minHeight: '360px',
        opacity: this.state.init ? '0' : '1'
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
          left: compact ? 'initial' : '48px',
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
          <ThreeDimScatterChart
          mapZoom={p.mapZoom}
          mapLines={p.mapLines}
          show={p.show}
          selectedGalaxy={p.selectedGalaxy}
          storedLocations={p.storedLocations}
          width={p.width}
          height={p.height}
          remoteLocations={p.remoteLocations}
          selectedLocation={p.selectedLocation}
          currentLocation={p.currentLocation}
          username={p.username}
          init={this.state.init}
          onInit={this.handleInit} />
        </div>
      </div>
    );
  }
};

export default GalacticMap;