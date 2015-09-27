//contains the jquery document.ready callback, which starts the application

//a global variable to store our running AugmentedBIM App
var myAugmentedBIM;

//fires when everything has loaded
$(document).ready(function () {

    //load our sample JSON file from disk
    $.getJSON("../content/box.json", function (data) {

        //once loaded, initialize an AugmentedBIM viewer 
        myAugmentedBIM = new AugmentedBIM(data, function (app) {

            //callback functions here - if any


        });
    });
});