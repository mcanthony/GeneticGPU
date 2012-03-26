
//board bounds
var sym = 3;

var minX = -sym;
var maxX = sym;
var minY = -sym;
var maxY = sym;

var minZ = -3;
var maxZ = 3;

//divisors
var numRows = 71;

var gl;


//camera stuff
var zoomAmount = -2;
var currentZoomLevel = -6;

var scaleAmount = 0.04;
var ourScaleTween = null;
var scaleVariablesForTween = null;

var globalYrotate = 0;
var globalXrotate = -90;
var angleLimit = 90;
var rotateOn = false;

var rotVariablesForTween = {'x':globalXrotate,'y':globalYrotate};
var ourTween = null;
var tweenTime = 1000;
var tweenEasing = TWEEN.Easing.Cubic.EaseInOut;
var ourTweenOn = false;
var timeoutMinutes = 10;
var timeOnLoad = new Date();
var startTime = timeOnLoad.getTime();

var blendShaderObj = null;


/*****************CLASSES*******************/
var Problem = function(equationString) {

    if(!this.validateEquationString(equationString))
    {
        return null;
    }

    //ok so we have a valid equation
    //get all the variables besides z

    //first replace all the "pow" operations and such
    this.equationString = equationString;

    var es = equationString;

    es = es.replace(/([a-zA-Z][a-zA-Z]+)/g,"");

    //now extract out all single variables, except for z because that's the cost function
    var variables = es.match(/([a-yA-Y])/g);

    this.vars = variables;
    this.numVars = variables.length;
};

Problem.prototype.validateEquationString = function(equationString) {
    //first remove all the valid digits
    var es = equationString;

    //first check that it begins with "z = " something
    if(!es.match(/^[ ]*z[ ]*=/g))
    {
        alert("the equation must start with z = something. Z is your cost function that you are trying to minimize with non-convex optimization");
        return null;
    }

    es = es.replace(/(\d+)\.(\d+)/g,"");

    //now see if there are digits left
    if(es.match(/\d+/g))
    {
        alert("You need to make all numbers floats for the Shader Language. These numbers need a .0 after them: " + es);
        return null;
    }
    //probably valid, still need to compile it of course though but this catches the user mistakes
    return true;
};

var getSource = function(obj) {
    if(obj.match)
    {
        //its a string, return it
        return obj;
    }
    if(obj.length)
    {
        //its a jquery array, get first element and get the text there
        return obj[0].text;
    }
    //its an html element
    return obj.text;
};

var shaderTemplateRenderer = function(problem,vertexShaderSrc,fragShaderSrc) {
    //so they can pass in either a jquery object, a single HTML element, or a string of the source
    this.validateArguments(variables,equationString,vertexShaderSrc,fragShaderSrc);

    this.vertexShaderTemplate = getSource(vertexShaderSrc);
    this.fragShaderTemplate = getSource(fragShaderSrc);

    this.problem = problem;

    this.buildShaders();
}

shaderTemplateRenderer.prototype.buildShaders = function() {
    //ok so essentially loop through in groups of "3" variables and compile the shader object to extract them
    var varsToSolve = this.problem.variables;

    var myShaders = [];

    while(varsToSolve.length > 0)
    {
        var theseVars = varsToSolve.splice(0,3);
        var thisShader = this.buildShaderForVariables(theseVars);
    }

};

shaderTemplateRenderer.prototype.buildShaderForVariables = function(theseVars) {



};

shaderTemplateRenderer.prototype.validateArguments = function(variables,equationString,vertexShaderSrc,fragShaderSrc) {

    if(!vertexShaderSrc || !fragShaderSrc)
    {
        throw new Error("Specify two valid shader sources!");
    }
    if(!equationString)
    {
        throw new Error("specify a valid equation string");
    }
    if(!variables)
    {
        throw new Error("give me an array of variables!");
    }
};

var myShader = function(vShaderSrc,fShaderSrc,uniformAttributes,isBall) {
    this.vShaderSrc = getSource(vShaderSrc);
    this.fShaderSrc = getSource(fShaderSrc);

    this.uniformAttributes = uniformAttributes;
    this.shaderProgram = null;

    if(isBall)
    {
        this.isBall = true;
    }
    else
    {
        this.isBall = false;
    }

    this.buildShader();
    this.buildAttributes();
};

