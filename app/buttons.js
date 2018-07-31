import React from 'react';

let style = {
  left: '9px',
  letterSpacing: '3px',
  fontSize: '16px',
  padding: '3px 3px',
  textAlign: 'center',
  cursor: 'pointer'
};

class Button extends React.Component {
  static defaultProps = {
    style: {}
  };
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
      style={Object.assign({}, style, this.props.style)}
      onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
};

export default Button;