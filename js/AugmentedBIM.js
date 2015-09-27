var AugmentedBIM = function (data, callback) {

    var BIM = this;

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
        markerObject3D.add(mesh);

        var mesh2 = new THREE.AxisHelper;
        markerObject3D.add(mesh2);
    })();


    //////////////////////////////////////////////////////////////////////////////////
    //		Parse our Spectacles file into something we can load into AugmentedBIM
    //////////////////////////////////////////////////////////////////////////////////

    var loader = new THREE.ObjectLoader();
    var myScene = loader.parse(data);

            myScene.traverse(function (child) {
                if (child instanceof THREE.Mesh) {
                    markerObject3D.add(child);
                }
            });


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
        //var offset = scene.boundingSphere.radius * 2;

        ////get the center of the bounding sphere.  we'll use this to center the rig
        //var center = scene.boundingSphere.center;


        ////create a series of pointlights

        ////directly above
        //var pointA = new THREE.PointLight(0x666666, 1, 0);
        //pointA.position.set(center.x, center.y + offset, center.z);
        //pointA.castShadow = false;
        //scene.add(pointA);

        ////directly below
        //var pointB = new THREE.PointLight(0x666666, 0.66, 0);
        //pointB.position.set(center.x, center.y - offset, center.z);
        //pointB.castShadow = false;
        //scene.add(pointB);



        ////4 from the cardinal directions, at roughly 45deg
        //var pointC = new THREE.PointLight(0x666666, 0.33, 0);
        //pointC.position.set(center.x + offset, center.y, center.z);
        //pointC.castShadow = false;
        //scene.add(pointC);


        //var pointD = new THREE.PointLight(0x666666, 0.33, 0);
        //pointD.position.set(center.x, center.y, center.z + offset);
        //pointD.castShadow = false;
        //scene.add(pointD);


        //var pointE = new THREE.PointLight(0x666666, 0.33, 0);
        //pointE.position.set(center.x - offset, center.y, center.z);
        //pointE.castShadow = false;
        //scene.add(pointE);

        //var pointF = new THREE.PointLight(0x666666, 0.33, 0);
        //pointF.position.set(center.x, center.y, center.z - offset);
        //pointF.castShadow = false;
        //scene.add(pointF);

        //directional light - the sun
        //var light = new THREE.DirectionalLight(0xffffff, 1);
        //light.position.set(center.x + offset, center.y + offset, center.z + offset);
        //light.target.position.set(center.x, center.y, center.z);
        ////light.castShadow = true;
        //light.shadowCameraNear = 1;
        //light.shadowCameraFar = offset * 2.5;
        //light.shadowCameraTop = offset * 1.2;
        //light.shadowCameraRight = offset * 1.2;
        //light.shadowCameraBottom = offset * -1.2;
        //light.shadowCameraLeft = offset * -1.2;
        //light.distance = 0;
        //light.intensity = 0;
        //light.shadowBias = 0.001;
        ////light.shadowMapHeight = SPECT.viewerDiv.innerHeight();
        ////light.shadowMapWidth = SPECT.viewerDiv.innerWidth();
        //light.shadowDarkness = 0.65;
        ////light.shadowCameraVisible = true;

        //add the light to our scene and to our app object

        //scene.add(light);
    };




    BIM.computeBoundSphere(scene);
    BIM.createLights(scene);
};