myShader.prototype.buildShader = function() {
    var vShader = compileShader(this.vShaderSrc,"vertex");
    var fShader = compileShader(this.fShaderSrc,"frag");

    this.shaderProgram = gl.createProgram();
    gl.attachShader(this.shaderProgram,vShader);
    gl.attachShader(this.shaderProgram,fShader);
    gl.linkProgram(this.shaderProgram);

    var linkStatus = gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS);

    if(linkStatus != true)
    {
        console.warn("could not init shader",this.vShaderId);
    }
}

myShader.prototype.buildAttributes = function() {
    this.switchToShader();

    //always vertices as well
    this.shaderProgram.vertexPositionAttribute = gl.getAttribLocation(this.shaderProgram,"aVertexPosition");
    gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

    if(this.isBall)
    {
        this.shaderProgram.vertexColorAttribute = gl.getAttribLocation(this.shaderProgram,"aVertexColor");
        gl.enableVertexAttribArray(this.shaderProgram.vertexColorAttribute);
    }

    //do all the uniforms
    for(key in this.uniformAttributes)
    {
        var varName = key;
        var varLocation = varName + "location";
        //console.log("adding this",varName,"to location",varLocation);
        this.shaderProgram[varLocation] = gl.getUniformLocation(this.shaderProgram,varName);
    }
};

