var AugmentedBIM = function (data, callback) {

    var BIM = this;


    //*********************
    //*********************
    //*** Element Selection and attribute (user data) display.

    //attributes object.  Contains logic for element selection and attribute list population
    BIM.attributes = {};

    //top level property to track whether or not element attributes have been enabled
    BIM.attributesEnabled = false;

    //element list.  This gets populated after a json file is loaded, and is used to check for intersections
    BIM.attributes.elementList = [];

    //attributes list div - the div that we populate with attributes when an item is selected
    BIM.attributes.attributeListDiv = {};





    //////////////////////////////////////////////////////////////////////////////////
    //		Test if the browser support WebGL and getUserMedia
    //////////////////////////////////////////////////////////////////////////////////
    (function () {
        // TODO backport those 2 in Detector.js
        var hasGetUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia) ? true : false;
        var hasMediaStreamTrackSources = MediaStreamTrack.getSources ? true : false
        var hasWebGL = (function () { try { var canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch (e) { return false; } })();

        if (hasWebGL === false) {
            alert('your browser doesn\'t support navigator.getUserMedia()');
        }
        if (hasMediaStreamTrackSources === false) {
            alert('your browser doesn\'t support MediaStreamTrack.getSources()');
        }
        if (hasGetUserMedia === false) {
            alert('your browser doesn\'t support navigator.getUserMedia()');
        }
    })();

    //////////////////////////////////////////////////////////////////////////////////
    //		enabled/disable various parts
    //////////////////////////////////////////////////////////////////////////////////
    var detectMarkersEnabled = true;
    var markerToObject3DEnabled = true;
    var webglRenderEnabled = true;


    //////////////////////////////////////////////////////////////////////////////////
    //		init Stats for detectMarkers
    //////////////////////////////////////////////////////////////////////////////////
    var detectMarkersStats = new Stats();
    detectMarkersStats.setMode(1);
    $('body').get(0).appendChild(detectMarkersStats.domElement);
    detectMarkersStats.domElement.style.position = 'absolute';
    detectMarkersStats.domElement.style.bottom = '0px';
    detectMarkersStats.domElement.style.right = '0px';

    var renderStats = new Stats();
    renderStats.setMode(0);
    $('body').get(0).appendChild(renderStats.domElement);
    renderStats.domElement.style.position = 'absolute';
    renderStats.domElement.style.bottom = '0px';
    renderStats.domElement.style.left = '0px';

    

    //////////////////////////////////////////////////////////////////////////////////
    //		Init
    //////////////////////////////////////////////////////////////////////////////////

    // init renderer
    var renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        maxLights: 10,
        shadowMapEnabled: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // array of functions for the rendering loop
    var onRenderFcts = [];

    // init scene and camera
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 1000);
   
    camera.position.z = 2;

    BIM.camera = camera;
    //////////////////////////////////////////////////////////////////////////////////
    //		create a markerObject3D
    //////////////////////////////////////////////////////////////////////////////////
    var markerObject3D = new THREE.Object3D();
    scene.add(markerObject3D);

    //////////////////////////////////////////////////////////////////////////////////
    //		add an object in the markerObject3D
    //////////////////////////////////////////////////////////////////////////////////

    // add some debug display
    (function () {
        var geometry = new THREE.PlaneGeometry(1, 1, 10, 10);
        var material = new THREE.MeshBasicMaterial({
            wireframe: true
        });
        var mesh = new THREE.Mesh(geometry, material);
        //markerObject3D.add(mesh);

        var mesh2 = new THREE.AxisHelper;
        //markerObject3D.add(mesh2);
    })();


    //////////////////////////////////////////////////////////////////////////////////
    //		Parse our BIMacles file into something we can load into AugmentedBIM
    //////////////////////////////////////////////////////////////////////////////////

    var loader = new THREE.ObjectLoader();
    var myScene = loader.parse(data);

    while (myScene.children.length>0) {
        var child = myScene.children[0];
        if (child instanceof THREE.Mesh) {

            markerObject3D.add(child)
            BIM.attributes.elementList.push(child);

        }
    }
           

    //////////////////////////////////////////////////////////////////////////////////
    //		render the whole thing on the page
    //////////////////////////////////////////////////////////////////////////////////

    // handle window resize
    window.addEventListener('resize', function () {

        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;

        camera.updateProjectionMatrix()
    }, false);


    // render the scene
    onRenderFcts.push(function () {
        renderStats.begin();
        if (webglRenderEnabled === true) {
            renderer.render(scene, camera);
        }
        renderStats.end();
    });

    // run the rendering loop
    var previousTime = performance.now();
    requestAnimationFrame(function animate(now) {

        requestAnimationFrame(animate);

        onRenderFcts.forEach(function (onRenderFct) {
            onRenderFct(now, now - previousTime)
        });

        previousTime = now
    });

    //////////////////////////////////////////////////////////////////////////////////
    //		Do the Augmented Reality part
    //////////////////////////////////////////////////////////////////////////////////


    // init the marker recognition
    var jsArucoMarker = new THREEx.JsArucoMarker();

    // if no specific image source is specified, take the webcam by default
    if (location.hash === '') location.hash = '#webcam';

    // init the image source grabbing
    if (location.hash === '#video') {
        var videoGrabbing = new THREEx.VideoGrabbing();
        jsArucoMarker.videoScaleDown = 2
    } else if (location.hash === '#webcam') {
        var videoGrabbing = new THREEx.WebcamGrabbing();
        jsArucoMarker.videoScaleDown = 2
    } else if (location.hash === '#image') {
        var videoGrabbing = new THREEx.ImageGrabbing();
        jsArucoMarker.videoScaleDown = 10
    } else console.assert(false);

    // attach the videoGrabbing.domElement to the body
    document.body.appendChild(videoGrabbing.domElement);

    //////////////////////////////////////////////////////////////////////////////////
    //		Process video source to find markers
    //////////////////////////////////////////////////////////////////////////////////
    // set the markerObject3D as visible
    markerObject3D.visible = false;
    // process the image source with the marker recognition
    onRenderFcts.push(function () {
        if (detectMarkersEnabled === false) return;

        var domElement = videoGrabbing.domElement;
        detectMarkersStats.begin();
        var markers = jsArucoMarker.detectMarkers(domElement);
        detectMarkersStats.end();

        if (markerToObject3DEnabled === false) return;
        markerObject3D.visible = false;

        // see if this.markerId has been found
        markers.forEach(function (marker) {
            // if( marker.id !== 265 )	return

            jsArucoMarker.markerToObject3D(marker, markerObject3D);

            markerObject3D.visible = true
        })
    });


    //////////////////////////////////////////////////////////////////////////////////
    //		HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////////////////////////
    BIM.computeBoundSphere = function (scene) {
        var geo = new THREE.Geometry();
        scene.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                geo.merge(child.geometry);
            }
        });
        geo.computeBoundingSphere();

        //expand the scope of the bounding sphere
        scene.boundingSphere = {};
        scene.boundingSphere = geo.boundingSphere;
    };
    BIM.createLights = function (scene) {
        var ambientLight = new THREE.AmbientLight(0x696969);
        scene.add(ambientLight);


        //using the bounding sphere calculated above, get a numeric value to position the lights away from the center
        var offset = scene.boundingSphere.radius * 2;

        //get the center of the bounding sphere.  we'll use this to center the rig
        var center = scene.boundingSphere.center;


        //create a series of pointlights

        //directly above
        var pointA = new THREE.PointLight(0x666666, 1, 0);
        pointA.position.set(center.x, center.y + offset, center.z);
        pointA.castShadow = false;
        scene.add(pointA);

        //directly below
        var pointB = new THREE.PointLight(0x666666, 0.66, 0);
        pointB.position.set(center.x, center.y - offset, center.z);
        pointB.castShadow = false;
        scene.add(pointB);



        //4 from the cardinal directions, at roughly 45deg
        var pointC = new THREE.PointLight(0x666666, 0.33, 0);
        pointC.position.set(center.x + offset, center.y, center.z);
        pointC.castShadow = false;
        scene.add(pointC);


        var pointD = new THREE.PointLight(0x666666, 0.33, 0);
        pointD.position.set(center.x, center.y, center.z + offset);
        pointD.castShadow = false;
        scene.add(pointD);


        var pointE = new THREE.PointLight(0x666666, 0.33, 0);
        pointE.position.set(center.x - offset, center.y, center.z);
        pointE.castShadow = false;
        scene.add(pointE);

        var pointF = new THREE.PointLight(0x666666, 0.33, 0);
        pointF.position.set(center.x, center.y, center.z - offset);
        pointF.castShadow = false;
        scene.add(pointF);


    };

    BIM.attributes.init = function () {

        //attribute properties used throughout attribute / selection code

        //set the state of this guy to true
        BIM.attributesEnabled = true;

        //the three projector object used for turning a mouse click into a selection
        BIM.attributes.projector = new THREE.Projector();

        //a material used to represent a clicked object
        BIM.attributes.clickedMaterial = new THREE.MeshLambertMaterial({
            color: "rgb(255,255,0)",
            ambient: "rgb(255,255,0)",
            side: 2
        });

        //an object used to store the state of a selected element.
        BIM.attributes.previousClickedElement = new BIM.attributes.SelectedElement();

        BIM.viewerDiv = $('canvas');

        //Append a div to the parent for us to populate with attributes.  handle any jquery.ui initialization here too
        $('body').append("<div class='AugmentedBIM_attributeList'></div>");
        //function to position and size the blackout div
        var setAttributeList = function () {
            //set the position of the UI relative to the viewer div
            var targetDiv = $('.AugmentedBIM_attributeList');

            //get upper left coordinates of the viewer div - we'll use these for positioning
            var win = $(window);
            var x = BIM.viewerDiv.offset().left - win.scrollLeft();
            var y = BIM.viewerDiv.offset().top - win.scrollTop();

            //set the position and size
            targetDiv.css('left', x.toString() + "px");
            targetDiv.css('top', y.toString() + "px");
        };
        //call this the first time through
        setAttributeList();

        //respond to resize of Parent div
        BIM.viewerDiv.resize(function () {
            setAttributeList();
        });

        //set our local variable to the div we just created
        BIM.attributes.attributeListDiv = $('.AugmentedBIM_attributeList');
        //make the attributes div draggable and resizeable
        //BIM.attributes.attributeListDiv.draggable({ containment: "parent" });

        //set up mouse event
        BIM.viewerDiv.click(BIM.attributes.onMouseClick);
    };

    BIM.attributes.SelectedElement = function () {
        this.materials = [];    //array of materials.  Holds one mat for each Mesh that the selected object contains
        this.id = -1;           //the ID of the element.  We use this to test whether something was already selected on a click
        this.object = {};       //the actual object that was selected.  This has been painted with our 'selected' material
        //and needs to be painted back with the materials in the materials array
    };

    //Mouse Click event handler for selection.  When a user clicks on the viewer, this gets called
    BIM.attributes.onMouseClick = function (event) {

        //prevent the default event from triggering ... BH question - what is that event?  Test me.
        event.preventDefault();

        //call our checkIfSelected function
        BIM.attributes.checkIfSelected(event);
    };

    //Function that checks whether the click should select an element, de-select an element, or do nothing.
    //This is called on a mouse click from the handler function directly above
    BIM.attributes.checkIfSelected = function (event) {

        //get the canvas where three.js is running - it will be one of the children of our parent div
        //var children = BIM.viewerDiv.children();
        var canvas = BIM.viewerDiv;
        //for (var i = 0; i < children.length; i++) {
        //    if (children[i].tagName === "CANVAS") {
        //        //once we've found the element, wrap it in a jQuery object so we can call .position() and such.
        //        canvas = jQuery(children[i]);
        //        break;
        //    }
        //}

        //get X and Y offset values for our div.  We do this every time in case the viewer is moving around
        var win = $(window);
        var offsetX = canvas.offset().left - win.scrollLeft();
        var offsetY = canvas.offset().top - win.scrollTop();


        //get a vector representing the mouse position in 3D
        //NEW - from here: https://stackoverflow.com/questions/11036106/three-js-projector-and-ray-objects/23492823#23492823
        var mouse3D = new THREE.Vector3(((event.clientX - offsetX) / canvas.width()) * 2 - 1, -((event.clientY - offsetY) / canvas.height()) * 2 + 1, 0.5);    //OFFSET THE MOUSE CURSOR BY -7PX!!!!
        mouse3D.unproject(BIM.camera);
        mouse3D.sub(BIM.camera.position);
        mouse3D.normalize();

        //Get a list of objects that intersect with the selection vector.  We'll take the first one (the closest)
        //the Augmented BIM element list is populated in the BIMacles.jsonLoader.processSceneGeometry function
        //which is called every time a scene is loaded
        var raycaster = new THREE.Raycaster(BIM.camera.position, mouse3D);
        var intersects = raycaster.intersectObjects(BIM.attributes.elementList);

        //are there any intersections?
        if (intersects.length > 0) {

            //get the closest intesected object
            var myIntersect;
            var i = 0;

            while (i < intersects.length) {
                myIntersect = intersects[i].object;
                i++;
                //get the first object that is visible
                if (myIntersect.visible == true) break;
            }

            // was this element hidden by clicking on its layer checkbox?
            if (myIntersect.visible == true) {
                //was this element already selected?  if so, do nothing.
                if (myIntersect.id === BIM.attributes.previousClickedElement.id) return;

                //was another element already selected?
                if (BIM.attributes.previousClickedElement.id !== -1) {
                    //restore previously selected object's state
                    BIM.attributes.restorePreviouslySelectedObject();
                }


                //var to track whether the intersect is an object3d or a mesh
                var isObject3D = false;

                //did we intersect a mesh that belongs to an Object3D or a Geometry?  The former comes from Revit, the latter from GH
                if (myIntersect.parent.type === "Object3D") {
                    isObject3D = true;
                }

                isObject3D = false;


                //store the selected object
                BIM.attributes.storeSelectedObject(myIntersect, isObject3D);

                //paint the selected object[s] with the application's 'selected' material
                if (isObject3D) {
                    //loop over the children and paint each one
                    for (var i = 0; i < myIntersect.parent.children.length; i++) {
                        BIM.attributes.paintElement(myIntersect.parent.children[i], BIM.attributes.clickedMaterial);
                    }
                }

                else {
                    //paint the mesh with the clicked material
                    BIM.attributes.paintElement(myIntersect, BIM.attributes.clickedMaterial);
                }


                //populate the attribute list with the object's user data
                if (isObject3D) {
                    BIM.attributes.populateAttributeList(myIntersect.parent.userData);
                }
                else {
                    BIM.attributes.populateAttributeList(myIntersect.userData);
                }
            }

            else {
                //if an item was already selected
                if (BIM.attributes.previousClickedElement.id !== -1) {
                    //restore the previously selected object
                    BIM.attributes.restorePreviouslySelectedObject();

                    //hide the attributes
                    BIM.attributes.attributeListDiv.hide("slow");
                }
            }
        }

            //no selection.  Repaint previously selected item if required
        else {

            //if an item was already selected
            if (BIM.attributes.previousClickedElement.id !== -1) {
                //restore the previously selected object
                BIM.attributes.restorePreviouslySelectedObject();

                //hide the attributes
                BIM.attributes.attributeListDiv.hide("slow");
            }
        }
    };

    //Function to restore the state of a previously selected object.
    BIM.attributes.restorePreviouslySelectedObject = function () {

        //if nothing was selected, return
        if (BIM.attributes.previousClickedElement.id === -1) return;

        //apply the stored materials to the meshes in the object.

        //are we working with an object3d?  if so we need to reset all of the children materials
        if (BIM.attributes.previousClickedElement.object.type === "Object3D") {

            //loop over the children and repaint each one
            for (var i = 0; i < BIM.attributes.previousClickedElement.materials.length; i++) {
                BIM.attributes.paintElement(
                    BIM.attributes.previousClickedElement.object.children[i],
                    BIM.attributes.previousClickedElement.materials[i]
                );
            }


        }
        else { // we have a mesh

            //paint the mesh with it's original material
            BIM.attributes.paintElement(
                BIM.attributes.previousClickedElement.object,
                BIM.attributes.previousClickedElement.materials[0]
            );
        }


        //set id to -1 and clear the other vars so they can be populated during hte next selection
        BIM.attributes.previousClickedElement.id = -1;
        BIM.attributes.previousClickedElement.materials = [];
        BIM.attributes.previousClickedElement.object = {};

    };

    //Function to store a selected object in our attributes.PreviouslySelectedObject property.  Essentially a property setter
    //selected arg is the selected object
    //isObject3D arg is a bool describing whether  the selected object is of typeObject3D.  If so, we need to store it's children
    BIM.attributes.storeSelectedObject = function (selected, isObject3D) {

        if (isObject3D) {
            //store the ID of the parent object.
            BIM.attributes.previousClickedElement.id = selected.parent.id;

            //store the material of each child
            for (var i = 0; i < selected.parent.children.length; i++) {
                BIM.attributes.previousClickedElement.materials.push(selected.parent.children[i].material);
            }

            //store the entire parent object
            BIM.attributes.previousClickedElement.object = selected.parent;
        }
        else {
            //store the ID of the parent object.
            BIM.attributes.previousClickedElement.id = selected.id;

            //store the material of the selection
            BIM.attributes.previousClickedElement.materials.push(selected.material);

            //store the entire object
            BIM.attributes.previousClickedElement.object = selected;
        }

    };

    //function to paint an element with a material.  Called when an element is selected or de-selected
    BIM.attributes.paintElement = function (elementToPaint, material) {

        elementToPaint.material = material;

    };


    BIM.attributes.populateAttributeList = function (jsonData) {

        //empty the contents of the html element
        BIM.attributes.attributeListDiv.empty();

        //create a header
        BIM.attributes.attributeListDiv.append('<div class="AugmentedBIM_attributeListHeader">Element Attributes</div>');

        //add an empty item for some breathing room
        BIM.attributes.attributeListDiv.append('<div class="item">-------</div>');

        //loop through json object attributes and create a new line for each property
        var rowCounter = 1;
        var longestString = 0;
        for (var key in jsonData) {
            if (jsonData.hasOwnProperty(key)) {

                //add the key value pair
                if (jsonData[key].substr(0, 4) !== 'http') {
                    BIM.attributes.attributeListDiv.append('<div class="item">' + key + "  :  " + jsonData[key] + '</div>');
                } else {
                    var link = '<a href=' + jsonData[key] + ' target=_blank>' + jsonData[key] + '</a>';
                    BIM.attributes.attributeListDiv.append('<div class="item">' + key + "  :  " + link + '</div>');
                }

                //compute the length of the key value pair
                var len = (key + "  :  " + jsonData[key]).length;
                if (len > longestString) longestString = len;
            }

            //increment the counter
            rowCounter++;
        }

        //change height based on # rows
        BIM.attributes.attributeListDiv.height(rowCounter * 12 + 43);

        //set the width
        if (longestString > 50) {
            BIM.attributes.attributeListDiv.width(longestString * 5 + 43);
        }
        else {
            BIM.attributes.attributeListDiv.width(360);
        }

        //Show the html element
        BIM.attributes.attributeListDiv.show("slow");
    };

    //call internal funcitons
    BIM.computeBoundSphere(scene);
    BIM.createLights(scene);
    BIM.attributes.init();

    //expose properties for debugging and outside access
    BIM.scene = scene;
    BIM.camera = camera;


};
