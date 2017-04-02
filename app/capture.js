function screenshot(init, callback) {
  if (init) {
    callback('');
    return;
  }
  let screenConstraints = {
    mandatory: {
      chromeMediaSource: 'screen',
      maxHeight: 3440,
      maxWidth: 1440,
      minAspectRatio: 1.77
    },
    optional: []
  };

  let session = {
    audio: false,
    video: screenConstraints
  };

  let streaming = false;
  let canvas = document.createElement('canvas');
  let video = document.createElement('video');

  /*document.body.appendChild(canvas);
  document.body.appendChild(video);*/
  let width = screen.width;
  let height = 0;

  video.addEventListener('canplay', function() {
    if (!streaming) {
      height = video.videoHeight / (video.videoWidth / width);

      if (isNaN(height)) {
        height = width / (4 / 3);
      }

      video.setAttribute('width', width.toString());
      video.setAttribute('height', height.toString());
      canvas.setAttribute('width', width.toString());
      canvas.setAttribute('height', height.toString());
      streaming = true;

      let context = canvas.getContext('2d');
      if (width && height) {
        canvas.width = width / 4;
        canvas.height = height / 4;
        context.drawImage(video, 0, 0, width / 4, height / 4);
        callback(canvas.toDataURL('image/jpeg', 0.75));
      }
    }
  }, false);

  navigator['webkitGetUserMedia'](session, function(stream) {
    video.src = window.webkitURL.createObjectURL(stream);
    video.play();
  }, function() {
    callback('');
    console.error('Can\'t take a screenshot');
  });
}

module.exports = screenshot;