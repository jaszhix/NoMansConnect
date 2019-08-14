import React from 'react';
import {map} from '@jaszhix/utils';

const textStyle: CSSProperties = {
  position: 'relative',
  top: '140px',
  fontSize: '28px',
  width: '300px'
};

const fill: number[] = Array(64).fill('');

interface LoaderProps {
  loading: boolean;
}

class Loader extends React.Component<LoaderProps> {
  render() {
    let style: CSSProperties = !this.props.loading ? {
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