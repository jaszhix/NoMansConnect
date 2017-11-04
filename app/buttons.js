import React from 'react';

const style = {
  left: '9px',
  letterSpacing: '3px',
  fontFamily: 'geosanslight-nmsregular',
  fontSize: '16px',
  padding: '3px 3px',
  textAlign: 'center',
  cursor: 'pointer'
};

class Button extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hover: false,
    };
  }
  render() {
    return (
      <div
      className="ui segment Button__div"
      style={style}
      onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
};

export default Button;