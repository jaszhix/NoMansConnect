import React from 'react';
import {cleanUp} from './utils';

interface ButtonProps {
  className: string;
  style: CSSProperties;
  onClick: React.MouseEventHandler;
}

interface ButtonState {
  hover: boolean;
}

class Button extends React.Component<ButtonProps, ButtonState> {
  static defaultProps = {
    className: '',
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
      className={`ui segment Button__div ${this.props.className}`}
      onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
};

export default Button;