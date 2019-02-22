var btn = $('#knock');

function reKnock() {
  btn.text('Knocked');
      setTimeout(function() {
        btn.text('Knock again');
      }, 1000);
}
btn.on('click', function(evt) {

  $.ajax({
    url: 'http://bb8.mihui.net/studio/bell', 
    success: function(xHR) {
      console.log(xHR);
      reKnock();
    }, 
    error: function() {
      reKnock();
    }
  });
});