myShader.prototype.drawGrid = function(matrixAttributeUpdates) {
    //here matrixattributeupdates is optional. we might not need them if we have a fixed projection matrix
    this.switchToShader();

    //update the right matrices
    if(matrixAttributeUpdates)
    {
        //this will replace them in JS memory and also update them on the gpu
        this.updateAttributes(matrixAttributeUpdates);
    }

    if(!this.isBall)
    {
        //bind the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,gridVertexPositionBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, gridVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, gridVertexPositionBuffer.numItems);
    }
    else
    {
        //bind both position and color
        gl.bindBuffer(gl.ARRAY_BUFFER,ballVertexPositionBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, ballVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER,ballVertexColorBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexColorAttribute, ballVertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballVertexIndexBuffer);
        gl.drawElements(gl.TRIANGLES, ballVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }
};

myShader.prototype.switchToShader = function() {
    gl.useProgram(this.shaderProgram);
};

myShader.prototype.updateAttributes = function(attributes) {
    for(key in attributes)
    {
        var varName = key;
        if(!this.uniformAttributes[varName])
        {
            console.warn("Warning!! this attribute", varName, " has not been built yet, build it first!");
            continue;
        }
        this.uniformAttributes[varName] = attributes[varName];
    }
    //now go buffer all of these again
    this.switchToShader();
    this.bufferUniforms();
};

myShader.prototype.updateTime = function(timeVal) {
    this.uniformAttributes['time'] = timeVal;
};

myShader.prototype.bufferUniforms = function() {
    //uses my set of uniform attributes. essentially this means that i can have my own set of 
    //a perspective matrix, a move matrix, and several other things without requiring a lot of switching between everything.
    //
    //
    //the only thing im worried about is the uniform attribute... does this mean that it's uniform throughout the GPU? I don't think
    //so because you are specifying unique locations for each variable on the shader program, but this requires investigation...
    //
    //

    for(key in this.uniformAttributes)
    {
        var varName = key;

        var val = this.uniformAttributes[key].val;
        var type = this.uniformAttributes[key].type;
        var varLocation = varName + "location";

        if(type == 'f')
        {
            gl.uniform1f(this.shaderProgram[varLocation],val);
        }
        else if(type == '4fm')
        {
            gl.uniformMatrix4fv(this.shaderProgram[varLocation],false,val);
        }
        else
        {
            console.warn("unsupported type ",type);
        }
    }
};




/***************End Classes!*****************************/


/********** Geometry Functions *******/



/*******************End Geometry Functions******************/



//global colors

function initShaders() {

    //box shadeer
    var attributes = {
        'time':{type:'f',val:0},
        'minX':{type:'f',val:0},
        'maxX':{type:'f',val:0},
        'maxY':{type:'f',val:0},
        'minY':{type:'f',val:0},
        'minZ':{type:'f',val:0},
        'maxZ':{type:'f',val:0},
        'pMatrix':{type:'4fm',val:pMatrix},
        'mvMatrix':{type:'4fm',val:mvMatrix},
    };

    var ballAttributes = {
        'pMatrix':{type:'4fm',val:pMatrix},
        'mvMatrix':{type:'4fm',val:mvMatrix},
        'xPos':{type:'f',val:0},
        'yPos':{type:'f',val:0},
        'zPos':{type:'f',val:0},
    };

    blendShaderObj = new myShader($j("#shader-box-vs"),$j("#shader-box-fs"),attributes,false);
    ballShaderObj = new myShader($j("#shader-simple-vs"),$j("#shader-simple-fs"),ballAttributes,true);
}



var earthTexture;
var otherFramebuffer;
var otherTexture;

function initOtherFrameBuffer() {
    //make frame buffer
    otherFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,otherFramebuffer);
    otherFramebuffer.width = $j(window).width();
    otherFramebuffer.height = $j(window).height();

    //something with a render buffer?
    var renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER,renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, otherFramebuffer.width, otherFramebuffer.height);

    //reset back to default
    gl.bindTexture(gl.TEXTURE_2D,null);
    gl.bindRenderbuffer(gl.RENDERBUFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

function setObjUniforms() {
    var now = new Date();
    var deltaT = (now.getTime() - startTime) / 1000.0;

    var attributes = {
        'time':{type:'f',val:deltaT},
        'minX':{type:'f',val:minX},
        'maxX':{type:'f',val:maxX},
        'maxY':{type:'f',val:maxY},
        'minY':{type:'f',val:minY},
        'minZ':{type:'f',val:minZ},
        'maxZ':{type:'f',val:maxZ},
        'pMatrix':{type:'4fm',val:pMatrix},
        'mvMatrix':{type:'4fm',val:mvMatrix},
    };

    blendShaderObj.updateAttributes(attributes);
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}
var gridVertexPositionBuffer;

var ballVertexPositionBuffer;
var ballVertexColorBuffer;
var ballVertexIndexBuffer;

var vertices;
var colors;

function initGridBuffers() {

    //initialize the grid vertices
    var gridVertexPositions = [];

    var addPointsToBuffer = function() {
        for(var temp = 0; temp < arguments.length; temp++)
        {
            point = arguments[temp];
            //omit adding z coordinate, its not needed
            //gridVertexPositions.push(point.x, point.y, 0);
            gridVertexPositions.push(point.x, point.y);
        }
    };

    var makePoint = function(x,y) {
        return {'x':x,'y':y};
    };

    //numRows = someValue (global now)

    var xMinBoard = -1;
    var xMaxBoard = 1;
    var yMinBoard = -1;
    var yMaxBoard = 1;

    var xDivisor = (xMaxBoard - xMinBoard) / (numRows - 1);
    var yDivisor = (yMaxBoard - yMinBoard) / (numRows - 1);

    //the x loop
    for(var i = 0; i < numRows; i++)
    {
        //the y loop
        for(var j = 0; j < numRows; j++)
        {
            var xHere = i * xDivisor + xMinBoard;
            var yHere = j * yDivisor + yMinBoard;

            var xAcross = (i + 1) * xDivisor + xMinBoard;
            var yAcross = (j + 1) * yDivisor + yMinBoard;

            var pHere = makePoint(xHere,yHere);
            var pAbove = makePoint(xHere,yAcross);
            var pRight = makePoint(xAcross,yHere);
            var pDiagonal = makePoint(xAcross,yAcross);

            addPointsToBuffer(pHere,pDiagonal,pAbove);
            addPointsToBuffer(pHere,pRight,pDiagonal);
        }
    }

    //gridVertexPositions = [1,1,0,-1,-1,0,-1,1,0];

    gridVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridVertexPositions), gl.STATIC_DRAW);

    //we don't need the z coordinate here, so omit it from the array

    gridVertexPositionBuffer.itemSize = 2;
    gridVertexPositionBuffer.numItems = gridVertexPositions.length / gridVertexPositionBuffer.itemSize;

    
    //do the ball too
    initBallBuffers();
}

