import React from 'react';
import ReactMarkdown from 'react-markdown';
import openExternal from 'open-external';
import _ from 'lodash';
import {locationItemStyle} from './constants';

class Item extends React.Component {
  constructor(props) {
    super(props);
  }
  handleDescClick(e){
    e.preventDefault();
    openExternal(e.target.href);
  }
  componentDidMount(){
    if (this.props.label === 'Description') {
      _.defer(()=>{
        if (this.refs.desc) {
          this.refs.desc.addEventListener('click', this.handleDescClick);
        }
      });
    }
  }
  componentWillUnmount(){
    window.removeEventListener('resize', this.onWindowResize);
    if (this.refs.desc) {
      this.refs.desc.removeEventListener('click', this.handleDescClick);
    }
  }
  render(){
    if (this.props.label === 'Description') {
      return (

        <div
        ref="desc"
        className="Item__wrapperStyle"
        style={locationItemStyle}>
          <ReactMarkdown className="md-p" source={this.props.value} />
        </div>
      );
    } else {
      return (
        <div
        className="Item__wrapperStyle"
        style={locationItemStyle}>
          <span className="Item__labelStyle">{`${this.props.label}`}</span> <span className="Item__valueStyle">{this.props.value}</span>
        </div>
      );
    }
  }
};

export default Item;