import React from 'react';
import {map} from './lang';

const textStyle = {
  position: 'relative',
  top: '140px',
  fontFamily: 'geosanslight-nmsregular',
  fontSize: '28px',
  width: '300px'
};
const fill = Array(64).fill('');
class Loader extends React.Component {
  render() {
    let style = !this.props.loading ? {
      fontSize: '6px',
      left: '0px',
      position: 'relative'
    } : null;
    return (
      <div className="loader" style={style}>
        {map(fill, (v, i)=>{
          return (
            <span key={i} />
          );
        })}
        <div className="pulsing">
          <div className="circle" />
          <div className="circle" />
          <div className="circle" />
          <div className="circle" />
        </div>
        {this.props.loading ? <div style={textStyle}>{this.props.loading}</div> : null}
      </div>
    );
  }
};

export default Loader;