function initBallBuffers() {
    //generate the points to draw

    var latitudeBands = 10;
    var longitudeBands = 10;
    var radius = 0.2;

    var ballVertexPositions = [];
    var ballVertexColors = [];

    for (var latNumber=0; latNumber <= latitudeBands; latNumber++) {
        var theta = latNumber * Math.PI / latitudeBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var longNumber=0; longNumber <= longitudeBands; longNumber++) {
                var phi = longNumber * 2 * Math.PI / longitudeBands;
                var sinPhi = Math.sin(phi);
                var cosPhi = Math.cos(phi);

                var x = cosPhi * sinTheta;
                var y = cosTheta;
                var z = sinPhi * sinTheta;

                ballVertexPositions.push(radius * x);
                ballVertexPositions.push(radius * y);
                ballVertexPositions.push(radius * z);

                //push colors
                ballVertexColors.push(0);
                ballVertexColors.push(x*0.5 + 0.5);
                ballVertexColors.push(z*0.5 + 0.5);
                ballVertexColors.push(0.9);
        }
    }

    var indexData = [];
    for (var latNumber=0; latNumber < latitudeBands; latNumber++) {
        for (var longNumber=0; longNumber < longitudeBands; longNumber++) {

            var first = (latNumber * (longitudeBands + 1)) + longNumber;
            var second = first + longitudeBands + 1;

            indexData.push(first);
            indexData.push(second);
            indexData.push(first + 1);

            indexData.push(second);
            indexData.push(second + 1);
            indexData.push(first + 1);
        }
    }

    ballVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ballVertexPositions), gl.STATIC_DRAW);

    ballVertexColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballVertexColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ballVertexColors), gl.STATIC_DRAW);

    ballVertexPositionBuffer.itemSize = 3;
    ballVertexPositionBuffer.numItems = ballVertexPositions.length / ballVertexPositionBuffer.itemSize;

    ballVertexColorBuffer.itemSize = 4;
    ballVertexColorBuffer.numItems = ballVertexColors.length / ballVertexColorBuffer.itemSize;

    ballVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);

    ballVertexIndexBuffer.itemSize = 1;
    ballVertexIndexBuffer.numItems = indexData.length / 1;
}

/*
function getArcAtMousePos(x,y) {
    ***********this is old but i want to reference this code later!!!***
    //flip y
    y = gl.viewportHeight - y;

    //real quick, render the frame but in pick mode into another buffer!
    gl.bindFramebuffer(gl.FRAMEBUFFER, otherFramebuffer);
    drawSceneIntoOtherBuffer();

    //go get the pixel data from the frame buffer
    var pixelValues = new Uint8Array(4);
    gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixelValues);

    //now switch back
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    //console.log("R:" + pixelValues[0] + " G:" + pixelValues[1] + " B:" + pixelValues[2]);

    var r = pixelValues[0]; var rS = zeroPad(r,3);
    var g = pixelValues[1]; var gS = zeroPad(g,3);
    var b = pixelValues[2]; var bS = zeroPad(b,3);

    //get the string for this
    var cString = rS + gS + bS;
    
    //see if its there
    if(globalColorTaken[cString])
    {
        //also tell who it is
        var theArc = globalColorLookup[cString];
        return theArc;
    }
    return null;
}
*/

function drawScene() {

    cameraPerspectiveClear();
    translateAndRotate();

    cameraUpdates = {
        'pMatrix':{type:'4fm','val':pMatrix},
        'mvMatrix':{type:'4fm','val':mvMatrix},
    };

    //here, we draw the grid with our shader object
    blendShaderObj.switchToShader();
    setObjUniforms();
    blendShaderObj.drawGrid(cameraUpdates);

        //go find the minimum
    if(asd)
    {
        var thisPos = findMinimumOnFrameBuffer();
        if(thisPos.x > -2.5)
        {
            pos = thisPos;
        }
        console.log("min position x:",pos.x," y:",pos.y, " zORIGINAL:",pos.zOrig);
    }

    ballUpdates = {
        'pMatrix':{type:'4fm','val':pMatrix},
        'mvMatrix':{type:'4fm','val':mvMatrix},
        'xPos':{type:'f','val':pos.xOrig},
        'yPos':{type:'f','val':pos.yOrig},
        'zPos':{type:'f','val':pos.zOrig},
    };


    ballShaderObj.drawGrid(ballUpdates);
}

var asd = false;
var pos = {'xOrig':0,'yOrig':0};

