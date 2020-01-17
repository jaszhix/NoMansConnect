import React from 'react';
import {map} from '@jaszhix/utils';

const fill: number[] = Array(64).fill('');

interface LoaderProps {
  loading: boolean;
}

class Loader extends React.Component<LoaderProps> {
  render() {
    const {loading} = this.props;

    return (
      <div className={`loader${loading ? '' : ' initial'}`}>

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

        {loading ? <div className="text">{this.props.loading}</div> : null}
      </div>
    );
  }
};

export default Loader;