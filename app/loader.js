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
  render(){
    return (
      <div className="loader">
        {map(fill, (v, i)=>{
          return (
            <span key={i} />
          );
        })}
        <div className="pulsing">
          <div className="circle"></div>
          <div className="circle"></div>
          <div className="circle"></div>
          <div className="circle"></div>
        </div>
        <div style={textStyle}>{this.props.loading}</div>
      </div>
    );
  }
};

export default Loader;