function cameraPerspectiveClear() {

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    //we set our clearColor to be 0 0 0 0, so its essentially transparent.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
    //mat4.ortho(-100,-100,gl.viewportWidth,gl.viewportHeight,0.1,100,pMatrix);
    mat4.ortho(-0.0519,0.0519,-0.0414,0.0414,0.1,100.0,pMatrix);
}


function translateAndRotate() {

    mat4.identity(mvMatrix);

    mat4.translate(mvMatrix, [0, 0, zoomAmount]);

    //cap variables
    if(globalYrotate > 360)
    {
        globalYrotate -= 360;
    }
    if(globalYrotate < -360)
    {
        globalYrotate += 360;
    }

    //do rotation for camera
    var newRot = mat4.create();
    mat4.identity(newRot);

    //now need to get the other axis
    var secondRotAxis = vec3.create();
    var result = vec3.create();
    secondRotAxis[0] = 1;
    mat4.multiplyVec3(newRot,secondRotAxis,result);

    mat4.rotate(newRot,degToRad(globalXrotate), [result[0],result[1],result[2]]);
    mat4.rotate(newRot,degToRad(globalYrotate), [0,1,0]);

    //now multiply earth rotation
    mat4.identity(earthRotationMatrix);
    mat4.multiply(earthRotationMatrix,newRot);

    mat4.scale(mvMatrix,[scaleAmount,scaleAmount,scaleAmount]);

    mat4.multiply(mvMatrix, earthRotationMatrix);
}

function tweenUpdate() {
    globalXrotate = rotVariablesForTween.x;
    globalYrotate = rotVariablesForTween.y;
}

function tweenDone() {
    ourTweenOn = false;
}

function tick() {
    requestAnimFrame(tick);
    drawScene();
}


function webGLStart() {
    startLoadingWithText("Initializing WebGL...");
   
    canvas = document.getElementById("earth-canvas");
    initGL(canvas);
    initShaders();
    initGridBuffers();

    initOtherFrameBuffer();

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

    document.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;

    //do the finish down here
    stopLoadingWithText();
    doEarthFlyin();
    tick();
}

function doEarthFlyin() {
    scaleAmount = 0.0001;
    if(ourScaleTween)
    {
        ourScaleTween.stop();
    }

    scaleVariablesForTween = {'scale':scaleAmount};

    ourScaleTween = new TWEEN.Tween(scaleVariablesForTween).to({'scale':0.04},tweenTime*1.5).onUpdate(scaleTweenUpdate);
    setTimeout('scaleTweenComplete()',tweenTime*0.5);
    ourScaleTween.easing(TWEEN.Easing.Quartic.EaseInOut);
    ourScaleTween.start();
} 

function scaleTweenComplete()
{
    //code here possibly
}

function scaleTweenUpdate() {
    scaleAmount = scaleVariablesForTween.scale;
}

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    return compileShader(str,shaderScript.type);
}

