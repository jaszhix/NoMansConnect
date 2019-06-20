import React from 'react';
import {cleanUp} from './utils';

let style: CSSProperties = {
  left: '9px',
  letterSpacing: '3px',
  fontSize: '16px',
  padding: '3px 3px',
  textAlign: 'center',
  cursor: 'pointer'
};

interface ButtonProps {
  style: CSSProperties;
  onClick: React.MouseEventHandler;
}

interface ButtonState {
  hover: boolean;
}

class Button extends React.Component<ButtonProps, ButtonState> {
  static defaultProps = {
    style: {}
  };
  constructor(props) {
    super(props);
    this.state = {
      hover: false,
    };
  }
  componentWillUnmount() {
    cleanUp(this);
  }
  render() {
    return (
      <div
      className="ui segment Button__div"
      style={Object.assign({}, style, this.props.style)}
      onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
};

export default Button;