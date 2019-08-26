import React from 'react';
import {cleanUp} from './utils';

interface ButtonProps {
  className?: string;
  disabled?: boolean;
  style?: CSSProperties;
  onClick?: React.MouseEventHandler;
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
    const {className, disabled, onClick, children} = this.props;
    return (
      <div
      className={`ui segment Button__div${disabled ? ' Button__disabled' : ''} ${className}`}
      onClick={disabled ? null : onClick}>
        {children}
      </div>
    );
  }
};

export default Button;