function compileShader(str,type) {

    var shader;
    if (type == "x-shader/x-fragment" || type == "frag" || type == "fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (type == "x-shader/x-vertex" || type == "vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        throw new Error("invalid shader type: " + type);
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function getPixelData(x,y,width,height)
{
    var pixelValues = new Uint8Array(4 * (width+1) * (height+1));
    gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixelValues);

    return pixelValues;
}

function dumpScreenShot()
{
    //get all the pixels of the viewport
    var height = gl.viewportHeight;
    var width = gl.viewportWidth;

    var pixels = getPixelData(0,0,width,height);

    //get or make the snapshot canvas
    var cvs = document.getElementById('screenShotCanvas');

    if(!cvs)
    {
        cvs = document.createElement('canvas');
        cvs.id = 'screenShotCanvas';
        document.getElementsByTagName('body')[0].appendChild(cvs);
        cvs = document.getElementById('screenShotCanvas');
        $j('#screenShotCanvas').css({
                            'position':'absolute',
                            'right':'0px',
                            'top':'0px'});
    }

    cvs.width = gl.viewportWidth;
    cvs.height = gl.viewportHeight;

    var ctx2d = cvs.getContext('2d');
    var image = ctx2d.createImageData(cvs.width, cvs.height);

    for (var y = 0; y < cvs.height; y++){
        for (var x = 0; x < cvs.width; x++){
            var index = (y * cvs.width + x) * 4;
            var index2 = ((cvs.height-1-y) * cvs.width + x) * 4;

            for(var p = 0; p < 4; p++){
                    image.data[index2 + p] = pixels[index + p];
                }
        }
    }

    //put the image onto the canvas
    ctx2d.putImageData(image, 0, 0);
}

function colorIntToPosition(colorValue,coordMin,coordMax,numRows)
{
    var positionInUniformGridFromMin = (colorValue / 256.0);
    //we will round this position in the uniform grid by going to numrows, rounding, and then back
    var roundedPos = Math.round(positionInUniformGridFromMin * (numRows - 1));
    var coordDivisor = (coordMax - coordMin) / (numRows - 1);

    //yay this works!
    //console.log("the rounded pos is",roundedPos);
    //console.log("coord divisor",coordDivisor);
    
    //rounded pos is the 0-indexed base position of the row in the grid. aka for a 3 row grid, 0 is the min, 1 is middle, 2 is max
    //so then to get the "snapped" coordinate, we take the position, multiply it by the divisor, and then add it to the min
    var coordPos = coordDivisor * roundedPos + coordMin;

    return coordPos;
}

function makeCoordToIndexConverter(height,width) {
    var converter = function(x,y) {
            var index = 4*(y * width + x);
            return index;
    };
    return converter;
}

function findMinimumOnFrameBuffer(heightOfBuffer,widthOfBuffer) {
    var colors = findRGBofBottomFrameBuffer(heightOfBuffer,widthOfBuffer);

    //TODO here we will pass in these rgb's into another function to calculate the position but for now
    //it will be a fixed coordinate transformation

    //if we didnt find anything just give up
    if(colors.noneFound)
    {
        return null;
    }

    //otherwise, conver to x and y. another TODO. here we are assuming that r = x and y = b
    var xPos = colorIntToPosition(colors.r,minX,maxX,numRows); //TODO numrows constant
    var yPos = colorIntToPosition(colors.g,minY,maxY,numRows);

    var xOriginalPos = (colors.r / 255) * 2 - 1;
    var yOriginalPos = (colors.g / 255) * 2 - 1;

    return {'x':xPos,'y':yPos,'xOrig':xOriginalPos,'yOrig':yOriginalPos,'zOrig':colors.estZ};
}

function findRGBofBottomFrameBuffer(heightOfBuffer,widthOfBuffer) {
    //default to viewport if nothing is specified
    if(!heightOfBuffer)
    {
        heightOfBuffer = gl.viewportHeight;
    }
    if(!widthOfBuffer)
    {
        widthOfBuffer = gl.viewportWidth;
    }

    //use a closure to simplify our conversion process
    var converter = makeCoordToIndexConverter(heightOfBuffer,widthOfBuffer);

    //its actually faster to copy all the pixels at once and loop through that Uint8 array
    var allPixels = getPixelData(0,0,widthOfBuffer,heightOfBuffer);

    var anyColorPositive = function(x,y) {
        var rIndex = converter(x,y);
        return allPixels[rIndex] || allPixels[rIndex+1] || allPixels[rIndex+2];
    };

    //scan from the bottom to the top on the current frame buffer, and return once we find something thats
    //nonzero. Make sure to take the middle of the row that has an optimum
    for(var y = 0; y < heightOfBuffer; y++)
    {
        for(var x = 0; x < widthOfBuffer; x++)
        {
            if(anyColorPositive(x,y))
            {
                //here we need to loop forward while the row still has positive colors just so we can get the middle
                var xLeft = x;
                var xRight = x + 1;
                //move right while there are still positive colors
                while(xRight < widthOfBuffer && anyColorPositive(xRight,y))
                {
                    xRight++;
                }
                //now get the "middle"
                var xMiddle = Math.round(xRight*0.5 + xLeft*0.5);

                var rIndex = converter(xMiddle,y);
                
                var r = allPixels[rIndex];
                var g = allPixels[rIndex+1];
                var b = allPixels[rIndex+1];

                //return these optimums and an estimate for the z
                var estZ = (y / heightOfBuffer) * 2 - 1;
                return {'r':r,'g':g,'b':b,'estZ':estZ};
            }
        }
    }

    //this line should never execute unless we are on a completely empty framebuffer
    return {'r':0,'g':0,'b':0,'noneFound':true};
};
var minXpixel; var minYpixel;

